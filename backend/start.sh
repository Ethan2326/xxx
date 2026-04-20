#!/bin/sh
# Render fournit DATABASE_URL_SYNC en postgresql://...
# SQLAlchemy async requiert postgresql+asyncpg://...
if [ -n "$DATABASE_URL_SYNC" ]; then
  export DATABASE_URL=$(echo "$DATABASE_URL_SYNC" | sed 's|^postgresql://|postgresql+asyncpg://|')
fi
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
