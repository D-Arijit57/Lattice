import pytest
from django.urls import reverse

from accounts.models import Organization, OrganizationMembership
from api.content.serializers import EntrySerializer
from content.models import ContentType, ContentTypeVersion, Entry, Field
from content.services.entry_validation import NON_FIELD_ERRORS
from content.services.versioning import create_content_type_version


@pytest.mark.django_db
def test_unauthenticated_request_is_rejected(api_client):
    # No user/membership needed - the request is never authenticated, so
    # FieldViewSet's permission check should reject it before either the
    # organization or content_type ever gets looked up.
    organization = Organization.objects.create(name="Acme")
    content_type = ContentType.objects.create(
        organization=organization, name="Event", slug="event"
    )

    url = reverse("field-list", args=[organization.id, content_type.id])
    response = api_client.get(url)
    assert response.status_code == 401


@pytest.mark.django_db
def test_non_member_cannot_access_fields(api_client, user):
    # arrange: create an Organization + ContentType, but do NOT create an
    #          OrganizationMembership linking `user` to it - `user` is a real,
    #          logged-in user, just not a member of this particular org.
    # act: api_client.force_authenticate(user=user)
    #      api_client.get(reverse("field-list", args=[organization.id, content_type.id]))
    # assert: response.status_code == 403
    organization = Organization.objects.create(name= "Netflix")
    content_type = ContentType.objects.create(
        organization = organization, name="Movie", slug="movie"
    )
    # force authenticates it : isn't a member of the organization its trying to get
    api_client.force_authenticate(user=user)
    url = reverse("field-list", args=[organization.id, content_type.id])
    response = api_client.get(url)
    assert response.status_code == 403


@pytest.mark.django_db
def test_field_under_content_type_from_another_org_returns_404(api_client, user):
    # arrange: create org_a (with an OrganizationMembership for `user`) and
    #          org_b (no membership for `user`). Create a ContentType under
    #          org_b.
    # act: api_client.force_authenticate(user=user)
    #      api_client.get(reverse("field-list", args=[org_a.id, content_type_under_org_b.id]))
    # assert: response.status_code == 404 - membership on org_a passes, but
    #         get_content_type() looks up the content type scoped to org_a
    #         and finds nothing, since it actually belongs to org_b.
    organizationA = Organization.objects.create(name = "Netflix")
    OrganizationMembership.objects.create(user=user, organization=organizationA, role_id=1)

    organizationB = Organization.objects.create(name = "Amazon-Prime")
    content_typeB = ContentType.objects.create(organization = organizationB, name = "Jack-Ryan", slug="movie")
    
    api_client.force_authenticate(user=user)
    url = reverse("field-list",args=[organizationA.id, content_typeB.id])
    response = api_client.get(url)
    
    assert response.status_code == 404


@pytest.mark.django_db
def test_valid_field_creation_succeeds(api_client, user):
    # What: an authenticated member of the organization POSTs a valid,
    # unique Field - this is the happy path every other test here is a
    # variation on (missing membership, bad data_type, duplicate name...).
    organization = Organization.objects.create(name="Acme")
    content_type = ContentType.objects.create(
        organization=organization, name="Event", slug="event"
    )
    OrganizationMembership.objects.create(user=user, organization=organization, role_id=1)

    api_client.force_authenticate(user=user)
    url = reverse("field-list", args=[organization.id, content_type.id])
    response = api_client.post(
        url,
        {"name": "title", "data_type": "string", "required": True},
        format="json",
    )

    # Why two assertions, not just the status code: the first proves the
    # HTTP response looks right; the second proves the row actually landed
    # in the database - a serializer bug could return a convincing 201
    # without ever calling .save(), so checking the DB directly closes
    # that gap.
    assert response.status_code == 201
    assert response.data["name"] == "title"
    assert Field.objects.filter(content_type=content_type, name="title").exists()


@pytest.mark.django_db
def test_invalid_data_type_is_rejected(api_client, user):
    # What: same setup as the happy path, but data_type is "array" - not in
    # FieldSerializer's ALLOWED_DATA_TYPES set. Proves validate_data_type()
    # actually rejects it, instead of quietly accepting any string (which
    # is all the bare model field would allow on its own).
    organization = Organization.objects.create(name="Acme")
    content_type = ContentType.objects.create(
        organization=organization, name="Event", slug="event"
    )
    OrganizationMembership.objects.create(user=user, organization=organization, role_id=1)

    api_client.force_authenticate(user=user)
    url = reverse("field-list", args=[organization.id, content_type.id])
    response = api_client.post(
        url,
        {"name": "weird", "data_type": "array", "required": True},
        format="json",
    )

    # Why check "data_type" in response.data specifically, not just the
    # status code: a 400 could come from a different field failing for a
    # different reason - checking the error is keyed under "data_type"
    # confirms it's actually validate_data_type() that caught this, not
    # something else going wrong.
    assert response.status_code == 400
    assert "data_type" in response.data


@pytest.mark.django_db
def test_duplicate_field_name_is_rejected(api_client, user):
    # What: a Field named "title" already exists on this content_type
    # (created directly via the ORM, not through the API - we don't need
    # to go through a request just to set up existing state). Posting a
    # second "title" under the SAME content_type should be rejected by
    # UniqueTogetherValidator(fields=["content_type", "name"]), even though
    # the data_type this time is different - the constraint is on the name,
    # not on whether the rest of the row matches.
    organization = Organization.objects.create(name="Acme")
    content_type = ContentType.objects.create(
        organization=organization, name="Event", slug="event"
    )
    OrganizationMembership.objects.create(user=user, organization=organization, role_id=1)
    Field.objects.create(content_type=content_type, name="title", data_type="string")

    api_client.force_authenticate(user=user)
    url = reverse("field-list", args=[organization.id, content_type.id])
    response = api_client.post(
        url,
        {"name": "title", "data_type": "number", "required": True},
        format="json",
    )

    assert response.status_code == 400


@pytest.mark.django_db
def test_list_only_returns_fields_for_this_content_type(api_client, user):
    # What: two DIFFERENT ContentTypes under the SAME organization, each
    # with its own Field. `user` is a member of the org, so the membership
    # check alone wouldn't catch a scoping bug here - this specifically
    # tests get_queryset()'s .filter(content_type=content_type), proving a
    # request for content_type_a's fields can't see content_type_b's.
    organization = Organization.objects.create(name="Acme")
    OrganizationMembership.objects.create(user=user, organization=organization, role_id=1)

    content_type_a = ContentType.objects.create(
        organization=organization, name="Event", slug="event"
    )
    content_type_b = ContentType.objects.create(
        organization=organization, name="Course", slug="course"
    )
    Field.objects.create(content_type=content_type_a, name="title", data_type="string")
    Field.objects.create(content_type=content_type_b, name="price", data_type="number")

    api_client.force_authenticate(user=user)
    url = reverse("field-list", args=[organization.id, content_type_a.id])
    response = api_client.get(url)

    # response.data is a plain list here, not {"results": [...]} - FieldViewSet
    # has no pagination_class set (unlike EntryViewSet), so DRF's
    # ListModelMixin returns the serialized queryset directly.
    assert len(response.data) == 1
    assert response.data[0]["name"] == "title"


@pytest.mark.django_db
def test_retrieve_field_succeeds(api_client, user):
    # What: fetching a single Field by id, through field-detail rather than
    # field-list. RetrieveModelMixin reuses the same get_queryset() as list,
    # so this mainly proves the URL wiring (organization/content_type/pk all
    # showing up in the right args) and the detail route work end to end.
    organization = Organization.objects.create(name="Acme")
    content_type = ContentType.objects.create(
        organization=organization, name="Event", slug="event"
    )
    OrganizationMembership.objects.create(user=user, organization=organization, role_id=1)
    field = Field.objects.create(content_type=content_type, name="title", data_type="string")

    api_client.force_authenticate(user=user)
    url = reverse("field-detail", args=[organization.id, content_type.id, field.id])
    response = api_client.get(url)

    assert response.status_code == 200
    assert response.data["name"] == field.name


# --- Triage of the original "your turn" stubs (2026-09-20) -------------------
# Rule: assert each behavior at the lowest layer that can prove it, and don't
# re-check behavior that lives in shared code and is already tested. Of the 20
# original stubs, 6 were DROPPED as redundant (reasons below, kept for future
# reference so nobody re-adds them by accident) and 14 were written.
#
# Dropped:
#   ContentType "unauthenticated -> 401" and "non-member -> 403"
#       ContentTypeViewSet inherits both checks from OrganizationScopedViewSet,
#       the same base class FieldViewSet uses. The Field tests at the top of
#       this file already prove that base class. Repeating them per viewset
#       tests the same code again.
#   ContentTypeVersion "version number increments across requests"
#       The counter logic is in create_content_type_version(), covered by
#       test_create_content_type_version_increments_version_number in
#       content/tests.py. Through HTTP it adds nothing new.
#   ContentTypeVersion "retrieve"
#       Shares get_queryset() with list, and the list test below covers that
#       queryset's scoping and ordering.
#   Entry "creation attaches to the latest version"
#       test_entry_endpoint_uses_the_new_schema_once_a_version_is_republished
#       (Entry endpoint section, below) already publishes v2 and asserts the
#       new entry is pinned to v2 and not v1.
#   accounts "anonymous user cannot create org"
#       Same IsAuthenticated gate as the anonymous request already tested in
#       api/auth/tests.py; see the note in api/accounts/tests.py.

@pytest.fixture
def member_org(user):
    # An Organization that `user` belongs to (role_id=1 is the owner role).
    organization = Organization.objects.create(name="Acme")
    OrganizationMembership.objects.create(user=user, organization=organization, role_id=1)
    return organization


# --- ContentType ---
# ContentTypeViewSet is OrganizationScopedViewSet one level up: URLs take only
# [organization_id]. Its list is NOT paginated (only Entry list is, Decision 74).

@pytest.mark.django_db
def test_valid_content_type_creation_succeeds(api_client, user, member_org):
    other_org = Organization.objects.create(name="Other")
    api_client.force_authenticate(user=user)
    url = reverse("content-type-list", args=[member_org.id])

    # The body also tries to choose the organization. That must be ignored:
    # organization is a HiddenField filled from the URL, never from the client
    # (Decision 47) - otherwise a member could create content types inside
    # someone else's organization.
    response = api_client.post(
        url,
        {"name": "Event", "slug": "event", "organization": other_org.id},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["organization_id"] == member_org.id
    assert ContentType.objects.filter(organization=member_org, slug="event").exists()
    assert not ContentType.objects.filter(organization=other_org).exists()


@pytest.mark.django_db
def test_duplicate_slug_in_same_org_is_rejected(api_client, user, member_org):
    ContentType.objects.create(organization=member_org, name="Event", slug="event")
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse("content-type-list", args=[member_org.id]),
        {"name": "Another", "slug": "event"},
        format="json",
    )
    assert response.status_code == 400
    assert ContentType.objects.filter(organization=member_org).count() == 1

    # The unique rule is the PAIR (organization, slug), not slug alone
    # (Decision 13): the same slug must still be allowed in a different org.
    other_org = Organization.objects.create(name="Other")
    OrganizationMembership.objects.create(user=user, organization=other_org, role_id=1)
    response = api_client.post(
        reverse("content-type-list", args=[other_org.id]),
        {"name": "Event", "slug": "event"},
        format="json",
    )
    assert response.status_code == 201


@pytest.mark.django_db
def test_list_only_returns_content_types_for_this_organization(api_client, user, member_org):
    other_org = Organization.objects.create(name="Other")  # `user` is NOT a member
    ContentType.objects.create(organization=member_org, name="Mine", slug="mine")
    ContentType.objects.create(organization=other_org, name="Theirs", slug="theirs")
    api_client.force_authenticate(user=user)

    response = api_client.get(reverse("content-type-list", args=[member_org.id]))

    assert response.status_code == 200
    # unpaginated, so response.data is a bare list
    assert [item["name"] for item in response.data] == ["Mine"]


@pytest.mark.django_db
def test_retrieve_content_type_succeeds(api_client, user, member_org):
    mine = ContentType.objects.create(organization=member_org, name="Mine", slug="mine")
    other_org = Organization.objects.create(name="Other")
    theirs = ContentType.objects.create(organization=other_org, name="Theirs", slug="theirs")
    api_client.force_authenticate(user=user)

    response = api_client.get(reverse("content-type-detail", args=[member_org.id, mine.id]))
    assert response.status_code == 200
    assert response.data["name"] == "Mine"

    # Another org's content type asked for under MY org's URL: 404, exactly as
    # if it didn't exist, so which ids are real in other orgs is not leaked.
    response = api_client.get(reverse("content-type-detail", args=[member_org.id, theirs.id]))
    assert response.status_code == 404


# --- ContentTypeVersion ---
# URLs take [organization_id, content_type_id]. schema is server-generated and
# read-only (Decisions 94-96): POST needs no "schema" key, and one sent is ignored.

@pytest.mark.django_db
def test_version_creation_without_fields_is_rejected(api_client, user, member_org):
    # a ContentType with NO Fields
    content_type = ContentType.objects.create(organization=member_org, name="Event", slug="event")
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse("content-type-version-list", args=[member_org.id, content_type.id]),
        {},
        format="json",
    )

    # The service raises Django's ValidationError for zero Fields (Decision 95);
    # this proves the serializer translates it into a 400 instead of a 500.
    assert response.status_code == 400
    # 400 alone is not enough: a different bug can also produce a 400 (a
    # UniqueTogetherValidator on the read-only version_number rejected EVERY
    # version POST with {"version_number": ["This field is required."]}, which
    # made this test pass for the wrong reason). Pin the actual reason.
    assert "no Fields defined" in str(response.data)
    assert ContentTypeVersion.objects.count() == 0


@pytest.mark.django_db
def test_version_creation_generates_schema_from_fields(api_client, user, member_org):
    content_type = ContentType.objects.create(organization=member_org, name="Event", slug="event")
    Field.objects.create(content_type=content_type, name="title", data_type="string", required=True)
    Field.objects.create(content_type=content_type, name="price", data_type="number", required=False)
    api_client.force_authenticate(user=user)

    # The client tries to supply its own schema. It must be ignored: Fields are
    # the only source of truth (Decision 20/94).
    response = api_client.post(
        reverse("content-type-version-list", args=[member_org.id, content_type.id]),
        {"schema": {"type": "string"}},
        format="json",
    )

    assert response.status_code == 201
    assert response.data["version_number"] == 1
    schema = response.data["schema"]
    assert set(schema["properties"]) == {"title", "price"}
    assert schema["required"] == ["title"]  # price is required=False
    assert schema["additionalProperties"] is False


@pytest.mark.django_db
def test_list_returns_versions_for_this_content_type_only(api_client, user, member_org):
    type_a = ContentType.objects.create(organization=member_org, name="A", slug="a")
    type_b = ContentType.objects.create(organization=member_org, name="B", slug="b")
    Field.objects.create(content_type=type_a, name="title", data_type="string", required=True)
    Field.objects.create(content_type=type_b, name="title", data_type="string", required=True)
    create_content_type_version(content_type=type_a)  # A v1
    create_content_type_version(content_type=type_a)  # A v2
    create_content_type_version(content_type=type_b)  # B v1
    api_client.force_authenticate(user=user)

    response = api_client.get(
        reverse("content-type-version-list", args=[member_org.id, type_a.id])
    )

    assert response.status_code == 200
    # newest first (get_queryset orders by -version_number), only A's versions
    assert [v["version_number"] for v in response.data] == [2, 1]
    assert all(v["content_type_id"] == type_a.id for v in response.data)


# --- Entry ---
# URLs take [organization_id, content_type_id] (+ pk for detail). Entry list is
# cursor-paginated (EntryCursorPagination, page_size=50): {"next", "previous",
# "results"}, not a bare list. These reuse product_setup (fixture defined in the
# "Entry endpoint" section below): an org `user` belongs to, a "Product" type
# with title/price Fields and one published version.

def make_entry_in_another_content_type(organization):
    # An Entry that belongs to a DIFFERENT ContentType in the same organization.
    other_type = ContentType.objects.create(organization=organization, name="Event", slug="event")
    Field.objects.create(content_type=other_type, name="title", data_type="string", required=True)
    other_version = create_content_type_version(content_type=other_type)
    return Entry.objects.create(content_type_version=other_version, data={"title": "Concert"})


@pytest.mark.django_db
def test_entry_creation_fails_when_no_version_exists(api_client, user, member_org):
    # Fields exist, but no version was ever published
    content_type = ContentType.objects.create(organization=member_org, name="Event", slug="event")
    Field.objects.create(content_type=content_type, name="title", data_type="string", required=True)
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse("entry-list", args=[member_org.id, content_type.id]),
        {"data": {"title": "Concert"}},
        format="json",
    )

    # get_serializer_context() raises NotFound when there is no latest version
    assert response.status_code == 404
    assert Entry.objects.count() == 0


@pytest.mark.django_db
def test_list_only_returns_entries_for_this_content_type(api_client, user, product_setup):
    organization, content_type, version = product_setup
    mine = Entry.objects.create(content_type_version=version, data={"title": "Shirt", "price": 1})
    make_entry_in_another_content_type(organization)
    api_client.force_authenticate(user=user)

    response = api_client.get(reverse("entry-list", args=[organization.id, content_type.id]))

    assert response.status_code == 200
    # paginated: the entries sit under "results"
    assert [entry["id"] for entry in response.data["results"]] == [mine.id]


@pytest.mark.django_db
def test_retrieve_entry_succeeds(api_client, user, product_setup):
    organization, content_type, version = product_setup
    entry = Entry.objects.create(content_type_version=version, data={"title": "Shirt", "price": 1})
    other_entry = make_entry_in_another_content_type(organization)
    api_client.force_authenticate(user=user)

    response = api_client.get(
        reverse("entry-detail", args=[organization.id, content_type.id, entry.id])
    )
    assert response.status_code == 200
    assert response.data["data"] == {"title": "Shirt", "price": 1}
    assert response.data["version_number"] == version.version_number

    # An entry of a different content type, asked for under THIS content type's
    # URL: 404 (get_queryset filters by the URL's content type).
    response = api_client.get(
        reverse("entry-detail", args=[organization.id, content_type.id, other_entry.id])
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_entry_list_is_paginated(api_client, user, product_setup):
    organization, content_type, version = product_setup
    # page_size is 50, so 51 entries force a second page
    for i in range(51):
        Entry.objects.create(content_type_version=version, data={"title": f"Item {i}", "price": i})
    api_client.force_authenticate(user=user)

    response = api_client.get(reverse("entry-list", args=[organization.id, content_type.id]))

    assert response.status_code == 200
    # cursor pagination: no "count" key (it never counts the table), not a bare list
    assert set(response.data) == {"next", "previous", "results"}
    assert len(response.data["results"]) == 50
    assert response.data["next"] is not None

    # follow the cursor: exactly one entry is left, and nothing after it
    second_page = api_client.get(response.data["next"])
    assert second_page.status_code == 200
    assert len(second_page.data["results"]) == 1
    assert second_page.data["next"] is None


# --- EntrySerializer schema validation ---------------------------------------
# Serializer-level tests: no request, no db. The view normally puts the latest
# version into the serializer context, so here an unsaved ContentTypeVersion
# stands in for it.

PRODUCT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "price": {"type": "number"},
    },
    "required": ["title", "price"],
    "additionalProperties": False,
}


def make_entry_serializer(data):
    version = ContentTypeVersion(version_number=1, schema=PRODUCT_SCHEMA)
    return EntrySerializer(data={"data": data}, context={"content_type_version": version})


def test_entry_serializer_accepts_valid_data():
    serializer = make_entry_serializer({"title": "Shirt", "price": 499})
    assert serializer.is_valid(), serializer.errors
    # the validated payload must come through untouched, this is what save() writes
    assert serializer.validated_data["data"] == {"title": "Shirt", "price": 499}


def test_entry_serializer_rejects_data_that_breaks_the_schema():
    serializer = make_entry_serializer({"title": "Shirt", "price": "banana"})
    assert not serializer.is_valid()
    # per-field messages nested under "data" - the shape the frontend will read
    assert serializer.errors["data"] == {"price": ["Must be a number."]}


def test_entry_serializer_reports_every_error_at_once():
    serializer = make_entry_serializer({"price": "x", "hax": 1})
    assert not serializer.is_valid()
    assert serializer.errors["data"] == {
        "title": ["This field is required."],
        "price": ["Must be a number."],
        "hax": ["Unknown field."],
    }


def test_entry_serializer_rejects_a_payload_that_is_not_an_object():
    serializer = make_entry_serializer([1, 2, 3])
    assert not serializer.is_valid()
    assert serializer.errors["data"] == {NON_FIELD_ERRORS: ["Must be a JSON object."]}


# --- Entry endpoint: schema validation through the real request flow ---------
# Unlike the serializer tests above, these go through URL routing, auth, the
# membership check, the view (which resolves the latest version) and Postgres.

@pytest.fixture
def product_setup(user):
    # The state an Entry POST needs, in dependency order: `user` is a member of
    # an Organization that owns a "Product" ContentType with two required
    # Fields and one published version (no version -> the view returns 404).
    organization = Organization.objects.create(name="Amazon")
    OrganizationMembership.objects.create(user=user, organization=organization, role_id=1)
    content_type = ContentType.objects.create(
        organization=organization, name="Product", slug="product"
    )
    Field.objects.create(
        content_type=content_type, name="title", data_type="string", required=True
    )
    Field.objects.create(
        content_type=content_type, name="price", data_type="number", required=True
    )
    version = create_content_type_version(content_type=content_type)
    return organization, content_type, version


@pytest.mark.django_db
def test_entry_endpoint_valid_entry_is_created(api_client, user, product_setup):
    organization, content_type, version = product_setup
    api_client.force_authenticate(user=user)
    url = reverse("entry-list", args=[organization.id, content_type.id])
    payload = {"title": "Shirt", "price": 499}

    # the body is {"data": {...}} because the serializer's field is called "data"
    response = api_client.post(url, {"data": payload}, format="json")

    # three checks: the status, the body a client will read, and the database
    assert response.status_code == 201
    assert response.data["data"] == payload
    entry = Entry.objects.get(id=response.data["id"])
    assert entry.data == payload
    # pinned to the version that was validated against (Decision 42)
    assert entry.content_type_version == version


@pytest.mark.django_db
def test_entry_endpoint_rejects_wrong_type_and_saves_nothing(api_client, user, product_setup):
    organization, content_type, _ = product_setup
    api_client.force_authenticate(user=user)
    url = reverse("entry-list", args=[organization.id, content_type.id])

    response = api_client.post(
        url, {"data": {"title": "Shirt", "price": "banana"}}, format="json"
    )

    assert response.status_code == 400
    # errors sit under "data" (the field name), then under the payload's own field
    assert response.data["data"] == {"price": ["Must be a number."]}
    # rejected at the door: nothing may reach the database
    assert Entry.objects.count() == 0


@pytest.mark.django_db
def test_entry_endpoint_reports_every_error_at_once(api_client, user, product_setup):
    organization, content_type, _ = product_setup
    api_client.force_authenticate(user=user)
    url = reverse("entry-list", args=[organization.id, content_type.id])

    # one of each: a required field missing, a wrong type, an unknown field
    response = api_client.post(
        url, {"data": {"price": "x", "hax": 1}}, format="json"
    )

    assert response.status_code == 400
    assert response.data["data"] == {
        "title": ["This field is required."],
        "price": ["Must be a number."],
        "hax": ["Unknown field."],
    }
    assert Entry.objects.count() == 0


@pytest.mark.django_db
def test_entry_endpoint_validates_against_published_version_not_live_fields(
    api_client, user, product_setup
):
    # The core design claim (Decision 42): an entry is judged by the schema
    # snapshot of the version it is pinned to, never by the Fields as they are now.
    organization, content_type, version = product_setup
    # a new required Field - but no new version is published
    Field.objects.create(
        content_type=content_type, name="sku", data_type="string", required=True
    )
    api_client.force_authenticate(user=user)
    url = reverse("entry-list", args=[organization.id, content_type.id])

    # no "sku", which the live Fields now require - v1's schema does not know it
    response = api_client.post(
        url, {"data": {"title": "Shirt", "price": 499}}, format="json"
    )

    assert response.status_code == 201
    assert Entry.objects.get(id=response.data["id"]).content_type_version == version


@pytest.mark.django_db
def test_entry_endpoint_uses_the_new_schema_once_a_version_is_republished(
    api_client, user, product_setup
):
    organization, content_type, _ = product_setup
    Field.objects.create(
        content_type=content_type, name="sku", data_type="string", required=True
    )
    version_two = create_content_type_version(content_type=content_type)
    api_client.force_authenticate(user=user)
    url = reverse("entry-list", args=[organization.id, content_type.id])

    # the payload that was fine under v1 now breaks v2's schema
    response = api_client.post(
        url, {"data": {"title": "Shirt", "price": 499}}, format="json"
    )
    assert response.status_code == 400
    assert response.data["data"] == {"sku": ["This field is required."]}
    assert Entry.objects.count() == 0

    # a payload that satisfies v2 is accepted and pinned to v2, not v1
    response = api_client.post(
        url, {"data": {"title": "Shirt", "price": 499, "sku": "S-1"}}, format="json"
    )
    assert response.status_code == 201
    assert Entry.objects.get(id=response.data["id"]).content_type_version == version_two
