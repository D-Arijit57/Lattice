from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, permissions, viewsets, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from accounts.models import Organization, OrganizationMembership, APIKey, hash_api_key
from api.accounts.serializers.org_serializer import OrganizationSerializer
from api.accounts.serializers.api_key_serializer import APIKeySerializer
import secrets

# Placeholder until a real Role model exists. The person who creates an
# organization is stored as its first member with this role id.
OWNER_ROLE_ID = 1


class OrganizationScopedViewSet(
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
        
class APIKeyViewSet(OrganizationScopedViewSet, mixins.DestroyModelMixin):
    serializer_class = APIKeySerializer

    def get_organization(self):
        # This OrganizationScopedViewSet (defined above, in this file) has no
        # <organization_id> URL segment - it's the base for /organizations/
        # itself - so it doesn't define get_organization(). API keys live
        # under /organizations/<organization_id>/api-keys/, so this ViewSet
        # needs its own 404-then-403 lookup, same shape as the one in
        # api/content/views.py.
        if not hasattr(self, "_organization"):
            try:
                organization = Organization.objects.get(
                    pk=self.kwargs["organization_id"]
                )
            except Organization.DoesNotExist:
                raise NotFound("Organization not found.")

            is_member = OrganizationMembership.objects.filter(
                user=self.request.user,
                organization=organization,
            ).exists()
            if not is_member:
                raise PermissionDenied(
                    "You are not a member of this organization."
                )

            self._organization = organization
        return self._organization

    def get_queryset(self):
        return APIKey.objects.filter(
            organization = self.get_organization()
        ).order_by("-created_at")
    
    def create(self, request, *args, **kwargs):
        raw_key = "lat_" + secrets.token_urlsafe(32)
        api_key = APIKey.objects.create(
            organization = self.get_organization(),
            name = request.data.get("name",""),
            hashed_key = hash_api_key(raw_key),
        )
        data = APIKeySerializer(api_key).data
        data["key"] = raw_key
        return Response(data, status= status.HTTP_201_CREATED)
    
    def perform_destroy(self, instance):
        instance.revoked_at = timezone.now()
        instance.save()