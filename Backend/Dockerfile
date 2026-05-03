FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    tesseract-ocr \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Create static directory
RUN mkdir -p static

# Expose port
EXPOSE 8000

# Default command (overridden by worker in docker-compose)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
