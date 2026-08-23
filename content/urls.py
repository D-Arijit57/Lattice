from django.urls import path

from content.views import ContentTypeCreateView

urlpatterns = [
    path(
        "organizations/<int:organization_id>/content-types/",
        ContentTypeCreateView.as_view(),
        name="content-type-create",
    ),
]
