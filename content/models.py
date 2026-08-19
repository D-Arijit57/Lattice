from django.db import models

from accounts.models import Organization


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
