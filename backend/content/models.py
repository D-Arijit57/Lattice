from django.db import models

from accounts.models import Organization, User

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

# An editor cannot publish a version on their own. They ask for it here, and an
# admin or owner approves (which publishes the live fields as the next version)
# or rejects. The live Fields are the draft; the request only carries the
# editor's note, the reviewer sees what changed by comparing the draft with the
# latest published version at the moment they decide.
class PublishRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    content_type = models.ForeignKey(
        ContentType, on_delete=models.PROTECT, related_name="publish_requests"
    )
    requested_by = models.ForeignKey(
        User, null=True, on_delete=models.SET_NULL, related_name="publish_requests"
    )
    note = models.CharField(max_length=500, blank=True)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    decided_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="publish_decisions",
    )
    decision_note = models.CharField(max_length=500, blank=True)
    # the version this request produced, set only when it was approved
    version = models.OneToOneField(
        ContentTypeVersion, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="publish_request",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            # one open request per content type at a time
            models.UniqueConstraint(
                fields=["content_type"],
                condition=models.Q(status="pending"),
                name="unique_pending_publish_request",
            ),
        ]

    def __str__(self):
        return f"{self.content_type} publish request ({self.status})"
