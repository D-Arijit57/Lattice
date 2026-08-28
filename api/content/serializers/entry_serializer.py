from rest_framework import serializers
from content.models import Entry


class CurrentContentTypeVersionDefault:
    requires_context = True

    def __call__(self, serializer_field):
        
        return serializer_field.context["content_type_version"]


class EntrySerializer(serializers.ModelSerializer):
    # never accepted from the client, always filled in from context
    # (the view already resolved and verified the latest version)
    content_type_version = serializers.HiddenField(default=CurrentContentTypeVersionDefault())
    content_type_version_id = serializers.IntegerField(read_only=True)

    # the actual entry payload; any JSON object for now, no schema check yet
    data = serializers.JSONField()

    class Meta:
        model = Entry
        fields = [
            "id",
            "content_type_version",
            "content_type_version_id",
            "data",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
