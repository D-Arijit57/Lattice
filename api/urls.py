from django.urls import include, path

urlpatterns = [
    path("", include("api.content.urls")),
    path("", include("api.accounts.urls")),
]
