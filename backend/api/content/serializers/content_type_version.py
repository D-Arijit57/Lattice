from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from content.models import ContentTypeVersion
from content.services.versioning import create_content_type_version

class CurrentContentTypeDefault :
    requires_context = True

    def __call__(self, serializer_field) :
        return serializer_field.context["content_type"]

class ContentTypeVersionSerializer(serializers.ModelSerializer):
    # hidden: never accepted from the client, always filled in from context
    # (the view already resolved and verified this content_type)
    content_type = serializers.HiddenField(default=CurrentContentTypeDefault())
    content_type_id = serializers.IntegerField(read_only=True)

    # generated server-side from this ContentType's Fields (Decision 20:
    # Fields are the single source of truth) - read-only, never accepted
    # from the client anymore.
    schema = serializers.JSONField(read_only=True)
    version_number = serializers.IntegerField(read_only=True)

    class Meta:
        model = ContentTypeVersion
        fields = [
            "id",
            "content_type",
            "content_type_id",
            "version_number",
            "schema",
            "created_at"
        ]
        read_only_fields = ["id", "created_at", "schema"]
        validators = [
            UniqueTogetherValidator(
                queryset=ContentTypeVersion.objects.all(),
                fields=["content_type", "version_number"],
            )
        ]
        
    # this doesn't execute during serializer.is_valid()
    # using the content_versioning service
    def create(self, validated_data):
        # create_content_type_version() raises Django's ValidationError
        # (not DRF's) when the ContentType has no Fields yet - same
        # translate-then-reraise pattern as SignupSerializer.validate_password.
        try:
            return create_content_type_version(
                content_type=validated_data["content_type"],
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
