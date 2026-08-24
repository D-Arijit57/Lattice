from django.core.validators import RegexValidator
from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from content.models import ContentType

class CurrentOrganizationDefault:
    # When DRF needs a value don't ask from the client, get it from serializer's context
    requires_context = True

    # When DRF needs the default value for this field, take the organization object stored in the serializer context and return it.
    def __call__(self, serializer_field):
        return serializer_field.context["organization"]


class ContentTypeSerializer(serializers.ModelSerializer):
    # hidden: never accepted from the client, always filled in from context
    organization = serializers.HiddenField(default=CurrentOrganizationDefault())
    organization_id = serializers.IntegerField(read_only=True)
    # our api contract have a separate own validation for the slug
    # since the model doesn't have any specific validation for it
    slug = serializers.CharField(
        max_length=255,
        validators=[
            RegexValidator(
                # allow format : lowercase, hypens, numbers
                regex=r"^[a-z0-9]+(-[a-z0-9]+)*$",
                message="Enter a valid slug",
            )
        ],
    )
    # In a DRF ModelSerializer, the Meta class is basically configuration/instructions for the serializer.
    class Meta:
        model = ContentType
        fields = [
            "id",
            "name",
            "slug",
            "organization",
            "organization_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        validators = [
            UniqueTogetherValidator(
                queryset=ContentType.objects.all(),
                fields=["organization", "slug"],
            )
        ]
