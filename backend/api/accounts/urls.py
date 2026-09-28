from django.urls import path

from api.accounts.views import OrganizationScopedViewSet, APIKeyViewSet

# One ViewSet becomes two plain views: one bound to the collection URL
# (list + create) and one bound to the single-item URL (retrieve). The dict
# passed to .as_view() maps an HTTP method to a ViewSet action name - the
# same thing a router would generate, written out by hand so the routes
# stay visible.
organization_list = OrganizationScopedViewSet.as_view({"get": "list", "post": "create"})
organization_detail = OrganizationScopedViewSet.as_view({"get": "retrieve"})
api_key_list = APIKeyViewSet.as_view({"get": "list", "post": "create"})
api_key_detail = APIKeyViewSet.as_view({"delete": "destroy"})
urlpatterns = [
    path(
        "organizations/",
        organization_list,
        name="organization-list",
    ),
    path(
        "organizations/<int:pk>/",
        organization_detail,
        name="organization-detail",
    ),
    path(
        "organizations/<int:organization_id>/api-keys/", 
        api_key_list,
        name="api-key-list"
    ),
    path(
        "organizations/<int:organization_id>/api-keys/<int:pk>/", 
        api_key_detail, 
        name="api-key-detail"
    ),
]
