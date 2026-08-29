from django.urls import path
# The ViewSet contains our actions like list(), create(), and retrieve().
# .as_view() connects the HTTP methods to these actions for a specific URL.
# For example: GET → list(), POST → create(), GET with <pk> → retrieve().

from api.content.views import (
    ContentTypeViewSet,
    ContentTypeVersionViewSet,
    EntryViewSet,
)

# Each ViewSet becomes two plain views: one bound to the collection URL
# (list + create) and one bound to the single-item URL (retrieve). The dict
# passed to .as_view() maps an HTTP method to a ViewSet action name - this is
# exactly what a router would have generated, written out by hand so the
# routes stay visible.
content_type_list = ContentTypeViewSet.as_view({"get": "list", "post": "create"})
content_type_detail = ContentTypeViewSet.as_view({"get": "retrieve"})

version_list = ContentTypeVersionViewSet.as_view({"get": "list", "post": "create"})
version_detail = ContentTypeVersionViewSet.as_view({"get": "retrieve"})

entry_list = EntryViewSet.as_view({"get": "list", "post": "create"})
entry_detail = EntryViewSet.as_view({"get": "retrieve"})

urlpatterns = [
    path(
        "organizations/<int:organization_id>/content-types/",
        content_type_list,
        name="content-type-list",
    ),
    path(
        "organizations/<int:organization_id>/content-types/<int:pk>/",
        content_type_detail,
        name="content-type-detail",
    ),
    path(
        "organizations/<int:organization_id>/content-types/<int:content_type_id>/versions/",
        version_list,
        name="content-type-version-list",
    ),
    path(
        "organizations/<int:organization_id>/content-types/<int:content_type_id>/versions/<int:pk>/",
        version_detail,
        name="content-type-version-detail",
    ),
    path(
        "organizations/<int:organization_id>/content-types/<int:content_type_id>/entries/",
        entry_list,
        name="entry-list",
    ),
    path(
        "organizations/<int:organization_id>/content-types/<int:content_type_id>/entries/<int:pk>/",
        entry_detail,
        name="entry-detail",
    ),
]
