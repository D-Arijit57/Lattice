from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from accounts.models import User


class SignupSerializer(serializers.ModelSerializer):
    # password is write_only: it's accepted on input (signup) but never
    # sent back out in the response - to_representation() drops it.
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["id", "name", "email", "password", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_email(self, value):
        # Explicit check instead of relying on the model's unique=True to
        # surface as a raw IntegrityError from the database. This runs
        # before save(), so a duplicate email fails with a clean 400
        # instead of a 500.
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_password(self, value):
        # validate_password() runs the checks listed in
        # AUTH_PASSWORD_VALIDATORS (settings.py) - length, similarity to
        # the user's own name/email, common-password list, not-all-numeric.
        # It raises Django's ValidationError (not DRF's), with a .messages
        # list, so we translate it into the error shape DRF expects.
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def create(self, validated_data):
        # The default ModelSerializer.create() would call
        # User.objects.create(**validated_data), which stores the password
        # as plain text. create_user() hashes it via set_password()
        # instead (see UserManager in accounts/models.py), so we override
        # create() to call that instead.
        return User.objects.create_user(
            email=validated_data["email"],
            name=validated_data["name"],
            password=validated_data["password"],
        )
