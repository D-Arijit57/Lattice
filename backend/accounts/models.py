import hashlib

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models


class Role(models.IntegerChoices): # .IntergerChoices : enum for Django
    VIEWER = 0, "Viewer"
    EDITOR = 1, "Editor"
    ADMIN = 2, "Admin"
    OWNER = 3, "Owner"
# Lives here, not in a views.py, because it's needed by low-level modules
# (the delivery authentication class) that can't safely import a DRF views
# module - views.py pulls in the whole viewsets machinery, which creates a
# circular import when something as early-loading as an authentication class
# needs it. models.py only ever imports Django's own base classes, so nothing
# importing this can ever circle back.
def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()

# Organization
# models.model is the base class for django for database_backed models
# interpretation : Organization is a database entity. Take the fields I define inside this class and use them to construct/manage the corresponding database table.
# django fields are non-null by default
class Organization(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Soft delete: NULL = live. An archived organization disappears from the
    # API (lists, detail, API-key delivery) but its data is kept.
    archived_at = models.DateTimeField(null=True, blank=True, editable=False)

    def __str__(self):
        return self.name

# custom manager for handling the user creation
class UserManager(BaseUserManager):
    def create_user(self, email, name, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email)
        user = self.model(email=email, name=name, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

# AbstractBaseUSer  : provides a minimal foundation for the auth, we decide the user fields 
# our custom user model 
class User(AbstractBaseUser):
    name = models.CharField(max_length=255)
    email = models.CharField(max_length=255, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email" # USERNAME_FIELD : login identifier
    REQUIRED_FIELDS = ["name"]

    objects = UserManager()

    def __str__(self):
        return self.email
# OrganizationMembership is the relationship between the User and Organization
# OrganizationMembership represents a user’s membership in an organization and stores attributes of that relationship, such as the user’s role. The foreign keys connect the User and Organization, while the composite unique constraint on (user_id, organization_id) guarantees that the same user cannot have duplicate memberships in the same organization.
class OrganizationMembership(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    # role type: 
    '''
    - Viewer: read only.
    - Editor: create, edit and archive entries.
    - Admin: schema changes, deletes and API keys.
    - Owner: everything, plus org delete (still to confirm).
    '''
    # by default the role is viewer
    role_id = models.IntegerField(choices=Role.choices, default=Role.VIEWER)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "user"],
                name="unique_user_organization",
            ),
        ]

    def __str__(self):
        return f"{self.user} @ {self.organization}"
# APIKey : 
# using this the user can connect their backend with out data engine and fetch the content
# for their specific backend (e.g Calender system)   
class APIKey(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="api_keys"
    )
    name = models.CharField(max_length=255)
    
    hashed_key = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.organization}"
        

# An invitation asks an existing user to join an organization with a role.
# Nothing changes for the invitee until they accept: accepting is what creates
# the OrganizationMembership. The role is never OWNER (ownership is transferred,
# not invited).
class Invitation(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        DECLINED = "declined", "Declined"
        CANCELLED = "cancelled", "Cancelled"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="invitations"
    )
    invited_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="invitations"
    )
    invited_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="sent_invitations"
    )
    role_id = models.IntegerField(choices=Role.choices)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            # at most one pending invitation per person per organization
            models.UniqueConstraint(
                fields=["organization", "invited_user"],
                condition=models.Q(status="pending"),
                name="unique_pending_invitation",
            ),
        ]

    def __str__(self):
        return f"{self.invited_user} -> {self.organization} ({self.status})"


# A message for one user, shown in the in-app bell. It is written when
# something happens (an invitation, a publish request, a decision) and the
# recipient marks it read. `payload` holds the ids the frontend needs to link to
# the thing it is about; `message` is stored as plain text so old notifications
# keep reading the same even if names change later.
class Notification(models.Model):
    class Kind(models.TextChoices):
        INVITATION = "invitation", "Invitation"
        PUBLISH_REQUESTED = "publish_requested", "Publish requested"
        PUBLISH_APPROVED = "publish_approved", "Publish approved"
        PUBLISH_REJECTED = "publish_rejected", "Publish rejected"

    recipient = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="notifications"
    )
    organization = models.ForeignKey(
        Organization, null=True, blank=True, on_delete=models.CASCADE,
        related_name="notifications",
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    message = models.CharField(max_length=500)
    payload = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            # the bell asks for "my newest" and "my unread count"
            models.Index(fields=["recipient", "-created_at"], name="notif_recipient_recent"),
        ]

    def __str__(self):
        return f"{self.kind} -> {self.recipient}"
