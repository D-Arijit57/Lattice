"""
Publish requests: editors ask, admin/owner decide.

  list / create / retrieve   editor and above (viewers: 403)
  cancel                     the requester, or admin and above
  approve / reject           admin and above (editors: 403)
Approving publishes the live fields as the next version.
"""
import pytest
from django.urls import reverse

from accounts.models import Organization, OrganizationMembership, Role, User
from content.models import ContentType, ContentTypeVersion, Entry, Field, PublishRequest
from content.services.schema_diff import diff_schemas, has_changes
from content.services.schema_generation import generate_schema
from content.services.versioning import create_content_type_version


def make_user(email):
    return User.objects.create_user(email=email, name=email.split("@")[0], password="pw12345")


def join(org, user, role):
    return OrganizationMembership.objects.create(user=user, organization=org, role_id=role)


@pytest.fixture
def world(db):
    """An org with a content type that already has a published v1 (one field)."""
    org = Organization.objects.create(name="Acme")
    ct = ContentType.objects.create(organization=org, name="Post", slug="post")
    Field.objects.create(content_type=ct, name="title", data_type="string", required=True)
    v1 = create_content_type_version(ct)
    return org, ct, v1


def add_draft_field(ct, name="body"):
    return Field.objects.create(content_type=ct, name=name, data_type="string", required=False)


def urls(org, ct, pk=None):
    base = [org.id, ct.id]
    out = {"list": reverse("publish-request-list", args=base)}
    if pk:
        out["detail"] = reverse("publish-request-detail", args=[*base, pk])
        out["approve"] = reverse("publish-request-approve", args=[*base, pk])
        out["reject"] = reverse("publish-request-reject", args=[*base, pk])
    return out


def as_role(api_client, org, role, email="me@x.com"):
    user = make_user(email)
    join(org, user, role)
    api_client.force_authenticate(user=user)
    return user


def pending_request(ct, user, note="please"):
    return PublishRequest.objects.create(content_type=ct, requested_by=user, note=note)


# --- schema diff (pure) -------------------------------------------------------


class F:
    def __init__(self, name, data_type="string", required=True):
        self.name, self.data_type, self.required = name, data_type, required


def test_diff_added_removed_changed():
    old = generate_schema([F("a"), F("b"), F("c", "number", True)])
    new = generate_schema([F("a"), F("c", "string", False), F("d", "date")])

    diff = diff_schemas(old, new)

    assert [x["name"] for x in diff["added"]] == ["d"]
    assert diff["added"][0]["format"] == "date"
    assert [x["name"] for x in diff["removed"]] == ["b"]
    assert diff["changed"] == [{
        "name": "c",
        "from": {"type": "number", "format": None, "required": True},
        "to": {"type": "string", "format": None, "required": False},
    }]


def test_diff_with_no_previous_version_adds_everything_and_equal_schemas_have_no_changes():
    schema = generate_schema([F("a"), F("b")])
    assert [x["name"] for x in diff_schemas(None, schema)["added"]] == ["a", "b"]
    assert has_changes(diff_schemas(None, schema))
    assert not has_changes(diff_schemas(schema, schema))


# --- who may read and create ---------------------------------------------------


@pytest.mark.django_db
def test_viewer_cannot_touch_publish_requests(api_client, world):
    org, ct, _ = world
    add_draft_field(ct)
    as_role(api_client, org, Role.VIEWER)

    assert api_client.get(urls(org, ct)["list"]).status_code == 403
    assert api_client.post(urls(org, ct)["list"], {"note": "x"}, format="json").status_code == 403
    assert PublishRequest.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.EDITOR, Role.ADMIN, Role.OWNER])
def test_editor_and_above_can_request_a_publish(api_client, world, role):
    org, ct, _ = world
    add_draft_field(ct)
    user = as_role(api_client, org, role)

    response = api_client.post(urls(org, ct)["list"], {"note": "added body"}, format="json")

    assert response.status_code == 201
    assert response.data["status"] == "pending"
    assert response.data["requested_by"] == user.id
    assert [f["name"] for f in response.data["diff"]["added"]] == ["body"]
    assert ContentTypeVersion.objects.filter(content_type=ct).count() == 1  # nothing published yet


@pytest.mark.django_db
def test_cannot_request_when_nothing_changed_or_there_are_no_fields(api_client, world):
    org, ct, _ = world
    as_role(api_client, org, Role.EDITOR)
    url = urls(org, ct)["list"]

    assert api_client.post(url, {}, format="json").status_code == 400  # draft == v1

    empty = ContentType.objects.create(organization=org, name="Empty", slug="empty")
    assert api_client.post(urls(org, empty)["list"], {}, format="json").status_code == 400  # no fields


@pytest.mark.django_db
def test_only_one_pending_request_per_content_type(api_client, world):
    org, ct, _ = world
    add_draft_field(ct)
    as_role(api_client, org, Role.EDITOR)
    url = urls(org, ct)["list"]

    assert api_client.post(url, {}, format="json").status_code == 201
    assert api_client.post(url, {}, format="json").status_code == 400
    assert PublishRequest.objects.count() == 1


@pytest.mark.django_db
def test_list_filters_by_status_and_retrieve_shows_diff_only_while_pending(api_client, world):
    org, ct, _ = world
    add_draft_field(ct)
    me = as_role(api_client, org, Role.ADMIN)
    done = PublishRequest.objects.create(
        content_type=ct, requested_by=me, status="rejected", decision_note="no"
    )
    open_one = pending_request(ct, me)

    all_rows = api_client.get(urls(org, ct)["list"]).data
    pending_rows = api_client.get(urls(org, ct)["list"], {"status": "pending"}).data
    rows = lambda d: d["results"] if isinstance(d, dict) else d

    assert {r["id"] for r in rows(all_rows)} == {done.id, open_one.id}
    assert [r["id"] for r in rows(pending_rows)] == [open_one.id]
    assert api_client.get(urls(org, ct, open_one.id)["detail"]).data["diff"]["added"][0]["name"] == "body"
    assert api_client.get(urls(org, ct, done.id)["detail"]).data["diff"] is None


# --- approve -------------------------------------------------------------------


@pytest.mark.django_db
def test_editor_cannot_approve_or_reject(api_client, world):
    org, ct, _ = world
    add_draft_field(ct)
    me = as_role(api_client, org, Role.EDITOR)
    request = pending_request(ct, me)
    u = urls(org, ct, request.id)

    assert api_client.post(u["approve"], {}, format="json").status_code == 403
    assert api_client.post(u["reject"], {"decision_note": "no"}, format="json").status_code == 403
    request.refresh_from_db()
    assert request.status == "pending"
    assert ContentTypeVersion.objects.filter(content_type=ct).count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.ADMIN, Role.OWNER])
def test_admin_and_owner_approve_publishes_the_draft_as_the_next_version(api_client, world, role):
    org, ct, v1 = world
    add_draft_field(ct)
    editor = make_user("editor@x.com")
    join(org, editor, Role.EDITOR)
    request = pending_request(ct, editor)
    reviewer = as_role(api_client, org, role)
    entry = Entry.objects.create(content_type_version=v1, data={"title": "old"}, number=1)

    response = api_client.post(
        urls(org, ct, request.id)["approve"], {"decision_note": "looks good"}, format="json"
    )

    assert response.status_code == 200
    assert response.data["status"] == "approved"
    assert response.data["version_number"] == 2
    assert response.data["decided_by"] == reviewer.id
    v2 = ContentTypeVersion.objects.get(content_type=ct, version_number=2)
    assert set(v2.schema["properties"]) == {"title", "body"}
    request.refresh_from_db()
    assert request.version == v2 and request.decision_note == "looks good"
    entry.refresh_from_db()
    assert entry.content_type_version_id == v1.id  # existing entries stay on v1


@pytest.mark.django_db
def test_cannot_approve_twice_or_after_a_rejection(api_client, world):
    org, ct, _ = world
    add_draft_field(ct)
    editor = make_user("editor@x.com")
    join(org, editor, Role.EDITOR)
    request = pending_request(ct, editor)
    as_role(api_client, org, Role.ADMIN)
    u = urls(org, ct, request.id)

    assert api_client.post(u["approve"], {}, format="json").status_code == 200
    assert api_client.post(u["approve"], {}, format="json").status_code == 400
    assert api_client.post(u["reject"], {"decision_note": "late"}, format="json").status_code == 400
    assert ContentTypeVersion.objects.filter(content_type=ct).count() == 2  # one new version only


@pytest.mark.django_db
def test_approve_fails_and_stays_pending_if_the_draft_was_reverted(api_client, world):
    org, ct, _ = world
    extra = add_draft_field(ct)
    editor = make_user("editor@x.com")
    join(org, editor, Role.EDITOR)
    request = pending_request(ct, editor)
    extra.delete()  # draft is identical to v1 again
    as_role(api_client, org, Role.ADMIN)

    response = api_client.post(urls(org, ct, request.id)["approve"], {}, format="json")

    assert response.status_code == 400
    request.refresh_from_db()
    assert request.status == "pending"
    assert ContentTypeVersion.objects.filter(content_type=ct).count() == 1


# --- reject --------------------------------------------------------------------


@pytest.mark.django_db
def test_reject_needs_a_reason_and_publishes_nothing(api_client, world):
    org, ct, _ = world
    add_draft_field(ct)
    editor = make_user("editor@x.com")
    join(org, editor, Role.EDITOR)
    request = pending_request(ct, editor)
    reviewer = as_role(api_client, org, Role.ADMIN)
    u = urls(org, ct, request.id)

    assert api_client.post(u["reject"], {}, format="json").status_code == 400
    assert api_client.post(u["reject"], {"decision_note": "   "}, format="json").status_code == 400
    response = api_client.post(u["reject"], {"decision_note": "rename body first"}, format="json")

    assert response.status_code == 200
    assert response.data["status"] == "rejected"
    request.refresh_from_db()
    assert (request.decided_by, request.decision_note) == (reviewer, "rename body first")
    assert ContentTypeVersion.objects.filter(content_type=ct).count() == 1
    # after a rejection the editor can ask again
    assert PublishRequest.objects.filter(content_type=ct, status="pending").count() == 0


# --- cancel --------------------------------------------------------------------


@pytest.mark.django_db
def test_requester_or_admin_can_cancel_but_not_another_editor(api_client, world):
    org, ct, _ = world
    add_draft_field(ct)
    author = make_user("author@x.com")
    join(org, author, Role.EDITOR)
    request = pending_request(ct, author)
    url = urls(org, ct, request.id)["detail"]

    as_role(api_client, org, Role.EDITOR, email="other@x.com")
    assert api_client.delete(url).status_code == 403

    api_client.force_authenticate(user=author)
    assert api_client.delete(url).status_code == 204
    request.refresh_from_db()
    assert request.status == "cancelled"
    assert api_client.delete(url).status_code == 400  # already decided


@pytest.mark.django_db
def test_admin_can_cancel_someone_elses_request(api_client, world):
    org, ct, _ = world
    add_draft_field(ct)
    author = make_user("author@x.com")
    join(org, author, Role.EDITOR)
    request = pending_request(ct, author)
    as_role(api_client, org, Role.ADMIN)

    assert api_client.delete(urls(org, ct, request.id)["detail"]).status_code == 204


# --- scoping -------------------------------------------------------------------


@pytest.mark.django_db
def test_non_member_and_foreign_content_type(api_client, world):
    org, ct, _ = world
    add_draft_field(ct)
    stranger = make_user("s@x.com")
    api_client.force_authenticate(user=stranger)
    assert api_client.get(urls(org, ct)["list"]).status_code == 403

    other_org = Organization.objects.create(name="Other")
    join(other_org, stranger, Role.OWNER)
    # a content type of org, asked for through other_org's id: 404
    wrong = reverse("publish-request-list", args=[other_org.id, ct.id])
    assert api_client.get(wrong).status_code == 404
