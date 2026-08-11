FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements ./requirements
RUN pip install --no-cache-dir -r requirements/base.txt -r requirements/production.txt

COPY . .

RUN adduser --disabled-password --gecos "" appuser && chown -R appuser:appuser /app
USER appuser

RUN python manage.py collectstatic --noinput

ENTRYPOINT ["sh", "/app/entrypoint.sh"]
CMD ["daphne", "config.asgi:application", "--bind", "0.0.0.0", "--port", "8000"]
