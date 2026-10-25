"""
WSGI config for backend project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/wsgi/
"""

import os
import shutil
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Detect serverless environment (Vercel / AWS Lambda)
is_serverless = bool(
    os.environ.get('VERCEL') or
    os.environ.get('VERCEL_ENV') or
    os.environ.get('AWS_LAMBDA_FUNCTION_NAME') or
    os.environ.get('LAMBDA_TASK_ROOT') or
    '/var/task' in str(BASE_DIR) or
    not os.access(str(BASE_DIR), os.W_OK)
)

if is_serverless:
    os.environ['VERCEL'] = '1'
    tmp_db = '/tmp/db.sqlite3'
    seed_db = os.path.join(BASE_DIR, 'db.sqlite3')
    if not os.path.exists(tmp_db) and os.path.exists(seed_db):
        try:
            shutil.copy2(seed_db, tmp_db)
            os.chmod(tmp_db, 0o666)
        except Exception as e:
            print(f"Error copying seed db to {tmp_db}: {e}")

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

application = get_wsgi_application()
app = application
