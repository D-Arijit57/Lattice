"""Count SQL queries per delivery request (run in the backend container)."""
import os, sys
sys.path.insert(0, "/app")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "content_engine.settings")
import django; django.setup()
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext, override_settings

assert connection.settings_dict["HOST"] in {"db", "localhost", "127.0.0.1"}
key = open("/loadtest/keys.txt").readline().strip()
hdr = {"HTTP_AUTHORIZATION": f"Bearer {key}", "HTTP_X_FORWARDED_PROTO": "https"}
base = "/api/delivery/content-types/product/entries/"
with override_settings(ALLOWED_HOSTS=["*"]):
    c = Client()
    for name, url in (("list (50 rows)", base), ("detail", base + "500/")):
        c.get(url, **hdr)  # warm
        with CaptureQueriesContext(connection) as q:
            r = c.get(url, **hdr)
        print(f"{name}: status={r.status_code} queries={len(q)}")
