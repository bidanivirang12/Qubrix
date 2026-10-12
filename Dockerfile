FROM ghcr.io/astral-sh/uv:0.12.13 AS uv

FROM python:3.12-slim AS build
COPY --from=uv /uv /uvx /bin/
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv
COPY pyproject.toml uv.lock ./
COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic
RUN uv sync --frozen --no-dev

FROM python:3.12-slim AS runtime
WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1
RUN addgroup --system qubrix && adduser --system --ingroup qubrix --no-create-home qubrix
COPY --from=build --chown=qubrix:qubrix /app/.venv /app/.venv
COPY --chown=qubrix:qubrix app ./app
USER qubrix
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
