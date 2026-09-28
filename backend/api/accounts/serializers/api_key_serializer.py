from rest_framework import serializers
from accounts.models import APIKey

class APIKeySerializer(serializers.ModelSerializer):
    class Meta :
        model = APIKey
        fields = ["id", "name", "created_at", "revoked_at"]
        read_only_fields = fields