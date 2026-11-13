from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from accounts.models import (
    Invitation,
    Notification,
    Organization,
    OrganizationMembership,
    Role,
    User,
)
from accounts.services.notifications import notify
from api.accounts.rules import can_remove
from api.accounts.serializers.member_serializers import (
    InvitationSerializer,
    MemberSerializer,
    RoleChangeSerializer,
    UserSearchSerializer,
)

SEARCH_MIN_CHARS = 2
SEARCH_MAX_RESULTS = 5


class OrgRoleMixin:
    """
    Shared by the viewsets nested under /organizations/<organization_id>/...
    Same flow as content/views.py: 404 for a missing or archived org, 403 for
    a non-member, then check_role() decides by role, all before the body is
    validated.
    """

    permission_classes = [permissions.IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.check_role()

    def check_role(self):
        """Overridden by each viewset."""

    def get_organization(self):
        if not hasattr(self, "_organization"):
            try:
                organization = Organization.objects.get(
                    pk=self.kwargs["organization_id"], archived_at__isnull=True
                )
            except Organization.DoesNotExist:
                raise NotFound("Organization not found.")
            membership = OrganizationMembership.objects.filter(
                user=self.request.user, organization=organization
            ).first()
            if membership is None:
                raise PermissionDenied("You are not a member of this organization.")
            self._organization = organization
            self._membership = membership
        return self._organization

    def require_role(self, minimum_role):
        self.get_organization()
        if self._membership.role_id < minimum_role:
            raise PermissionDenied("Your role does not allow this action.")


class MemberViewSet(
    OrgRoleMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    list               -> GET    /organizations/<org>/members/                          (admin+)
    partial_update     -> PATCH  /organizations/<org>/members/<pk>/   {role_id}         (owner)
    destroy            -> DELETE /organizations/<org>/members/<pk>/                     (admin+, see can_remove)
    transfer_ownership -> POST   /organizations/<org>/members/<pk>/transfer-ownership/  (owner)
    """

    serializer_class = MemberSerializer

    def check_role(self):
        if self.action in ("list", "destroy"):
            self.require_role(Role.ADMIN)
        elif self.action in ("partial_update", "transfer_ownership"):
            self.require_role(Role.OWNER)

    def get_queryset(self):
        return (
            OrganizationMembership.objects
            .filter(organization=self.get_organization())
            .select_related("user")
            .order_by("-role_id", "user__name", "id")
        )

    def partial_update(self, request, *args, **kwargs):
        membership = self.get_object()
        if membership.role_id == Role.OWNER:
            raise ValidationError(
                {"detail": "The owner's role changes through an ownership transfer."}
            )
        serializer = RoleChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership.role_id = serializer.validated_data["role_id"]
        membership.save(update_fields=["role_id", "updated_at"])
        return Response(MemberSerializer(membership).data)

    def destroy(self, request, *args, **kwargs):
        membership = self.get_object()
        if not can_remove(self._membership.role_id, membership.role_id):
            raise PermissionDenied("You cannot remove this member.")
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def transfer_ownership(self, request, *args, **kwargs):
        target = self.get_object()
        if target.pk == self._membership.pk:
            raise ValidationError({"detail": "You are already the owner."})
        with transaction.atomic():
            # lock both rows so two transfers cannot interleave
            rows = {
                m.pk: m
                for m in OrganizationMembership.objects.select_for_update().filter(
                    pk__in=[target.pk, self._membership.pk]
                )
            }
            rows[target.pk].role_id = Role.OWNER
            rows[self._membership.pk].role_id = Role.ADMIN
            for membership in rows.values():
                membership.save(update_fields=["role_id", "updated_at"])
        return Response(MemberSerializer(rows[target.pk]).data)


class UserSearchViewSet(OrgRoleMixin, viewsets.GenericViewSet):
    """
    list -> GET /organizations/<org>/user-search/?q=ada   (admin+)

    Finds registered users who are not yet members. Deliberately narrow: at
    least 2 characters and at most 5 results, so it cannot be used to list
    everyone on the platform.
    """

    def check_role(self):
        self.require_role(Role.ADMIN)

    def list(self, request, *args, **kwargs):
        query = request.query_params.get("q", "").strip()
        if len(query) < SEARCH_MIN_CHARS:
            raise ValidationError(
                {"q": f"Type at least {SEARCH_MIN_CHARS} characters."}
            )
        users = (
            User.objects
            .filter(is_active=True)
            .filter(Q(name__icontains=query) | Q(email__icontains=query))
            .exclude(memberships__organization=self.get_organization())
            .order_by("name", "id")[:SEARCH_MAX_RESULTS]
        )
        return Response(UserSearchSerializer(users, many=True).data)


class InvitationViewSet(
    OrgRoleMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """
    list    -> GET    /organizations/<org>/invitations/       pending ones (admin+)
    create  -> POST   /organizations/<org>/invitations/       {invited_user, role_id} (admin+)
    destroy -> DELETE /organizations/<org>/invitations/<pk>/  cancels a pending one (admin+)
    """

    serializer_class = InvitationSerializer

    def check_role(self):
        self.require_role(Role.ADMIN)

    def get_queryset(self):
        return (
            Invitation.objects
            .filter(organization=self.get_organization(), status=Invitation.Status.PENDING)
            .select_related("organization", "invited_user", "invited_by")
            .order_by("-created_at")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        self.get_organization()
        context["organization"] = self._organization
        context["inviter_role"] = self._membership.role_id
        return context

    def perform_create(self, serializer):
        with transaction.atomic():
            invitation = serializer.save(
                organization=self.get_organization(), invited_by=self.request.user
            )
            notify(
                [invitation.invited_user],
                Notification.Kind.INVITATION,
                f"{self.request.user.name} invited you to join "
                f"{invitation.organization.name} as {Role(invitation.role_id).label}.",
                organization=invitation.organization,
                payload={"invitation_id": invitation.pk, "organization_id": invitation.organization_id},
            )

    def perform_destroy(self, instance):
        # keep the row as history instead of deleting it
        instance.status = Invitation.Status.CANCELLED
        instance.responded_at = timezone.now()
        instance.save(update_fields=["status", "responded_at"])


class MyInvitationViewSet(
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    The invitee's side. Needs only a login, and only ever shows the caller's own
    invitations.

    list    -> GET  /invitations/
    accept  -> POST /invitations/<pk>/accept/
    decline -> POST /invitations/<pk>/decline/
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = InvitationSerializer

    def get_queryset(self):
        return (
            Invitation.objects
            .filter(
                invited_user=self.request.user,
                status=Invitation.Status.PENDING,
                organization__archived_at__isnull=True,
            )
            .select_related("organization", "invited_user", "invited_by")
            .order_by("-created_at")
        )

    def accept(self, request, *args, **kwargs):
        invitation = self.get_object()
        with transaction.atomic():
            invitation = Invitation.objects.select_for_update().get(pk=invitation.pk)
            if invitation.status != Invitation.Status.PENDING:
                raise ValidationError({"detail": "This invitation is no longer pending."})
            _, created = OrganizationMembership.objects.get_or_create(
                organization=invitation.organization,
                user=request.user,
                defaults={"role_id": invitation.role_id},
            )
            if not created:
                raise ValidationError({"detail": "You are already a member."})
            invitation.status = Invitation.Status.ACCEPTED
            invitation.responded_at = timezone.now()
            invitation.save(update_fields=["status", "responded_at"])
        return Response(InvitationSerializer(invitation).data)

    def decline(self, request, *args, **kwargs):
        invitation = self.get_object()
        invitation.status = Invitation.Status.DECLINED
        invitation.responded_at = timezone.now()
        invitation.save(update_fields=["status", "responded_at"])
        return Response(InvitationSerializer(invitation).data)
