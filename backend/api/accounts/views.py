from django.db import transaction
from django.db.models import OuterRef, Subquery
from django.utils import timezone
from rest_framework import mixins, permissions, viewsets, status
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from accounts.models import Organization, OrganizationMembership, APIKey, hash_api_key
from api.accounts.serializers.org_serializer import OrganizationSerializer
from api.accounts.serializers.api_key_serializer import APIKeySerializer
from accounts.models import Role
import secrets


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
    archive  -> DELETE /organizations/<pk>/   (soft delete)
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
                role_id=Role.OWNER,
            )


    def get_queryset(self):
        # Reverse-relation lookup: OrganizationMembership.organization has
        # related_name="memberships", so we can filter Organization by
        # walking backwards across that FK to the requesting user.
        # my_role: the caller's role in each org, computed in the same query,
        # so the frontend can show or hide buttons without extra requests.
        my_role = (
            OrganizationMembership.objects
            .filter(organization=OuterRef("pk"), user=self.request.user)
            .values("role_id")[:1]
        )
        return (
            Organization.objects
            .filter(memberships__user=self.request.user, archived_at__isnull=True)
            .annotate(my_role=Subquery(my_role))
            .order_by("name")
        )

    def archive(self, request, *args, **kwargs):
        # get_object() goes through get_queryset(), so only a live organization
        # the caller is a member of can be found: anything else is a 404.
        # Only an owner may archive the organization. get_object() runs first,
        # so someone who is not a member still gets a 404, not a 403.
        organization = self.get_object()
        membership = OrganizationMembership.objects.get(
            user=request.user, organization=organization
        )
        if membership.role_id < Role.OWNER:
            raise PermissionDenied("Only an owner can delete the organization.")
        organization.archived_at = timezone.now()
        organization.save(update_fields=["archived_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

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
                    pk=self.kwargs["organization_id"],
                    archived_at__isnull=True,
                )
            except Organization.DoesNotExist:
                raise NotFound("Organization not found.")

            membership = OrganizationMembership.objects.filter(
                user=self.request.user,
                organization=organization,
            ).first()
            if membership is None:
                raise PermissionDenied(
                    "You are not a member of this organization."
                )

            self._organization = organization
            self._membership = membership
        return self._organization

    def initial(self, request, *args, **kwargs):
        # Runs after authentication but before the body is validated.
        super().initial(request, *args, **kwargs)
        self.check_role()

    def check_role(self):
        # Managing API keys (list, create, revoke) is ADMIN or higher.
        self.get_organization()  # 404 / not-a-member first
        if self._membership.role_id < Role.ADMIN:
            raise PermissionDenied("Your role does not allow this action.")

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