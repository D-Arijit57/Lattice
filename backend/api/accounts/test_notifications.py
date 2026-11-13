"""
Notifications: written when something happens, read through /api/notifications/.

  invitation sent            -> the invitee
  publish requested          -> admins and the owner (not the requester)
  publish approved/rejected  -> the editor who asked (not if they decided it themself)
Everyone only ever sees and changes their own.
"""
import pytest
from django.urls import reverse

from accounts.models import Invitation, Notification, Organization, OrganizationMembership, Role, User
from content.models import ContentType, Field
from content.services.versioning import create_content_type_version


def make_user(email):
    return User.objects.create_user(email=email, name=email.split("@")[0].title(), password="pw12345")


def join(org, user, role):
    return OrganizationMembership.objects.create(user=user, organization=org, role_id=role)


@pytest.fixture
def team(db):
    """Org with one of each role and a content type whose draft differs from v1."""
    org = Organization.objects.create(name="Acme")
    people = {
        "owner": make_user("owner@x.com"),
        "admin": make_user("admin@x.com"),
        "editor": make_user("editor@x.com"),
        "viewer": make_user("viewer@x.com"),
    }
    join(org, people["owner"], Role.OWNER)
    join(org, people["admin"], Role.ADMIN)
    join(org, people["editor"], Role.EDITOR)
    join(org, people["viewer"], Role.VIEWER)
    ct = ContentType.objects.create(organization=org, name="Post", slug="post")
    Field.objects.create(content_type=ct, name="title", data_type="string", required=True)
    create_content_type_version(ct)
    Field.objects.create(content_type=ct, name="body", data_type="string", required=False)
    return org, ct, people


def request_url(org, ct, name="list", pk=None):
    args = [org.id, ct.id] + ([pk] if pk else [])
    return reverse(f"publish-request-{name}", args=args)


# --- who gets notified --------------------------------------------------------


@pytest.mark.django_db
def test_invitation_notifies_the_invitee_only(api_client, team):
    org, _, people = team
    invitee = make_user("new@x.com")
    api_client.force_authenticate(user=people["admin"])

    response = api_client.post(
        reverse("invitation-list", args=[org.id]),
        {"invited_user": invitee.id, "role_id": Role.EDITOR}, format="json",
    )

    assert response.status_code == 201
    note = Notification.objects.get()
    assert note.recipient == invitee
    assert note.kind == "invitation"
    assert "Admin invited you to join Acme as Editor" in note.message
    assert note.payload == {"invitation_id": Invitation.objects.get().id, "organization_id": org.id}


@pytest.mark.django_db
def test_failed_invitation_notifies_nobody(api_client, team):
    org, _, people = team
    api_client.force_authenticate(user=people["admin"])

    response = api_client.post(
        reverse("invitation-list", args=[org.id]),
        {"invited_user": people["viewer"].id, "role_id": Role.EDITOR}, format="json",  # already a member
    )

    assert response.status_code == 400
    assert Notification.objects.count() == 0


@pytest.mark.django_db
def test_publish_request_notifies_admins_and_owner_but_not_the_requester(api_client, team):
    org, ct, people = team
    api_client.force_authenticate(user=people["editor"])

    response = api_client.post(request_url(org, ct), {"note": "body added"}, format="json")

    assert response.status_code == 201
    notes = Notification.objects.all()
    assert {n.recipient for n in notes} == {people["owner"], people["admin"]}
    assert all(n.kind == "publish_requested" for n in notes)
    assert "Editor requested to publish Post" in notes[0].message
    assert notes[0].payload["publish_request_id"] == response.data["id"]


@pytest.mark.django_db
def test_an_admins_own_request_does_not_notify_themself(api_client, team):
    org, ct, people = team
    api_client.force_authenticate(user=people["admin"])

    assert api_client.post(request_url(org, ct), {}, format="json").status_code == 201

    assert {n.recipient for n in Notification.objects.all()} == {people["owner"]}


@pytest.mark.django_db
def test_failed_publish_request_notifies_nobody(api_client, team):
    org, ct, people = team
    api_client.force_authenticate(user=people["editor"])
    assert api_client.post(request_url(org, ct), {}, format="json").status_code == 201
    Notification.objects.all().delete()

    assert api_client.post(request_url(org, ct), {}, format="json").status_code == 400  # duplicate

    assert Notification.objects.count() == 0


@pytest.mark.django_db
def test_approval_notifies_the_requester(api_client, team):
    org, ct, people = team
    api_client.force_authenticate(user=people["editor"])
    pk = api_client.post(request_url(org, ct), {}, format="json").data["id"]
    Notification.objects.all().delete()
    api_client.force_authenticate(user=people["admin"])

    assert api_client.post(request_url(org, ct, "approve", pk), {}, format="json").status_code == 200

    note = Notification.objects.get()
    assert note.recipient == people["editor"]
    assert note.kind == "publish_approved"
    assert "Admin approved your publish request for Post (v2)" in note.message


@pytest.mark.django_db
def test_rejection_notifies_the_requester_with_the_reason(api_client, team):
    org, ct, people = team
    api_client.force_authenticate(user=people["editor"])
    pk = api_client.post(request_url(org, ct), {}, format="json").data["id"]
    Notification.objects.all().delete()
    api_client.force_authenticate(user=people["owner"])

    response = api_client.post(request_url(org, ct, "reject", pk), {"decision_note": "rename body"}, format="json")

    assert response.status_code == 200
    note = Notification.objects.get()
    assert note.recipient == people["editor"]
    assert note.kind == "publish_rejected"
    assert note.message.endswith("rejected your publish request for Post: rename body")


@pytest.mark.django_db
def test_deciding_your_own_request_does_not_notify_you(api_client, team):
    org, ct, people = team
    api_client.force_authenticate(user=people["admin"])
    pk = api_client.post(request_url(org, ct), {}, format="json").data["id"]
    Notification.objects.all().delete()

    assert api_client.post(request_url(org, ct, "approve", pk), {}, format="json").status_code == 200

    assert Notification.objects.count() == 0


@pytest.mark.django_db
def test_rejected_or_failed_decisions_by_an_editor_notify_nobody(api_client, team):
    org, ct, people = team
    api_client.force_authenticate(user=people["editor"])
    pk = api_client.post(request_url(org, ct), {}, format="json").data["id"]
    Notification.objects.all().delete()

    assert api_client.post(request_url(org, ct, "approve", pk), {}, format="json").status_code == 403

    assert Notification.objects.count() == 0


# --- reading your own ---------------------------------------------------------


def note_for(user, message="hi", kind="invitation"):
    return Notification.objects.create(recipient=user, kind=kind, message=message)


@pytest.mark.django_db
def test_requires_login(api_client):
    assert api_client.get(reverse("notification-list")).status_code == 401
    assert api_client.get(reverse("notification-unread-count")).status_code == 401


@pytest.mark.django_db
def test_list_shows_only_my_notifications_newest_first_with_unread_filter(api_client, team):
    _, _, people = team
    old = note_for(people["editor"], "old")
    new = note_for(people["editor"], "new")
    note_for(people["admin"], "not mine")
    api_client.force_authenticate(user=people["editor"])
    api_client.post(reverse("notification-read", args=[old.id]))

    everything = api_client.get(reverse("notification-list"))
    unread = api_client.get(reverse("notification-list"), {"unread": "true"})

    assert [n["message"] for n in everything.data] == ["new", "old"]
    assert [n["is_read"] for n in everything.data] == [False, True]
    assert [n["id"] for n in unread.data] == [new.id]


@pytest.mark.django_db
def test_unread_count_and_mark_read_are_idempotent(api_client, team):
    _, _, people = team
    first = note_for(people["editor"])
    note_for(people["editor"])
    note_for(people["admin"])  # someone else's does not count
    api_client.force_authenticate(user=people["editor"])
    count = lambda: api_client.get(reverse("notification-unread-count")).data["unread"]

    assert count() == 2
    assert api_client.post(reverse("notification-read", args=[first.id])).status_code == 200
    first.refresh_from_db()
    stamp = first.read_at
    assert api_client.post(reverse("notification-read", args=[first.id])).status_code == 200
    first.refresh_from_db()
    assert first.read_at == stamp  # reading again does not move the timestamp
    assert count() == 1


@pytest.mark.django_db
def test_read_all_marks_only_my_notifications(api_client, team):
    _, _, people = team
    note_for(people["editor"])
    note_for(people["editor"])
    theirs = note_for(people["admin"])
    api_client.force_authenticate(user=people["editor"])

    response = api_client.post(reverse("notification-read-all"))

    assert response.status_code == 200
    assert response.data == {"marked": 2}
    assert api_client.get(reverse("notification-unread-count")).data["unread"] == 0
    theirs.refresh_from_db()
    assert theirs.read_at is None


@pytest.mark.django_db
def test_cannot_read_someone_elses_notification(api_client, team):
    _, _, people = team
    theirs = note_for(people["admin"])
    api_client.force_authenticate(user=people["editor"])

    assert api_client.post(reverse("notification-read", args=[theirs.id])).status_code == 404
    theirs.refresh_from_db()
    assert theirs.read_at is None


@pytest.mark.django_db
def test_list_is_capped_at_50(api_client, team):
    _, _, people = team
    Notification.objects.bulk_create(
        Notification(recipient=people["editor"], kind="invitation", message=str(i)) for i in range(55)
    )
    api_client.force_authenticate(user=people["editor"])

    assert len(api_client.get(reverse("notification-list")).data) == 50
