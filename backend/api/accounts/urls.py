from django.urls import path

from api.accounts.views import OrganizationViewSet

# One ViewSet becomes two plain views: one bound to the collection URL
# (list + create) and one bound to the single-item URL (retrieve). The dict
# passed to .as_view() maps an HTTP method to a ViewSet action name - the
# same thing a router would generate, written out by hand so the routes
# stay visible.
organization_list = OrganizationViewSet.as_view({"get": "list", "post": "create"})
organization_detail = OrganizationViewSet.as_view({"get": "retrieve"})

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
]
