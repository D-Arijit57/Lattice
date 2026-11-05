from rest_framework import serializers
from content.models import Entry
from content.services.entry_validation import validate_entry_data


# One bulk request has to finish inside the server's request timeout, so the
# batch size is capped. The frontend enforces the same number (MAX_BULK_ROWS
# in frontend/src/lib/csv.ts).
MAX_BULK_ENTRIES = 500


class BulkEntrySerializer(serializers.Serializer):
    """
    Shape of a bulk create body: {"entries": [{...data}, {...data}]}.

    This only checks the envelope (a non-empty list, within the cap, of JSON
    objects). Each row's contents are checked against the schema by the view
    with validate_entry_data(), so errors can be reported per row index.
    """

    entries = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        max_length=MAX_BULK_ENTRIES,
    )


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
            "number",
            "content_type_version",
            "content_type_version_id",
            "version_number",
            "data",
            "created_at",
            "updated_at",
            "archived_at",
        ]
        read_only_fields = ["id", "number", "created_at", "updated_at", "archived_at"]
