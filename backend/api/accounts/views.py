from django.db import transaction
from rest_framework import mixins, permissions, viewsets

from accounts.models import Organization, OrganizationMembership
from api.accounts.serializers.org_serializer import OrganizationSerializer


# Placeholder until a real Role model exists. The person who creates an
# organization is stored as its first member with this role id.
OWNER_ROLE_ID = 1


class OrganizationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """
    list     -> GET  /organizations/
    retrieve -> GET  /organizations/<pk>/
    create   -> POST /organizations/
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrganizationSerializer
    def perform_create(self, serializer):
        # A create here writes two rows: the Organization itself, and an
        # OrganizationMembership that makes the caller its first member 
        # Without that membership row, get_queryset() would immediately hide
        # the new org from the person who just created it.
        # transaction.atomic() ties the two INSERTs together: if the
        # membership insert fails, the organization insert is rolled back too
        # so we never leave an unreachable org row behind.
        with transaction.atomic():
            organization = serializer.save()
            OrganizationMembership.objects.create(
                user=self.request.user,
                organization=organization,
                role_id=OWNER_ROLE_ID,
            )


    def get_queryset(self):
        # Reverse-relation lookup: OrganizationMembership.organization has
        # related_name="memberships", so we can filter Organization by
        # walking backwards across that FK to the requesting user.
        return (
            Organization.objects
            .filter(memberships__user=self.request.user)
            .order_by("name")
        )
