from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.schemas.fitting import ChatRequest
from app.services.ai_service import stream_chatbot_response
from app.api.v1.auth import get_current_user
from app.models.user import User
import json

router = APIRouter()


@router.post("/stream")
async def chatbot_stream(
    req: ChatRequest,
    _: User = Depends(get_current_user),
):
    """Chat avec l'assistant audition en streaming (Server-Sent Events)."""
    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    async def event_generator():
        async for chunk in stream_chatbot_response(messages, req.patient_context):
            yield f"data: {json.dumps({'text': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("")
async def chatbot_sync(
    req: ChatRequest,
    _: User = Depends(get_current_user),
):
    """Chat synchrone (non-streamé) pour les clients qui ne supportent pas SSE."""
    from app.services.ai_service import chat_once, SYSTEM_CHATBOT_AUDITION
    import json

    messages = req.messages
    last_user_message = next(
        (m.content for m in reversed(messages) if m.role == "user"), ""
    )

    system = SYSTEM_CHATBOT_AUDITION
    if req.patient_context:
        system += f"\n\nContexte patient : {json.dumps(req.patient_context, ensure_ascii=False)}"

    all_messages = [{"role": m.role, "content": m.content} for m in messages]

    from anthropic import AsyncAnthropic
    from app.config import get_settings
    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    message = await client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=2048,
        system=system,
        messages=all_messages,
    )
    return {"response": message.content[0].text}
