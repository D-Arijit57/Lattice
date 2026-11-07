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
    # Soft delete: NULL = live. Archived content types are hidden from the API
    # and the delivery API; their versions and entries are kept.
    archived_at = models.DateTimeField(null=True, blank=True, editable=False)

    class Meta:
        constraints = [
            # Only live rows must be unique, so a slug can be reused once the
            # content type that held it has been archived.
            models.UniqueConstraint(
                fields=["organization", "slug"],
                condition=models.Q(archived_at__isnull=True),
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
    # Denormalized copy of content_type_version.content_type, kept in sync by
    # save(). It exists so "newest entries of a content type" can filter on one
    # column of this table; going through the version needs a join, which stops
    # Postgres from reading the index in sorted order (see the index below).
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.PROTECT,
        related_name="entries",
        editable=False,
    )
    # Per-content-type sequence (1, 2, 3...), assigned under a lock in
    # EntryViewSet.perform_create. Nullable only until the backfill migration
    # has numbered existing rows; made NOT NULL + unique afterwards.
    number = models.PositiveIntegerField(null=True, editable=False)
    data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Soft delete: NULL = live. Archived entries are hidden from lists and the
    # delivery API but kept (and keep their number), so they can be restored.
    archived_at = models.DateTimeField(null=True, blank=True, editable=False)

    class Meta:
        indexes = [
            # Serves "entries of a content type, oldest first": filter on
            # content_type, then read rows already sorted number ASC, id ASC, so
            # a list page reads ~51 index entries instead of scanning and
            # sorting the table. Must mirror EntryCursorPagination.ordering.
            models.Index(
                fields=["content_type", "number", "id"],
                name="entry_ct_number_idx",
            ),
        ]

    def save(self, *args, **kwargs):
        # Always derive it from the version so the two can never disagree.
        # bulk_create() skips save(): callers using it must set content_type.
        self.content_type_id = self.content_type_version.content_type_id
        super().save(*args, **kwargs)

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
    # Soft delete: NULL = live. An archived field is hidden from the editor and
    # left out of newly published versions; versions already published (and the
    # entries pinned to them) are untouched.
    archived_at = models.DateTimeField(null=True, blank=True, editable=False)

    class Meta:
        constraints = [
            # Only live fields must be unique, so a name can be reused after
            # the field that held it has been archived.
            models.UniqueConstraint(
                fields=["content_type", "name"],
                condition=models.Q(archived_at__isnull=True),
                name="unique_content_field",
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.content_type})"