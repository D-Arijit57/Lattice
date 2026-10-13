"""
Delivery API: GET /api/delivery/content-types/<slug>/entries/[<id>/].

External apps authenticate with `Authorization: Bearer lat_<key>` instead of
a user login. The key carries its organization, so these tests focus on
authentication outcomes, tenant isolation, and being read-only.
"""
import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone

from accounts.models import APIKey, Organization, hash_api_key
from content.models import ContentType, Entry, Field
from content.services.versioning import create_content_type_version

RAW_KEY = "lat_test-key-for-acme"
OTHER_RAW_KEY = "lat_test-key-for-globex"


def _make_product_type(organization, titles):
    """A "product" content type with one published version and one entry per title."""
    content_type = ContentType.objects.create(
        organization=organization, name="Product", slug="product"
    )
    Field.objects.create(
        content_type=content_type, name="title", data_type="string", required=True
    )
    version = create_content_type_version(content_type=content_type)
    entries = [
        Entry.objects.create(content_type_version=version, data={"title": title})
        for title in titles
    ]
    return content_type, entries


def _make_key(organization, raw):
    return APIKey.objects.create(
        organization=organization, name="test", hashed_key=hash_api_key(raw)
    )


def _auth(raw_key):
    return {"HTTP_AUTHORIZATION": f"Bearer {raw_key}"}


def _list_url(slug="product"):
    return reverse("delivery-entry-list", args=[slug])


def _detail_url(entry_id, slug="product"):
    return reverse("delivery-entry-detail", args=[slug, entry_id])


@pytest.fixture
def acme(db):
    """An organization with a valid key and two product entries."""
    organization = Organization.objects.create(name="Acme")
    key = _make_key(organization, RAW_KEY)
    content_type, entries = _make_product_type(organization, ["Shirt", "Hat"])
    return organization, key, content_type, entries


@pytest.fixture
def globex(db):
    """A second organization that also has a "product" type, with different data."""
    organization = Organization.objects.create(name="Globex")
    key = _make_key(organization, OTHER_RAW_KEY)
    content_type, entries = _make_product_type(organization, ["Secret widget"])
    return organization, key, content_type, entries


# --- authentication ---

@pytest.mark.django_db
def test_valid_key_lists_entries(api_client, acme):
    response = api_client.get(_list_url(), **_auth(RAW_KEY))

    assert response.status_code == 200
    titles = [row["data"]["title"] for row in response.data["results"]]
    assert sorted(titles) == ["Hat", "Shirt"]
    assert response.data["results"][0]["version_number"] == 1


@pytest.mark.django_db
def test_entries_are_newest_first(api_client, acme):
    response = api_client.get(_list_url(), **_auth(RAW_KEY))

    ids = [row["id"] for row in response.data["results"]]
    assert ids == sorted(ids, reverse=True)


@pytest.mark.django_db
def test_missing_key_is_rejected(api_client, acme):
    response = api_client.get(_list_url())

    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_unknown_key_is_rejected(api_client, acme):
    response = api_client.get(_list_url(), **_auth("lat_not-a-real-key"))

    assert response.status_code in (401, 403)
    assert "Invalid API Key" in str(response.data["detail"])


@pytest.mark.django_db
def test_header_without_the_lat_prefix_is_not_treated_as_a_key(api_client, acme):
    # Without the "lat_" prefix the authenticator steps aside, so even the
    # right secret does not authenticate.
    response = api_client.get(_list_url(), **_auth(RAW_KEY.removeprefix("lat_")))

    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_revoked_key_is_rejected(api_client, acme):
    _, key, _, _ = acme
    key.revoked_at = timezone.now()
    key.save()

    response = api_client.get(_list_url(), **_auth(RAW_KEY))

    assert response.status_code in (401, 403)
    assert "revoked" in str(response.data["detail"])


@pytest.mark.django_db
def test_logged_in_user_without_a_key_cannot_use_delivery(api_client, user, acme):
    # A user session is a different credential; delivery only accepts keys.
    api_client.force_authenticate(user=user)

    response = api_client.get(_list_url())

    assert response.status_code in (401, 403)


# --- tenant isolation ---

@pytest.mark.django_db
def test_key_only_sees_its_own_organizations_entries(api_client, acme, globex):
    # Both organizations have a "product" slug; each key must see only its own.
    mine = api_client.get(_list_url(), **_auth(RAW_KEY))
    theirs = api_client.get(_list_url(), **_auth(OTHER_RAW_KEY))

    mine_titles = {row["data"]["title"] for row in mine.data["results"]}
    their_titles = {row["data"]["title"] for row in theirs.data["results"]}
    assert mine_titles == {"Shirt", "Hat"}
    assert their_titles == {"Secret widget"}


@pytest.mark.django_db
def test_slug_from_another_organization_returns_404(api_client, acme):
    other_org = Organization.objects.create(name="Globex")
    ContentType.objects.create(organization=other_org, name="Event", slug="event")

    response = api_client.get(_list_url("event"), **_auth(RAW_KEY))

    assert response.status_code == 404


@pytest.mark.django_db
def test_unknown_slug_returns_404(api_client, acme):
    response = api_client.get(_list_url("nope"), **_auth(RAW_KEY))

    assert response.status_code == 404


# --- retrieve ---

@pytest.mark.django_db
def test_retrieve_returns_one_entry(api_client, acme):
    _, _, _, entries = acme
    entry = entries[0]

    response = api_client.get(_detail_url(entry.id), **_auth(RAW_KEY))

    assert response.status_code == 200
    assert response.data["id"] == entry.id
    assert response.data["data"] == {"title": "Shirt"}


@pytest.mark.django_db
def test_retrieve_entry_from_another_organization_returns_404(api_client, acme, globex):
    _, _, _, their_entries = globex

    response = api_client.get(_detail_url(their_entries[0].id), **_auth(RAW_KEY))

    assert response.status_code == 404


@pytest.mark.django_db
def test_retrieve_entry_from_a_different_content_type_returns_404(api_client, acme):
    organization, _, _, _ = acme
    event_type = ContentType.objects.create(organization=organization, name="Event", slug="event")
    Field.objects.create(content_type=event_type, name="title", data_type="string", required=True)
    event_version = create_content_type_version(content_type=event_type)
    event_entry = Entry.objects.create(content_type_version=event_version, data={"title": "Concert"})

    # Same organization, same key, but the entry belongs to "event", not "product".
    response = api_client.get(_detail_url(event_entry.id, slug="product"), **_auth(RAW_KEY))

    assert response.status_code == 404


# --- read-only ---

@pytest.mark.django_db
@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_delivery_is_read_only(api_client, acme, method):
    _, _, _, entries = acme
    count_before = Entry.objects.count()

    list_response = getattr(api_client, method)(_list_url(), {}, format="json", **_auth(RAW_KEY))
    detail_response = getattr(api_client, method)(
        _detail_url(entries[0].id), {}, format="json", **_auth(RAW_KEY)
    )

    assert list_response.status_code == 405
    assert detail_response.status_code == 405
    assert Entry.objects.count() == count_before


# --- rate limiting ---

@pytest.mark.django_db
def test_each_key_is_limited_to_60_requests_per_minute(api_client, acme):
    # 60/min is the "delivery" rate in settings; the 61st request is refused.
    for _ in range(60):
        assert api_client.get(_list_url(), **_auth(RAW_KEY)).status_code == 200

    response = api_client.get(_list_url(), **_auth(RAW_KEY))

    assert response.status_code == 429
    assert "Retry-After" in response


@pytest.mark.django_db
def test_rate_limit_is_per_key_not_per_ip(api_client, acme, globex):
    # Same client IP for both requests; exhausting one key must not affect another.
    for _ in range(60):
        api_client.get(_list_url(), **_auth(RAW_KEY))
    assert api_client.get(_list_url(), **_auth(RAW_KEY)).status_code == 429

    assert api_client.get(_list_url(), **_auth(OTHER_RAW_KEY)).status_code == 200


# --- query count ---

@pytest.mark.django_db
def test_list_query_count_does_not_grow_with_the_number_of_entries(api_client, acme):
    # EntrySerializer reads content_type_version.version_number for every row.
    # Without select_related that is one extra query per entry (N+1).
    _, _, content_type, _ = acme

    def queries_for_list():
        with CaptureQueriesContext(connection) as captured:
            response = api_client.get(_list_url(), **_auth(RAW_KEY))
        assert response.status_code == 200
        return len(captured), len(response.data["results"])

    few_queries, few_rows = queries_for_list()
    version = content_type.versions.first()
    for i in range(10):
        Entry.objects.create(content_type_version=version, data={"title": f"Extra {i}"})
    many_queries, many_rows = queries_for_list()

    assert many_rows > few_rows
    assert many_queries == few_queries


# --- Entry.content_type stays in sync with its version ---

@pytest.mark.django_db
def test_entry_content_type_is_derived_from_its_version(acme):
    _, _, content_type, entries = acme

    assert all(entry.content_type_id == content_type.id for entry in entries)


@pytest.mark.django_db
def test_list_includes_entries_from_every_version_of_the_content_type(api_client, acme):
    # The list spans all versions; filtering on Entry.content_type must not
    # narrow it to the latest one.
    _, _, content_type, _ = acme
    Field.objects.create(content_type=content_type, name="price", data_type="number", required=False)
    version_two = create_content_type_version(content_type=content_type)
    Entry.objects.create(content_type_version=version_two, data={"title": "Coat"})

    response = api_client.get(_list_url(), **_auth(RAW_KEY))

    titles = sorted(row["data"]["title"] for row in response.data["results"])
    assert titles == ["Coat", "Hat", "Shirt"]
