import pytest
from django.urls import reverse

from accounts.models import Organization, OrganizationMembership
from content.models import ContentType, Field


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


# --- ContentType ---
# Same auth/scoping shape as Field's tests above (ContentTypeViewSet is
# OrganizationScopedViewSet, one level up - no content_type_id in these URLs).

@pytest.mark.django_db
def test_unauthenticated_request_to_content_types_is_rejected(api_client):
    # arrange: an Organization exists
    # act: GET reverse("content-type-list", args=[organization.id]), no auth
    # assert: response.status_code == 401
    pytest.skip("your turn")


@pytest.mark.django_db
def test_non_member_cannot_access_content_types(api_client, user):
    # arrange: an Organization exists, `user` is NOT a member of it
    # act: force_authenticate(user=user); GET content-type-list
    # assert: response.status_code == 403
    pytest.skip("your turn")


@pytest.mark.django_db
def test_valid_content_type_creation_succeeds(api_client, user):
    # arrange: Organization + OrganizationMembership for `user`
    # act: POST {"name": "Event", "slug": "event"} to content-type-list
    # assert: response.status_code == 201, ContentType.objects.filter(...).exists()
    pytest.skip("your turn")


@pytest.mark.django_db
def test_duplicate_slug_in_same_org_is_rejected(api_client, user):
    # arrange: a ContentType with slug="event" already exists in the org;
    #          membership for `user`
    # act: POST another ContentType with the same slug in the same org
    # assert: response.status_code == 400 (UniqueTogetherValidator on
    #         organization+slug)
    pytest.skip("your turn")


@pytest.mark.django_db
def test_list_only_returns_content_types_for_this_organization(api_client, user):
    # arrange: two Organizations, each with its own ContentType; `user` is a
    #          member of only one of them
    # act: force_authenticate(user=user); GET content-type-list for the org
    #      `user` belongs to
    # assert: only that org's ContentType shows up in the response
    pytest.skip("your turn")


@pytest.mark.django_db
def test_retrieve_content_type_succeeds(api_client, user):
    # arrange: Organization + membership + ContentType
    # act: GET reverse("content-type-detail", args=[organization.id, content_type.id])
    # assert: response.status_code == 200, response.data["name"] matches
    pytest.skip("your turn")


# --- ContentTypeVersion ---
# URLs take [organization_id, content_type_id] (+ pk for detail), same as
# Field's. Reminder: schema is now server-generated (Decisions 94-96) - POST
# no longer needs a "schema" key in the body at all.

@pytest.mark.django_db
def test_version_creation_without_fields_is_rejected(api_client, user):
    # arrange: Organization + membership + ContentType with NO Fields
    # act: POST reverse("content-type-version-list", args=[org.id, ct.id]), {}
    # assert: response.status_code == 400 - create_content_type_version()
    #         raises ValidationError for zero Fields (Decision 95)
    pytest.skip("your turn")


@pytest.mark.django_db
def test_version_creation_generates_schema_from_fields(api_client, user):
    # arrange: Organization + membership + ContentType with a couple of
    #          Fields (mix of data_type/required)
    # act: POST to content-type-version-list
    # assert: response.status_code == 201, response.data["schema"]["properties"]
    #         has one entry per Field, response.data["schema"]["required"]
    #         matches which Fields have required=True
    pytest.skip("your turn")


@pytest.mark.django_db
def test_version_number_increments_across_requests(api_client, user):
    # arrange: same setup as above, POST once already to create v1
    # act: POST again to create a second version
    # assert: second response.data["version_number"] == first + 1
    pytest.skip("your turn")


@pytest.mark.django_db
def test_list_returns_versions_for_this_content_type_only(api_client, user):
    # arrange: two ContentTypes under the same org, each with Fields and its
    #          own version created
    # act: GET content-type-version-list for content_type_a
    # assert: only content_type_a's version(s) appear, newest first
    #         (get_queryset() orders by "-version_number")
    pytest.skip("your turn")


@pytest.mark.django_db
def test_retrieve_version_succeeds(api_client, user):
    # arrange: a version exists (create via create_content_type_version or a
    #          real POST)
    # act: GET content-type-version-detail
    # assert: response.status_code == 200, response.data["version_number"] matches
    pytest.skip("your turn")


# --- Entry ---
# URLs take [organization_id, content_type_id] (+ pk for detail). Entry list
# is cursor-paginated (EntryCursorPagination, page_size=50) - list responses
# look like {"next", "previous", "results"}, not a bare list.

@pytest.mark.django_db
def test_entry_creation_attaches_to_latest_version(api_client, user):
    # arrange: a ContentType with Fields and TWO versions created one after
    #          another (v1, then add/change a Field and create v2)
    # act: POST an Entry
    # assert: the created Entry's content_type_version == the v2 row, not v1 -
    #         EntryViewSet.get_serializer_context() always resolves the
    #         *latest* version on create (Decision 66)
    pytest.skip("your turn")


@pytest.mark.django_db
def test_entry_creation_fails_when_no_version_exists(api_client, user):
    # arrange: a ContentType with Fields but NO ContentTypeVersion ever
    #          published (version-creation deliberately skipped in this test)
    # act: POST an Entry
    # assert: response.status_code == 404 - get_serializer_context() raises
    #         NotFound when latest_version is None
    pytest.skip("your turn")


@pytest.mark.django_db
def test_list_only_returns_entries_for_this_content_type(api_client, user):
    # arrange: two ContentTypes (each with a version), each with its own Entry
    # act: GET entry-list for content_type_a
    # assert: response.data["results"] contains only content_type_a's Entry
    pytest.skip("your turn")


@pytest.mark.django_db
def test_retrieve_entry_succeeds(api_client, user):
    # arrange: an Entry exists (ContentType + version + entry)
    # act: GET entry-detail
    # assert: response.status_code == 200
    pytest.skip("your turn")


@pytest.mark.django_db
def test_entry_list_is_paginated(api_client, user):
    # arrange: create more than 50 Entries under one ContentType/version
    #          (EntryCursorPagination.page_size == 50)
    # act: GET entry-list
    # assert: response.data has "next"/"previous"/"results" keys (not a bare
    #         list like Field's unpaginated list), len(results) == 50, and
    #         response.data["next"] is not None
    pytest.skip("your turn")
