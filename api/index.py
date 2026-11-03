"""Vercel serverless entry. Storage lives in /tmp, so every cold start begins from the seeded sample data."""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.environ.setdefault('DATA_DIR', '/tmp/wewin')
os.environ.setdefault('TRUST_PROXY', '1')
if os.getenv('VERCEL_PROJECT_PRODUCTION_URL'):
    os.environ.setdefault('APP_ORIGIN', 'https://' + os.environ['VERCEL_PROJECT_PRODUCTION_URL'])

import server, seed_demo

seed_demo.ensure_all()


class handler(server.Handler):
    pass
