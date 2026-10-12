"""
API key management: POST/GET/DELETE /api/organizations/<org>/api-keys/.

Delivery-side behaviour (what a key can read) is in api/delivery/tests.py.
"""
import pytest
from django.urls import reverse

from accounts.models import APIKey, Organization, OrganizationMembership, hash_api_key


@pytest.fixture
def member_org(user):
    # An Organization that `user` belongs to (role_id=1 is the owner role).
    organization = Organization.objects.create(name="Acme")
    OrganizationMembership.objects.create(user=user, organization=organization, role_id=1)
    return organization


def _list_url(org):
    return reverse("api-key-list", args=[org.id])


def _detail_url(org, key):
    return reverse("api-key-detail", args=[org.id, key.id])


def _make_key(org, name="existing", raw="lat_existing"):
    return APIKey.objects.create(
        organization=org, name=name, hashed_key=hash_api_key(raw)
    )


# --- create ---

@pytest.mark.django_db
def test_create_returns_the_raw_key_once_and_stores_only_its_hash(api_client, user, member_org):
    api_client.force_authenticate(user=user)

    response = api_client.post(_list_url(member_org), {"name": "Website"}, format="json")

    assert response.status_code == 201
    raw_key = response.data["key"]
    assert raw_key.startswith("lat_")
    assert response.data["name"] == "Website"
    assert response.data["revoked_at"] is None
    # The hash never leaves the server.
    assert "hashed_key" not in response.data

    stored = APIKey.objects.get(pk=response.data["id"])
    assert stored.organization == member_org
    assert stored.hashed_key == hash_api_key(raw_key)
    assert stored.hashed_key != raw_key


@pytest.mark.django_db
def test_each_created_key_is_different(api_client, user, member_org):
    api_client.force_authenticate(user=user)

    first = api_client.post(_list_url(member_org), {"name": "a"}, format="json")
    second = api_client.post(_list_url(member_org), {"name": "b"}, format="json")

    assert first.data["key"] != second.data["key"]
    assert APIKey.objects.filter(organization=member_org).count() == 2


@pytest.mark.django_db
def test_create_ignores_an_organization_in_the_body(api_client, user, member_org):
    other_org = Organization.objects.create(name="Other")
    api_client.force_authenticate(user=user)

    response = api_client.post(
        _list_url(member_org),
        {"name": "Sneaky", "organization": other_org.id},
        format="json",
    )

    assert response.status_code == 201
    assert APIKey.objects.filter(organization=member_org).count() == 1
    assert not APIKey.objects.filter(organization=other_org).exists()


# --- list ---

@pytest.mark.django_db
def test_list_never_exposes_the_raw_key_or_hash(api_client, user, member_org):
    _make_key(member_org)
    api_client.force_authenticate(user=user)

    response = api_client.get(_list_url(member_org))

    assert response.status_code == 200
    assert len(response.data) == 1
    row = response.data[0]
    assert set(row) == {"id", "name", "created_at", "revoked_at"}


@pytest.mark.django_db
def test_list_only_returns_keys_for_this_organization(api_client, user, member_org):
    mine = _make_key(member_org, name="mine", raw="lat_mine")
    other_org = Organization.objects.create(name="Other")
    _make_key(other_org, name="theirs", raw="lat_theirs")
    api_client.force_authenticate(user=user)

    response = api_client.get(_list_url(member_org))

    assert [row["id"] for row in response.data] == [mine.id]


@pytest.mark.django_db
def test_list_is_newest_first(api_client, user, member_org):
    older = _make_key(member_org, name="older", raw="lat_older")
    newer = _make_key(member_org, name="newer", raw="lat_newer")
    api_client.force_authenticate(user=user)

    response = api_client.get(_list_url(member_org))

    assert [row["id"] for row in response.data] == [newer.id, older.id]


# --- access control ---

@pytest.mark.django_db
def test_non_member_cannot_list_or_create_keys(api_client, user):
    other_org = Organization.objects.create(name="Other")  # `user` is not a member
    api_client.force_authenticate(user=user)

    assert api_client.get(_list_url(other_org)).status_code == 403
    response = api_client.post(_list_url(other_org), {"name": "x"}, format="json")
    assert response.status_code == 403
    assert not APIKey.objects.exists()


@pytest.mark.django_db
def test_unknown_organization_returns_404(api_client, user):
    api_client.force_authenticate(user=user)

    response = api_client.get(reverse("api-key-list", args=[999999]))

    assert response.status_code == 404


@pytest.mark.django_db
def test_anonymous_request_is_rejected(api_client, member_org):
    response = api_client.get(_list_url(member_org))

    assert response.status_code == 401


# --- revoke ---

@pytest.mark.django_db
def test_delete_revokes_the_key_but_keeps_the_row(api_client, user, member_org):
    key = _make_key(member_org)
    api_client.force_authenticate(user=user)

    response = api_client.delete(_detail_url(member_org, key))

    assert response.status_code == 204
    key.refresh_from_db()
    assert key.revoked_at is not None  # soft delete: the row and hash remain

    listed = api_client.get(_list_url(member_org)).data
    assert listed[0]["id"] == key.id
    assert listed[0]["revoked_at"] is not None


@pytest.mark.django_db
def test_cannot_revoke_a_key_that_belongs_to_another_organization(api_client, user, member_org):
    other_org = Organization.objects.create(name="Other")
    foreign_key = _make_key(other_org, raw="lat_foreign")
    api_client.force_authenticate(user=user)

    # Right organization in the URL, someone else's key id.
    response = api_client.delete(_detail_url(member_org, foreign_key))

    assert response.status_code == 404
    foreign_key.refresh_from_db()
    assert foreign_key.revoked_at is None


@pytest.mark.django_db
def test_non_member_cannot_revoke_a_key(api_client, user):
    other_org = Organization.objects.create(name="Other")
    key = _make_key(other_org)
    api_client.force_authenticate(user=user)

    response = api_client.delete(_detail_url(other_org, key))

    assert response.status_code == 403
    key.refresh_from_db()
    assert key.revoked_at is None
