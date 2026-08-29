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
    # which schema version this entry is bound to - handy on read responses so
    # a client doesn't need a second call to the version endpoint to find out
    version_number = serializers.IntegerField(
        source="content_type_version.version_number",
        read_only=True,
    )

    # the actual entry payload; any JSON object for now, no schema check yet
    data = serializers.JSONField()

    class Meta:
        model = Entry
        fields = [
            "id",
            "content_type_version",
            "content_type_version_id",
            "version_number",
            "data",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
