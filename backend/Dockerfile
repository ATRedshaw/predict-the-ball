FROM python:3.12-slim

# Google Chrome's apt repo is x86_64 only — the Oracle A1.Flex is aarch64.
# Debian's chromium package has native arm64 builds and pulls in all required
# libs automatically. xvfb is required by sbvirtualdisplay for headless use.
# The google-chrome symlink ensures seleniumbase's browser detection finds it.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    xvfb \
    fonts-liberation \
    && ln -sf /usr/bin/chromium /usr/bin/google-chrome \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "3", "app:create_app()"]