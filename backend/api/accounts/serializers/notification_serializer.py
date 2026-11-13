from rest_framework import serializers

from accounts.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "kind", "message", "payload", "organization", "is_read", "read_at", "created_at"]
        read_only_fields = fields

    def get_is_read(self, obj):
        return obj.read_at is not None
