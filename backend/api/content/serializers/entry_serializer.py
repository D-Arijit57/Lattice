from rest_framework import serializers
from content.models import Entry
from content.services.entry_validation import validate_entry_data


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

    # the actual entry payload; JSONField only guarantees well-formed JSON,
    # the shape is checked in validate_data() below
    data = serializers.JSONField()

    def validate_data(self, value):
        # validate against the *pinned* version's stored schema (the same
        # version the view resolved and this entry will be saved under),
        # never the live Fields - Fields can change after that version was cut
        schema = self.context["content_type_version"].schema
        # the service returns {field: [messages]}; empty means valid
        errors = validate_entry_data(schema, value)
        if errors:
            # DRF nests this under "data" on its own, so the response is
            # {"data": {"price": ["Must be a number."]}}
            raise serializers.ValidationError(errors)
        return value

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
