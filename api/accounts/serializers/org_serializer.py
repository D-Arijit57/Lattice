from rest_framework import serializers
from accounts.models import Organization


class OrganizationSerializer(serializers.ModelSerializer):
    # ModelSerializer looks at the model named in Meta and builds the
    # field list for us. We only spell fields out here when we want to
    # change their behaviour (make them read-only, rename, nest, etc.).

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
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

