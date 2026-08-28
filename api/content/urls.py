from django.urls import path

from api.content.views import ContentTypeCreateView
from api.content.views import ContentTypeVersionCreateView
from api.content.views import EntryCreateView

urlpatterns = [
    path(
        "organizations/<int:organization_id>/content-types/",
        ContentTypeCreateView.as_view(),
        name="content-type-create",
    ),
    path(
        "organizations/<int:organization_id>/content_types/<int:content_type_id>/content_type_versions/",
        ContentTypeVersionCreateView.as_view(),
        name = "content-type-version-create",
    ),
    path(
        "organizations/<int:organization_id>/content_types/<int:content_type_id>/entries/",
        EntryCreateView.as_view(),
        name="entry-create",
    ),
]
