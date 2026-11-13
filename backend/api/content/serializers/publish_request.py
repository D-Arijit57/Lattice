from rest_framework import serializers

from content.models import PublishRequest


class PublishRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.SerializerMethodField()
    decided_by_name = serializers.SerializerMethodField()
    version_number = serializers.IntegerField(
        source="version.version_number", read_only=True, default=None
    )
    # what the draft changes compared with the latest published version. Only
    # filled for a pending request, and only on retrieve, since it is computed
    # from the live fields at the moment you ask.
    diff = serializers.SerializerMethodField()

    class Meta:
        model = PublishRequest
        fields = [
            "id", "content_type_id", "note", "status",
            "requested_by", "requested_by_name",
            "decided_by", "decided_by_name", "decision_note",
            "version_number", "diff", "created_at", "decided_at",
        ]
        read_only_fields = [f for f in fields if f != "note"]

    def get_requested_by_name(self, obj):
        return obj.requested_by.name if obj.requested_by else None

    def get_decided_by_name(self, obj):
        return obj.decided_by.name if obj.decided_by else None

    def get_diff(self, obj):
        return self.context.get("diffs", {}).get(obj.pk)


class DecisionSerializer(serializers.Serializer):
    decision_note = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class RejectionSerializer(serializers.Serializer):
    # a rejection must say why, so the editor knows what to fix
    decision_note = serializers.CharField(max_length=500)

    def validate_decision_note(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Please say why this was rejected.")
        return value
