"""
Members, invitations, role changes and ownership transfer.

Who can do what (roles: VIEWER < EDITOR < ADMIN < OWNER):
  list members / search users / invite / cancel invite   admin and owner
  invite as editor or viewer                              admin, owner
  invite as admin                                         admin, owner
  invite as owner                                         nobody (use transfer)
  change a member's role / transfer ownership             owner only
  remove a member                                         owner (anyone but self), admin (editors, viewers)
"""
import pytest
from django.urls import reverse

from accounts.models import Invitation, Organization, OrganizationMembership, Role, User
from api.accounts.rules import can_remove, roles_you_can_invite


@pytest.fixture
def org(db):
    return Organization.objects.create(name="Acme")


def make_user(email, name=None):
    return User.objects.create_user(email=email, name=name or email.split("@")[0], password="pw12345")


def join(org, user, role):
    return OrganizationMembership.objects.create(user=user, organization=org, role_id=role)


def login(api_client, user):
    api_client.force_authenticate(user=user)


# --- pure rules --------------------------------------------------------------


def test_roles_you_can_invite():
    assert roles_you_can_invite(Role.VIEWER) == []
    assert roles_you_can_invite(Role.EDITOR) == []
    assert roles_you_can_invite(Role.ADMIN) == [Role.VIEWER, Role.EDITOR, Role.ADMIN]
    assert roles_you_can_invite(Role.OWNER) == [Role.VIEWER, Role.EDITOR, Role.ADMIN]


@pytest.mark.parametrize(
    "actor,target,allowed",
    [
        (Role.OWNER, Role.ADMIN, True),
        (Role.OWNER, Role.EDITOR, True),
        (Role.OWNER, Role.OWNER, False),
        (Role.ADMIN, Role.VIEWER, True),
        (Role.ADMIN, Role.EDITOR, True),
        (Role.ADMIN, Role.ADMIN, False),
        (Role.ADMIN, Role.OWNER, False),
        (Role.EDITOR, Role.VIEWER, False),
        (Role.VIEWER, Role.VIEWER, False),
    ],
)
def test_can_remove(actor, target, allowed):
    assert can_remove(actor, target) is allowed


# --- listing members and searching users ------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.VIEWER, Role.EDITOR])
def test_below_admin_cannot_list_members_or_search(api_client, org, role):
    me = make_user("me@x.com")
    join(org, me, role)
    login(api_client, me)

    assert api_client.get(reverse("member-list", args=[org.id])).status_code == 403
    assert api_client.get(reverse("user-search", args=[org.id]), {"q": "ada"}).status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.ADMIN, Role.OWNER])
def test_admin_and_owner_can_list_members(api_client, org, role):
    me = make_user("me@x.com", "Me")
    join(org, me, role)
    join(org, make_user("v@x.com", "Vee"), Role.VIEWER)
    login(api_client, me)

    response = api_client.get(reverse("member-list", args=[org.id]))

    assert response.status_code == 200
    rows = response.data["results"] if isinstance(response.data, dict) else response.data
    assert {r["email"] for r in rows} == {"me@x.com", "v@x.com"}
    assert {"id", "user_id", "name", "email", "role_id"} <= set(rows[0])


@pytest.mark.django_db
def test_non_member_cannot_list_members(api_client, org):
    login(api_client, make_user("out@x.com"))
    assert api_client.get(reverse("member-list", args=[org.id])).status_code == 403


@pytest.mark.django_db
def test_user_search_is_narrow_and_skips_members(api_client, org):
    me = make_user("me@x.com", "Me")
    join(org, me, Role.OWNER)
    join(org, make_user("ada.member@x.com", "Ada Member"), Role.VIEWER)
    for i in range(8):
        make_user(f"ada{i}@x.com", f"Ada {i}")
    login(api_client, me)
    url = reverse("user-search", args=[org.id])

    assert api_client.get(url).status_code == 400            # no query
    assert api_client.get(url, {"q": "a"}).status_code == 400  # too short
    response = api_client.get(url, {"q": "ada"})

    assert response.status_code == 200
    assert len(response.data) == 5                              # capped
    assert "ada.member@x.com" not in {u["email"] for u in response.data}  # already a member
    assert set(response.data[0]) == {"id", "name", "email"}     # nothing else leaks


# --- inviting ----------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.VIEWER, Role.EDITOR])
def test_below_admin_cannot_invite(api_client, org, role):
    me = make_user("me@x.com")
    join(org, me, role)
    target = make_user("t@x.com")
    login(api_client, me)

    response = api_client.post(
        reverse("invitation-list", args=[org.id]),
        {"invited_user": target.id, "role_id": Role.VIEWER}, format="json",
    )

    assert response.status_code == 403
    assert Invitation.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize("inviter", [Role.ADMIN, Role.OWNER])
@pytest.mark.parametrize("invited_role", [Role.VIEWER, Role.EDITOR, Role.ADMIN])
def test_admin_and_owner_can_invite_up_to_admin(api_client, org, inviter, invited_role):
    me = make_user("me@x.com")
    join(org, me, inviter)
    target = make_user("t@x.com")
    login(api_client, me)

    response = api_client.post(
        reverse("invitation-list", args=[org.id]),
        {"invited_user": target.id, "role_id": invited_role}, format="json",
    )

    assert response.status_code == 201
    invitation = Invitation.objects.get()
    assert (invitation.invited_user, invitation.role_id, invitation.invited_by) == (target, invited_role, me)
    assert invitation.status == "pending"
    assert not OrganizationMembership.objects.filter(user=target).exists()  # not a member yet


@pytest.mark.django_db
@pytest.mark.parametrize("inviter", [Role.ADMIN, Role.OWNER])
def test_nobody_can_invite_an_owner(api_client, org, inviter):
    me = make_user("me@x.com")
    join(org, me, inviter)
    target = make_user("t@x.com")
    login(api_client, me)

    response = api_client.post(
        reverse("invitation-list", args=[org.id]),
        {"invited_user": target.id, "role_id": Role.OWNER}, format="json",
    )

    assert response.status_code == 400
    assert Invitation.objects.count() == 0


@pytest.mark.django_db
def test_cannot_invite_a_member_or_someone_already_invited(api_client, org):
    me = make_user("me@x.com")
    join(org, me, Role.OWNER)
    member = make_user("m@x.com")
    join(org, member, Role.VIEWER)
    target = make_user("t@x.com")
    login(api_client, me)
    url = reverse("invitation-list", args=[org.id])
    body = lambda u: {"invited_user": u.id, "role_id": Role.EDITOR}

    assert api_client.post(url, body(member), format="json").status_code == 400
    assert api_client.post(url, body(target), format="json").status_code == 201
    assert api_client.post(url, body(target), format="json").status_code == 400  # already pending


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.ADMIN, Role.OWNER])
def test_admin_and_owner_list_and_cancel_pending_invitations(api_client, org, role):
    me = make_user("me@x.com")
    join(org, me, role)
    target = make_user("t@x.com")
    invitation = Invitation.objects.create(
        organization=org, invited_user=target, invited_by=me, role_id=Role.EDITOR
    )
    login(api_client, me)

    listed = api_client.get(reverse("invitation-list", args=[org.id]))
    cancelled = api_client.delete(reverse("invitation-detail", args=[org.id, invitation.id]))

    assert listed.status_code == 200
    assert cancelled.status_code == 204
    invitation.refresh_from_db()
    assert invitation.status == "cancelled"
    # and the person can be invited again afterwards
    assert api_client.post(
        reverse("invitation-list", args=[org.id]),
        {"invited_user": target.id, "role_id": Role.VIEWER}, format="json",
    ).status_code == 201


# --- the invitee's side ------------------------------------------------------


@pytest.mark.django_db
def test_invitee_sees_only_their_own_invitations_and_accepts(api_client, org):
    boss = make_user("boss@x.com")
    join(org, boss, Role.OWNER)
    me = make_user("me@x.com")
    other = make_user("other@x.com")
    mine = Invitation.objects.create(organization=org, invited_user=me, invited_by=boss, role_id=Role.EDITOR)
    Invitation.objects.create(organization=org, invited_user=other, invited_by=boss, role_id=Role.VIEWER)
    login(api_client, me)

    listed = api_client.get(reverse("my-invitation-list"))
    assert [i["id"] for i in (listed.data["results"] if isinstance(listed.data, dict) else listed.data)] == [mine.id]

    accepted = api_client.post(reverse("my-invitation-accept", args=[mine.id]))

    assert accepted.status_code == 200
    membership = OrganizationMembership.objects.get(user=me, organization=org)
    assert membership.role_id == Role.EDITOR  # exactly the invited role
    mine.refresh_from_db()
    assert mine.status == "accepted"
    # a second accept is rejected, the invitation is no longer pending
    assert api_client.post(reverse("my-invitation-accept", args=[mine.id])).status_code == 404


@pytest.mark.django_db
def test_cannot_accept_or_decline_someone_elses_invitation(api_client, org):
    boss = make_user("boss@x.com")
    join(org, boss, Role.OWNER)
    other = make_user("other@x.com")
    theirs = Invitation.objects.create(organization=org, invited_user=other, invited_by=boss, role_id=Role.VIEWER)
    login(api_client, make_user("me@x.com"))

    assert api_client.post(reverse("my-invitation-accept", args=[theirs.id])).status_code == 404
    assert api_client.post(reverse("my-invitation-decline", args=[theirs.id])).status_code == 404
    assert not OrganizationMembership.objects.filter(user=other).exists()


@pytest.mark.django_db
def test_decline_does_not_create_a_membership(api_client, org):
    boss = make_user("boss@x.com")
    join(org, boss, Role.OWNER)
    me = make_user("me@x.com")
    invitation = Invitation.objects.create(organization=org, invited_user=me, invited_by=boss, role_id=Role.ADMIN)
    login(api_client, me)

    assert api_client.post(reverse("my-invitation-decline", args=[invitation.id])).status_code == 200
    invitation.refresh_from_db()
    assert invitation.status == "declined"
    assert not OrganizationMembership.objects.filter(user=me).exists()


# --- role changes: owner only ------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.VIEWER, Role.EDITOR, Role.ADMIN])
def test_only_owner_can_change_roles(api_client, org, role):
    me = make_user("me@x.com")
    join(org, me, role)
    target = join(org, make_user("t@x.com"), Role.VIEWER)
    login(api_client, me)

    response = api_client.patch(
        reverse("member-detail", args=[org.id, target.id]), {"role_id": Role.EDITOR}, format="json"
    )

    assert response.status_code == 403
    target.refresh_from_db()
    assert target.role_id == Role.VIEWER


@pytest.mark.django_db
def test_owner_changes_a_role_but_cannot_hand_out_owner_this_way(api_client, org):
    me = make_user("me@x.com")
    my_membership = join(org, me, Role.OWNER)
    target = join(org, make_user("t@x.com"), Role.VIEWER)
    login(api_client, me)
    url = reverse("member-detail", args=[org.id, target.id])

    assert api_client.patch(url, {"role_id": Role.ADMIN}, format="json").status_code == 200
    target.refresh_from_db()
    assert target.role_id == Role.ADMIN
    assert api_client.patch(url, {"role_id": Role.OWNER}, format="json").status_code == 400
    assert api_client.patch(url, {"role_id": 99}, format="json").status_code == 400
    # and the owner cannot demote themself, that would leave the org ownerless
    own = reverse("member-detail", args=[org.id, my_membership.id])
    assert api_client.patch(own, {"role_id": Role.VIEWER}, format="json").status_code == 400
    my_membership.refresh_from_db()
    assert my_membership.role_id == Role.OWNER


@pytest.mark.django_db
def test_a_member_of_another_org_is_a_404(api_client, org):
    me = make_user("me@x.com")
    join(org, me, Role.OWNER)
    other_org = Organization.objects.create(name="Other")
    stranger = join(other_org, make_user("s@x.com"), Role.VIEWER)
    login(api_client, me)

    url = reverse("member-detail", args=[org.id, stranger.id])
    assert api_client.patch(url, {"role_id": Role.EDITOR}, format="json").status_code == 404
    assert api_client.delete(url).status_code == 404


# --- removing members --------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.VIEWER, Role.EDITOR])
def test_below_admin_cannot_remove_anyone(api_client, org, role):
    me = make_user("me@x.com")
    join(org, me, role)
    target = join(org, make_user("t@x.com"), Role.VIEWER)
    login(api_client, me)

    assert api_client.delete(reverse("member-detail", args=[org.id, target.id])).status_code == 403
    assert OrganizationMembership.objects.filter(pk=target.pk).exists()


@pytest.mark.django_db
def test_admin_removes_editors_and_viewers_but_not_admins_or_owner(api_client, org):
    me = make_user("me@x.com")
    join(org, me, Role.ADMIN)
    owner = join(org, make_user("o@x.com"), Role.OWNER)
    other_admin = join(org, make_user("a@x.com"), Role.ADMIN)
    editor = join(org, make_user("e@x.com"), Role.EDITOR)
    viewer = join(org, make_user("v@x.com"), Role.VIEWER)
    login(api_client, me)

    def remove(m):
        return api_client.delete(reverse("member-detail", args=[org.id, m.id])).status_code

    assert remove(owner) == 403
    assert remove(other_admin) == 403
    assert remove(editor) == 204
    assert remove(viewer) == 204


@pytest.mark.django_db
def test_owner_removes_anyone_except_themself(api_client, org):
    me = make_user("me@x.com")
    mine = join(org, me, Role.OWNER)
    admin = join(org, make_user("a@x.com"), Role.ADMIN)
    login(api_client, me)

    assert api_client.delete(reverse("member-detail", args=[org.id, admin.id])).status_code == 204
    assert api_client.delete(reverse("member-detail", args=[org.id, mine.id])).status_code == 403
    assert OrganizationMembership.objects.filter(pk=mine.pk).exists()


# --- ownership transfer ------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.VIEWER, Role.EDITOR, Role.ADMIN])
def test_only_owner_can_transfer_ownership(api_client, org, role):
    me = make_user("me@x.com")
    join(org, me, role)
    target = join(org, make_user("t@x.com"), Role.VIEWER)
    login(api_client, me)

    response = api_client.post(reverse("member-transfer-ownership", args=[org.id, target.id]))

    assert response.status_code == 403
    target.refresh_from_db()
    assert target.role_id == Role.VIEWER


@pytest.mark.django_db
def test_transfer_makes_target_owner_and_old_owner_admin(api_client, org):
    me = make_user("me@x.com")
    mine = join(org, me, Role.OWNER)
    target = join(org, make_user("t@x.com"), Role.EDITOR)
    login(api_client, me)

    response = api_client.post(reverse("member-transfer-ownership", args=[org.id, target.id]))

    assert response.status_code == 200
    mine.refresh_from_db()
    target.refresh_from_db()
    assert (mine.role_id, target.role_id) == (Role.ADMIN, Role.OWNER)
    assert OrganizationMembership.objects.filter(organization=org, role_id=Role.OWNER).count() == 1
    # the old owner can no longer do owner-only things
    assert api_client.delete(reverse("organization-detail", args=[org.id])).status_code == 403


@pytest.mark.django_db
def test_cannot_transfer_to_yourself(api_client, org):
    me = make_user("me@x.com")
    mine = join(org, me, Role.OWNER)
    login(api_client, me)

    assert api_client.post(reverse("member-transfer-ownership", args=[org.id, mine.id])).status_code == 400
    mine.refresh_from_db()
    assert mine.role_id == Role.OWNER
