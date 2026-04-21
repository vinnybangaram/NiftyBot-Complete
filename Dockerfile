# --- STAGE 1: Build Frontend ---
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY nifty-dashboard/package*.json ./
RUN npm install
COPY nifty-dashboard/ .
# Fix API link for production
RUN sed -i 's|const API = ".*"|const API = ""|g' src/App.js
RUN npm run build

# --- STAGE 2: Build Backend & Serve ---
FROM python:3.10-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn

# Copy backend code
COPY . .

# Copy frontend build to static folder
COPY --from=frontend-builder /app/frontend/build ./static

# Expose port
EXPOSE 5000

# Run with Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]
