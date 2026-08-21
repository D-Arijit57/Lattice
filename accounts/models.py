from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models


# Organization
# models.model is the base class for django for database_backed models
# interpretation - Organization is a database entity. Take the fields I define inside this class and use them to construct/manage the corresponding database table.
# django fields are non-null by default
class Organization(models.Model):
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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
    role_id = models.IntegerField()
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