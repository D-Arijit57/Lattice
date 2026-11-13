from rest_framework import serializers
from accounts.models import Organization, OrganizationMembership


class OrganizationSerializer(serializers.ModelSerializer):
    # ModelSerializer looks at the model named in Meta and builds the
    # field list for us. We only spell fields out here when we want to
    # change their behaviour (make them read-only, rename, nest, etc.).

    # The caller's role in this organization (0 viewer .. 3 owner). Read-only.
    my_role = serializers.SerializerMethodField()

    def get_my_role(self, organization):
        # The list view annotates this in its query. A freshly created or
        # retrieved org may not have it, so fall back to one lookup.
        role = getattr(organization, "my_role", None)
        if role is None:
            membership = OrganizationMembership.objects.filter(
                organization=organization, user=self.context["request"].user
            ).first()
            role = membership.role_id if membership else None
        return role

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "my_role",
            "created_at",
            "updated_at",
        ]
        # the client sends "name" on create; everything else is
        # filled in by the database / Django, never by the request
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value):
        # DRF already rejects a missing name and an empty string "".
        # This also trims surrounding whitespace and rejects a name that
        # is nothing but spaces, so "   " does not become a real org.
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Name cannot be blank.")
        return name

