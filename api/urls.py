from django.urls import include, path

urlpatterns = [
    path("", include("content.urls")),
]
