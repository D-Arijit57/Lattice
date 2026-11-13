from rest_framework import serializers

from accounts.models import Invitation, OrganizationMembership, Role, User
from api.accounts.rules import roles_you_can_invite

# roles that can be assigned by hand; OWNER only changes through a transfer
ASSIGNABLE_ROLES = [Role.VIEWER, Role.EDITOR, Role.ADMIN]


class MemberSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(source="user.name", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = OrganizationMembership
        fields = ["id", "user_id", "name", "email", "role_id", "created_at"]
        read_only_fields = fields


class RoleChangeSerializer(serializers.Serializer):
    role_id = serializers.ChoiceField(choices=ASSIGNABLE_ROLES)


class UserSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "name", "email"]
        read_only_fields = fields


class InvitationSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    invited_user_name = serializers.CharField(source="invited_user.name", read_only=True)
    invited_user_email = serializers.CharField(source="invited_user.email", read_only=True)
    invited_by_name = serializers.CharField(source="invited_by.name", read_only=True)

    class Meta:
        model = Invitation
        fields = [
            "id", "organization", "organization_name",
            "invited_user", "invited_user_name", "invited_user_email",
            "invited_by_name", "role_id", "status", "created_at", "responded_at",
        ]
        read_only_fields = [f for f in fields if f not in ("invited_user", "role_id")]

    def validate_role_id(self, value):
        # context["inviter_role"] is set by the view
        if value not in roles_you_can_invite(self.context["inviter_role"]):
            raise serializers.ValidationError("You cannot invite someone with this role.")
        return value

    def validate_invited_user(self, user):
        organization = self.context["organization"]
        if not user.is_active:
            raise serializers.ValidationError("This user cannot be invited.")
        if OrganizationMembership.objects.filter(organization=organization, user=user).exists():
            raise serializers.ValidationError("This user is already a member.")
        if Invitation.objects.filter(
            organization=organization, invited_user=user, status=Invitation.Status.PENDING
        ).exists():
            raise serializers.ValidationError("This user already has a pending invitation.")
        return user
