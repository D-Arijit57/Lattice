from django.urls import path

from api.accounts.member_views import (
    InvitationViewSet,
    MemberViewSet,
    MyInvitationViewSet,
    UserSearchViewSet,
)
from api.accounts.notification_views import NotificationViewSet
from api.accounts.views import OrganizationScopedViewSet, APIKeyViewSet

# One ViewSet becomes two plain views: one bound to the collection URL
# (list + create) and one bound to the single-item URL (retrieve). The dict
# passed to .as_view() maps an HTTP method to a ViewSet action name - the
# same thing a router would generate, written out by hand so the routes
# stay visible.
organization_list = OrganizationScopedViewSet.as_view({"get": "list", "post": "create"})
organization_detail = OrganizationScopedViewSet.as_view(
    {"get": "retrieve", "delete": "archive"}
)
api_key_list = APIKeyViewSet.as_view({"get": "list", "post": "create"})
api_key_detail = APIKeyViewSet.as_view({"delete": "destroy"})
member_list = MemberViewSet.as_view({"get": "list"})
member_detail = MemberViewSet.as_view({"patch": "partial_update", "delete": "destroy"})
member_transfer = MemberViewSet.as_view({"post": "transfer_ownership"})
user_search = UserSearchViewSet.as_view({"get": "list"})
invitation_list = InvitationViewSet.as_view({"get": "list", "post": "create"})
invitation_detail = InvitationViewSet.as_view({"delete": "destroy"})
my_invitation_list = MyInvitationViewSet.as_view({"get": "list"})
my_invitation_accept = MyInvitationViewSet.as_view({"post": "accept"})
my_invitation_decline = MyInvitationViewSet.as_view({"post": "decline"})

notification_list = NotificationViewSet.as_view({"get": "list"})
notification_unread_count = NotificationViewSet.as_view({"get": "unread_count"})
notification_read = NotificationViewSet.as_view({"post": "mark_read"})
notification_read_all = NotificationViewSet.as_view({"post": "read_all"})

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
    path("organizations/<int:organization_id>/members/", member_list, name="member-list"),
    path("organizations/<int:organization_id>/members/<int:pk>/", member_detail, name="member-detail"),
    path(
        "organizations/<int:organization_id>/members/<int:pk>/transfer-ownership/",
        member_transfer,
        name="member-transfer-ownership",
    ),
    path("organizations/<int:organization_id>/user-search/", user_search, name="user-search"),
    path("organizations/<int:organization_id>/invitations/", invitation_list, name="invitation-list"),
    path(
        "organizations/<int:organization_id>/invitations/<int:pk>/",
        invitation_detail,
        name="invitation-detail",
    ),
    path("invitations/", my_invitation_list, name="my-invitation-list"),
    path("invitations/<int:pk>/accept/", my_invitation_accept, name="my-invitation-accept"),
    path("invitations/<int:pk>/decline/", my_invitation_decline, name="my-invitation-decline"),
    path("notifications/", notification_list, name="notification-list"),
    path("notifications/unread-count/", notification_unread_count, name="notification-unread-count"),
    path("notifications/read-all/", notification_read_all, name="notification-read-all"),
    path("notifications/<int:pk>/read/", notification_read, name="notification-read"),
]
