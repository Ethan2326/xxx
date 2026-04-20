import { useState, useRef, useEffect } from 'react'
import { chatbotAPI } from '@/services/api'
import { MessageSquare, Send, Loader2, Trash2, Bot, User } from 'lucide-react'
import { useChatStore } from '@/store'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '@/types'

const SUGGESTED_QUESTIONS = [
  'Quels sont les critères de prescription pour un appareillage auditif ?',
  'Explique-moi le 100% Santé et ses plafonds LPP pour 2024',
  'Comment interpréter un audiogramme tonal avec un encoché de 4000 Hz ?',
  'Quelle est la différence entre un RITE et un BTE classique ?',
  'Quelles sont les recommandations HAS pour le suivi d\'un patient appareillé ?',
  'Comment gérer un patient présentant un acouphène avec appareillage ?',
]

export default function ChatbotPage() {
  const { messages, isLoading, addMessage, setLoading, clearMessages } = useChatStore()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const sendMessage = async (text?: string) => {
    const content = text || input.trim()
    if (!content || isLoading) return

    const userMsg: ChatMessage = { role: 'user', content }
    addMessage(userMsg)
    setInput('')
    setLoading(true)

    try {
      const allMessages = [...messages, userMsg]
      const { data } = await chatbotAPI.send(allMessages)
      addMessage({ role: 'assistant', content: data.response })
    } catch {
      addMessage({ role: 'assistant', content: 'Désolé, une erreur est survenue. Veuillez réessayer.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)] space-y-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chatbot Audition</h1>
          <p className="text-gray-500 mt-1">Assistant IA spécialisé en audiologie et audioprothèse</p>
        </div>
        {messages.length > 0 && (
          <button
            className="btn-secondary"
            onClick={clearMessages}
          >
            <Trash2 className="w-4 h-4" />
            Effacer
          </button>
        )}
      </div>

      {/* Zone de messages */}
      <div className="card flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <MessageSquare className="w-16 h-16 text-gray-200 mb-4" />
            <h3 className="text-gray-500 font-medium mb-2">Comment puis-je vous aider ?</h3>
            <p className="text-gray-400 text-sm mb-8 text-center max-w-sm">
              Posez vos questions sur l'audiologie, les appareils auditifs, la réglementation française…
            </p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xl">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  className="text-left px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 transition-all"
                  onClick={() => sendMessage(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user' ? 'bg-brand-600' : 'bg-gray-200'
                }`}>
                  {msg.role === 'user'
                    ? <User className="w-4 h-4 text-white" />
                    : <Bot className="w-4 h-4 text-gray-600" />
                  }
                </div>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-brand-600 text-white rounded-tr-none'
                    : 'bg-gray-100 text-gray-900 rounded-tl-none'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-gray-600" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Zone de saisie */}
      <div className="card p-3 flex-shrink-0">
        <div className="flex gap-3">
          <input
            className="input flex-1"
            placeholder="Posez votre question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            disabled={isLoading}
          />
          <button
            className="btn-primary px-4"
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
          >
            {isLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 px-1">
          Contenu informatif uniquement — Toujours valider avec le patient et le prescripteur
        </p>
      </div>
    </div>
  )
}
