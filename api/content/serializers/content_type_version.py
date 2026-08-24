from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from content.models import ContentTypeVersion
    
class CurrentContentTypeDefault : 
    requires_context = True
    
    def __call__(self, serializer_field) : 
        return serializer_field.context["content_type"]
     
class ContentTypeVersionSerializer(serializers.ModelSerializer):
    # hidden: never accepted from the client, always filled in from context
    # (the view already resolved and verified this content_type)
    content_type = serializers.HiddenField(default=CurrentContentTypeDefault())
    content_type_id = serializers.IntegerField(read_only=True)

    schema = serializers.JSONField()
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
        read_only_fields = ["id", "created_at"]
        validators = [
            UniqueTogetherValidator(
                queryset=ContentTypeVersion.objects.all(),
                fields=["content_type", "version_number"],
            )
        ]
