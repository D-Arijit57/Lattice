from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator

from content.models import Field
from api.content.serializers.content_type_version import CurrentContentTypeDefault

# V1 data types a Field can declare. Kept as a plain module-level set (not a
# model.TextChoices) so it lives next to the validation that uses it -
# schema generation (next task) will need this same list to map each value
# to a JSON Schema type.
ALLOWED_DATA_TYPES = {"string", "number", "boolean", "date"}


class FieldSerializer(serializers.ModelSerializer):
    # hidden: never accepted from the client, always filled in from context
    # (the view already resolved and verified this content_type) - reuses
    # the same default class ContentTypeVersionSerializer uses, since both
    # read context["content_type"] the same way.
    content_type = serializers.HiddenField(default=CurrentContentTypeDefault())
    content_type_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Field
        fields = [
            "id",
            "content_type",
            "content_type_id",
            "name",
            "data_type",
            "required",
        ]
        read_only_fields = ["id"]
        validators = [
            UniqueTogetherValidator(
                queryset=Field.objects.all(),
                fields=["content_type", "name"],
            )
        ]

    def validate_data_type(self, value):
        if value not in ALLOWED_DATA_TYPES:
            raise serializers.ValidationError(
                f"data_type must be one of: {', '.join(sorted(ALLOWED_DATA_TYPES))}."
            )
        return value
