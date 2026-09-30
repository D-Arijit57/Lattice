#!/bin/sh
set -e

# Apply pending migrations before serving. set -e aborts the container if
# this fails, so a broken migration never boots a server on a stale schema.
python manage.py migrate --noinput

# Replace this shell with the CMD (gunicorn) so it receives SIGTERM directly
# and shuts down cleanly when the container stops.
exec "$@"
