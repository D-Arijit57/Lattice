from accounts.models import Notification, OrganizationMembership, Role


def notify(recipients, kind, message, organization=None, payload=None):
    """
    Write one Notification per recipient (an iterable of users, duplicates
    ignored). Call it inside the same transaction as the action it reports, so
    the notification exists exactly when the action does.
    """
    unique = {user.pk: user for user in recipients}
    Notification.objects.bulk_create(
        Notification(
            recipient=user,
            organization=organization,
            kind=kind,
            message=message[:500],
            payload=payload or {},
        )
        for user in unique.values()
    )


def reviewers_of(organization, exclude_user=None):
    """Everyone who can approve a publish request: admins and the owner."""
    memberships = (
        OrganizationMembership.objects
        .filter(organization=organization, role_id__gte=Role.ADMIN)
        .select_related("user")
    )
    return [m.user for m in memberships if m.user_id != getattr(exclude_user, "pk", None)]
