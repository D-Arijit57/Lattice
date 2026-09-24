from django.db import connection
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status


class HealthCheckView(APIView):
    # Skips JWT auth entirely - Azure's own infrastructure polls this, not a
    # logged-in user, and a garbage/expired cookie should never be able to
    # turn a healthy container into a 401.
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            # Cheapest possible real round-trip to Postgres: no table, no
            # rows, just proves the connection itself is alive.
            # temporarily give Django a broken database address for one single test run, without touching your real .env file at all.
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except Exception:
            # 503: the app itself didn't break, a dependency
            # (Postgres) is unreachable - lets Azure/monitoring tell "bug
            # in our code" apart from "dependency is down".
            return Response(
                {"status": "unhealthy"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({"status": "healthy"}, status=status.HTTP_200_OK)
