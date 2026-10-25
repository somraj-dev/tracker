#!/bin/bash
set -e

echo "===> Installing build dependencies..."
if command -v uv >/dev/null 2>&1; then
    uv pip install --system -r requirements.txt || uv pip install --system --break-system-packages -r requirements.txt
else
    python3 -m pip install --break-system-packages -r requirements.txt
fi

echo "===> Collecting static files..."
python3 manage.py collectstatic --noinput --clear

echo "===> Build completed successfully!"
