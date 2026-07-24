# Production image for RefluxCare: builds the web app, then serves it together
# with the API from a single FastAPI process. Used by Render (see render.yaml).
# Local development still uses docker compose + server/Dockerfile + Vite.

# ---- Stage 1: build the web app ----
FROM node:20-slim AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
# Same-origin in production: the API is served from the same host as the site,
# so the app uses relative URLs (empty base).
ENV VITE_API_URL=""
RUN npm run build

# ---- Stage 2: API + built web ----
FROM python:3.13-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
COPY server/requirements.txt ./
RUN pip install -r requirements.txt
COPY server/ ./
# The built site is served by FastAPI from ./static (see app/main.py).
COPY --from=web /web/dist ./static
EXPOSE 8000
# Render sets $PORT; fall back to 8000 when run directly.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
