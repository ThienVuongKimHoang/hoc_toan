FROM python:3.11-slim

WORKDIR /app

# Không cần gcc / libpq-dev: psycopg2-binary và các package còn lại
# đều cài từ wheel dựng sẵn (psycopg2-binary bundle sẵn libpq).

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]
