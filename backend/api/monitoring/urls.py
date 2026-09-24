from django.urls import path

from api.monitoring.views import HealthCheckView

# Grouped with future logging/observability config under api/monitoring/,
# not api/auth or api/content - this isn't a business feature, it's
# infrastructure Azure/ops tooling talks to.
urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health-check"),
]
