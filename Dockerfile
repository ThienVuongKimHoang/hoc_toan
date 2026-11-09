FROM python:3.11-slim

WORKDIR /app

# Không cần gcc / libpq-dev: psycopg2-binary và các package còn lại
# đều cài từ wheel dựng sẵn (psycopg2-binary bundle sẵn libpq).

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Đổi công thức Word sang đối tượng MathType. Gói khai báo Python >=3.12 nhưng đã chạy thử
# đúng trên 3.11, nên bỏ qua kiểm tra phiên bản; ghim đúng bản đã đọc mã nguồn.
RUN pip install --no-cache-dir --no-deps --ignore-requires-python omml-converter==0.1.0

COPY . .

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header"]
