"""Seed the LOCAL load-test database. Run inside the backend container:

    docker compose -f loadtest/docker-compose.loadtest.yml exec backend \
        python /loadtest/seed.py --entries 100000 --keys 2000

Refuses to run unless the database host is the compose `db` service or
localhost, so it can never write to the production (Supabase) database.
"""
import argparse
import json
import os
import secrets
import sys

sys.path.insert(0, "/app")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "content_engine.settings")

import django  # noqa: E402

django.setup()

from django.db import connection  # noqa: E402

ALLOWED_HOSTS = {"db", "localhost", "127.0.0.1"}
host = connection.settings_dict["HOST"]
if host not in ALLOWED_HOSTS:
    sys.exit(f"REFUSING to seed: database host is {host!r}, not a local load-test DB.")
print(f"Database host: {host} (ok)")

from accounts.models import APIKey, Organization, hash_api_key  # noqa: E402
from content.models import ContentType, Entry, Field  # noqa: E402
from content.services.versioning import create_content_type_version  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument("--entries", type=int, default=100_000)
parser.add_argument("--keys", type=int, default=2000)
parser.add_argument("--out", default="/loadtest")
args = parser.parse_args()

if Organization.objects.filter(name="LoadTest").exists():
    sys.exit("LoadTest org already exists. Run `docker compose down -v` to start clean.")

org = Organization.objects.create(name="LoadTest")
ct = ContentType.objects.create(organization=org, name="Product", slug="product")
for name, data_type in (("title", "string"), ("description", "string"), ("price", "number")):
    Field.objects.create(content_type=ct, name=name, data_type=data_type, required=True)
version = create_content_type_version(content_type=ct)

DESC = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " * 6  # ~340 B
BATCH = 5000
for start in range(0, args.entries, BATCH):
    n = min(BATCH, args.entries - start)
    Entry.objects.bulk_create(
        [
            Entry(
                content_type=ct,  # bulk_create skips Entry.save(), so set it here
                content_type_version=version,
                data={"title": f"Product {start + i}", "description": DESC, "price": (start + i) % 997 + 0.99},
            )
            for i in range(n)
        ]
    )
    print(f"entries {start + n}/{args.entries}", end="\r")
print()

# auto_now_add stamps every bulk-created row with ~the same instant; spread
# created_at so cursor pagination walks realistic, distinct timestamps.
table = Entry._meta.db_table
with connection.cursor() as cur:
    cur.execute(f"UPDATE {table} SET created_at = now() - (id * interval '1 second')")
    cur.execute(f"ANALYZE {table}")

raw_keys = [f"lat_loadtest_{i}_{secrets.token_hex(8)}" for i in range(args.keys)]
APIKey.objects.bulk_create(
    [APIKey(organization=org, name=f"lt-{i}", hashed_key=hash_api_key(k)) for i, k in enumerate(raw_keys)]
)

ids = list(Entry.objects.order_by("id").values_list("id", flat=True)[:1]) + list(
    Entry.objects.order_by("-id").values_list("id", flat=True)[:1]
)
with open(os.path.join(args.out, "keys.txt"), "w") as f:
    f.write("\n".join(raw_keys))
with open(os.path.join(args.out, "meta.json"), "w") as f:
    json.dump({"slug": "product", "min_id": ids[0], "max_id": ids[1], "entries": Entry.objects.count(), "keys": len(raw_keys)}, f)
print("seeded:", Entry.objects.count(), "entries,", len(raw_keys), "keys; ids", ids[0], "-", ids[1])
