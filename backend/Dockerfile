FROM python:3.12-slim

# Google Chrome's apt repo is x86_64 only — the Oracle A1.Flex is aarch64.
# Debian's chromium + chromium-driver packages are native arm64 builds.
# xvfb is required by sbvirtualdisplay for headless rendering.
# The google-chrome symlink lets seleniumbase find the browser via its
# standard name lookup.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    chromium-driver \
    xvfb \
    fonts-liberation \
    && ln -sf /usr/bin/chromium /usr/bin/google-chrome \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# seleniumbase's UC mode download code doesn't detect aarch64 and always
# fetches linux64 binaries, causing an Exec format error on arm64. Pre-populate
# the seleniumbase drivers directory with the native arm64 chromedriver from
# Debian so seleniumbase finds a version-matched driver and skips the download.
RUN SB_DRIVERS=$(python -c "import os, seleniumbase; print(os.path.join(os.path.dirname(seleniumbase.__file__), 'drivers'))") \
    && mkdir -p "$SB_DRIVERS" \
    && cp /usr/bin/chromedriver "$SB_DRIVERS/chromedriver" \
    && cp /usr/bin/chromedriver "$SB_DRIVERS/uc_driver" \
    && chmod +x "$SB_DRIVERS/chromedriver" "$SB_DRIVERS/uc_driver"

COPY . .

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "3", "app:create_app()"]