"""
Delivery discovery: GET /api/delivery/content-types/ and /<slug>/.

Lets an API-key consumer find out which content types its organization has and what
fields the latest version declares, without a login. Same key auth and org scoping as
the entries endpoints; read-only.
"""
import pytest
from django.urls import reverse
from django.utils import timezone

from accounts.models import APIKey, Organization, hash_api_key
from content.models import ContentType, Field
from content.services.versioning import create_content_type_version

RAW_KEY = "lat_discovery-key-acme"
OTHER_KEY = "lat_discovery-key-globex"


def _auth(raw):
    return {"HTTP_AUTHORIZATION": f"Bearer {raw}"}


def _org_with_key(name, raw):
    organization = Organization.objects.create(name=name)
    APIKey.objects.create(organization=organization, name="t", hashed_key=hash_api_key(raw))
    return organization


def _content_type(organization, name, slug, fields, publish=True):
    content_type = ContentType.objects.create(organization=organization, name=name, slug=slug)
    for field_name, data_type, required in fields:
        Field.objects.create(
            content_type=content_type, name=field_name, data_type=data_type, required=required
        )
    if publish:
        create_content_type_version(content_type=content_type)
    return content_type


LIST_URL = "delivery-content-type-list"
DETAIL_URL = "delivery-content-type-detail"


@pytest.fixture
def acme(db):
    organization = _org_with_key("Acme", RAW_KEY)
    _content_type(
        organization, "Event", "event",
        [("title", "string", True), ("start_time", "string", True), ("when", "date", False), ("seats", "number", False)],
    )
    _content_type(organization, "Blog Post", "blog-post", [("body", "string", True)])
    return organization


@pytest.mark.django_db
def test_list_returns_only_name_and_slug_ordered_by_name(api_client, acme):
    response = api_client.get(reverse(LIST_URL), **_auth(RAW_KEY))

    assert response.status_code == 200
    assert response.data == [
        {"name": "Blog Post", "slug": "blog-post"},
        {"name": "Event", "slug": "event"},
    ]


@pytest.mark.django_db
def test_list_never_includes_another_organizations_types(api_client, acme):
    globex = _org_with_key("Globex", OTHER_KEY)
    _content_type(globex, "Secret", "secret", [("x", "string", True)])

    response = api_client.get(reverse(LIST_URL), **_auth(RAW_KEY))

    assert "secret" not in [row["slug"] for row in response.data]


@pytest.mark.django_db
def test_detail_describes_fields_from_the_latest_version_schema(api_client, acme):
    response = api_client.get(reverse(DETAIL_URL, args=["event"]), **_auth(RAW_KEY))

    assert response.status_code == 200
    assert response.data == {
        "name": "Event",
        "slug": "event",
        "version_number": 1,
        "fields": [
            {"name": "seats", "data_type": "number", "required": False},
            {"name": "start_time", "data_type": "string", "required": True},
            {"name": "title", "data_type": "string", "required": True},
            {"name": "when", "data_type": "date", "required": False},
        ],
    }


@pytest.mark.django_db
def test_detail_reflects_the_newest_version_not_live_fields(api_client, acme):
    event = ContentType.objects.get(slug="event")
    Field.objects.create(content_type=event, name="room", data_type="string", required=False)
    # not published yet: the live Field exists but the latest version does not include it
    before = api_client.get(reverse(DETAIL_URL, args=["event"]), **_auth(RAW_KEY))
    assert "room" not in [f["name"] for f in before.data["fields"]]

    create_content_type_version(content_type=event)
    after = api_client.get(reverse(DETAIL_URL, args=["event"]), **_auth(RAW_KEY))
    assert after.data["version_number"] == 2
    assert "room" in [f["name"] for f in after.data["fields"]]


@pytest.mark.django_db
def test_detail_for_a_type_with_no_version_has_no_fields(api_client, acme):
    _content_type(acme, "Draft", "draft", [("a", "string", True)], publish=False)

    response = api_client.get(reverse(DETAIL_URL, args=["draft"]), **_auth(RAW_KEY))

    assert response.status_code == 200
    assert response.data["version_number"] is None
    assert response.data["fields"] == []


@pytest.mark.django_db
def test_detail_for_another_organizations_slug_is_404(api_client, acme):
    globex = _org_with_key("Globex", OTHER_KEY)
    _content_type(globex, "Secret", "secret", [("x", "string", True)])

    response = api_client.get(reverse(DETAIL_URL, args=["secret"]), **_auth(RAW_KEY))

    assert response.status_code == 404


@pytest.mark.django_db
def test_unknown_slug_is_404(api_client, acme):
    assert api_client.get(reverse(DETAIL_URL, args=["nope"]), **_auth(RAW_KEY)).status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize("name,args", [(LIST_URL, []), (DETAIL_URL, ["event"])])
def test_missing_unknown_and_revoked_keys_are_rejected(api_client, acme, name, args):
    url = reverse(name, args=args)
    assert api_client.get(url).status_code in (401, 403)
    assert api_client.get(url, **_auth("lat_not-a-real-key")).status_code in (401, 403)

    APIKey.objects.filter(organization=acme).update(revoked_at=timezone.now())
    revoked = api_client.get(url, **_auth(RAW_KEY))
    assert revoked.status_code in (401, 403)
    assert "revoked" in str(revoked.data["detail"])


@pytest.mark.django_db
@pytest.mark.parametrize("name,args", [(LIST_URL, []), (DETAIL_URL, ["event"])])
@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_discovery_is_read_only(api_client, acme, name, args, method):
    response = getattr(api_client, method)(reverse(name, args=args), {}, format="json", **_auth(RAW_KEY))

    assert response.status_code == 405


@pytest.mark.django_db
def test_logged_in_user_without_a_key_cannot_use_discovery(api_client, user, acme):
    api_client.force_authenticate(user=user)

    assert api_client.get(reverse(LIST_URL)).status_code in (401, 403)
