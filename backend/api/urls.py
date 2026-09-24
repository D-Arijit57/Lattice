from django.urls import include, path

urlpatterns = [
    path("", include("api.content.urls")),
    path("", include("api.accounts.urls")),
    path("auth/", include("api.auth.urls")),
    path("monitoring/", include("api.monitoring.urls")),
]
