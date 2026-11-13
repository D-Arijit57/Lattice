from django.urls import path
# The ViewSet contains our actions like list(), create(), and retrieve().
# .as_view() connects the HTTP methods to these actions for a specific URL.
# For example: GET → list(), POST → create(), GET with <pk> → retrieve().

from api.content.publish_views import PublishRequestViewSet
from api.content.views import (
    ContentTypeViewSet,
    ContentTypeVersionViewSet,
    EntryViewSet,
    FieldViewSet,
)

# Each ViewSet becomes two plain views: one bound to the collection URL
# (list + create) and one bound to the single-item URL (retrieve). The dict
# passed to .as_view() maps an HTTP method to a ViewSet action name - this is
# exactly what a router would have generated, written out by hand so the
# routes stay visible.
content_type_list = ContentTypeViewSet.as_view({"get": "list", "post": "create"})
content_type_detail = ContentTypeViewSet.as_view({"get": "retrieve", "delete": "archive"})

version_list = ContentTypeVersionViewSet.as_view({"get": "list", "post": "create"})
version_detail = ContentTypeVersionViewSet.as_view({"get": "retrieve"})

entry_list = EntryViewSet.as_view(
    {"get": "list", "post": "create", "delete": "archive_all"}
)
entry_detail = EntryViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "archive"}
)
entry_restore = EntryViewSet.as_view({"post": "restore"})
entry_bulk_create = EntryViewSet.as_view({"post": "bulk_create"})

field_list = FieldViewSet.as_view({"get": "list", "post": "create"})
field_detail = FieldViewSet.as_view({"get": "retrieve", "delete": "archive"})

publish_request_list = PublishRequestViewSet.as_view({"get": "list", "post": "create"})
publish_request_detail = PublishRequestViewSet.as_view({"get": "retrieve", "delete": "cancel"})
publish_request_approve = PublishRequestViewSet.as_view({"post": "approve"})
publish_request_reject = PublishRequestViewSet.as_view({"post": "reject"})

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
        "organizations/<int:organization_id>/content-types/<int:content_type_id>/entries/bulk/",
        entry_bulk_create,
        name="entry-bulk-create",
    ),
    path(
        "organizations/<int:organization_id>/content-types/<int:content_type_id>/entries/<int:pk>/",
        entry_detail,
        name="entry-detail",
    ),
    path(
        "organizations/<int:organization_id>/content-types/<int:content_type_id>/entries/<int:pk>/restore/",
        entry_restore,
        name="entry-restore",
    ),
    path(
        "organizations/<int:organization_id>/content-types/<int:content_type_id>/fields/",
        field_list,
        name="field-list",
    ),
    path(
        "organizations/<int:organization_id>/content-types/<int:content_type_id>/fields/<int:pk>/",
        field_detail,
        name="field-detail",
    ),
    path(
        "organizations/<int:organization_id>/content-types/<int:content_type_id>/publish-requests/",
        publish_request_list,
        name="publish-request-list",
    ),
    path(
        "organizations/<int:organization_id>/content-types/<int:content_type_id>/publish-requests/<int:pk>/",
        publish_request_detail,
        name="publish-request-detail",
    ),
    path(
        "organizations/<int:organization_id>/content-types/<int:content_type_id>/publish-requests/<int:pk>/approve/",
        publish_request_approve,
        name="publish-request-approve",
    ),
    path(
        "organizations/<int:organization_id>/content-types/<int:content_type_id>/publish-requests/<int:pk>/reject/",
        publish_request_reject,
        name="publish-request-reject",
    ),
]
