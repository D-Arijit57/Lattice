from django.db import models

from accounts.models import Organization

# Content Type
class ContentType(models.Model):
    # organization represents the relatioship in Django's object model here, while organization_id is the physical foreign key column django creates in the relational database
    # so doing content.organization_id returns you the primary key value instead of the related object
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="content_types",
    )
    name = models.CharField(max_length=255)
    slug = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "slug"],
                name="unique_organization_slug",
            ),
        ]

    def __str__(self):
        return self.name

# Content versioning
class ContentTypeVersion(models.Model):
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.PROTECT,
        related_name="versions",
    )
    version_number = models.IntegerField()
    schema = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["content_type", "version_number"],
                name="unique_content_type_version",
            ),
        ]

    def __str__(self):
        return f"{self.content_type} v{self.version_number}"


# Entries
class Entry(models.Model):
    content_type_version = models.ForeignKey(
        ContentTypeVersion,
        on_delete=models.PROTECT,
        related_name="entries",
    )
    data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Entry #{self.id} ({self.content_type_version.content_type})"

# Fields
class Field(models.Model):
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.PROTECT,
        related_name="fields"
    )
    name = models.CharField(max_length=255)
    data_type = models.CharField(max_length=255)
    required = models.BooleanField(default = True)
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["content_type", "name"],
                name="unique_content_field",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.content_type})"