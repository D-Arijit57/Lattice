"""
Who may do what to whom, as plain functions (no DB, easy to test).

Roles: VIEWER=0 < EDITOR=1 < ADMIN=2 < OWNER=3.
"""
from accounts.models import Role


def roles_you_can_invite(inviter_role):
    """Owner and admin may invite viewers, editors and admins. Never owners:
    ownership is handed over with the transfer endpoint instead."""
    if inviter_role >= Role.ADMIN:
        return [Role.VIEWER, Role.EDITOR, Role.ADMIN]
    return []


def can_remove(actor_role, target_role):
    """The owner can remove anyone but themself (they must transfer first).
    An admin can remove viewers and editors only."""
    if target_role == Role.OWNER:
        return False
    if actor_role == Role.OWNER:
        return True
    if actor_role == Role.ADMIN:
        return target_role <= Role.EDITOR
    return False
