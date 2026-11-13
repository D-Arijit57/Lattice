"""
Settings used by pytest (see pytest.ini). Same as the real settings, except the
database: tests run against a LOCAL Postgres, never the hosted one in .env.

pytest-django creates a throwaway database named test_<NAME> next to the one in
the URL, runs the suite in it and drops it, so the URL below only needs to point
at a local server your user can create databases on.

Override with TEST_DATABASE_URL in the environment or in .env, e.g.
    TEST_DATABASE_URL=postgres://myuser:mypassword@localhost:5432/lattice_test
"""
import environ

from .settings import *  # noqa: F401,F403
from .settings import BASE_DIR

_env = environ.Env()
_env.read_env(BASE_DIR / ".env")

DATABASES = {
    "default": _env.db("TEST_DATABASE_URL", default="postgres://localhost:5432/lattice_test"),
}

# Refuse to run if this ever points at a hosted database: a hosted test run
# is slow and, through a connection pooler, leaves sessions behind that block
# the next run.
_host = DATABASES["default"].get("HOST", "")
if _host not in ("", "localhost", "127.0.0.1") and not _host.startswith("/"):
    raise RuntimeError(
        f"Tests must use a local database, but TEST_DATABASE_URL points at {_host!r}."
    )
