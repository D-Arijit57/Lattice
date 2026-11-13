import pytest
from django.urls import reverse

from accounts.models import Organization, OrganizationMembership, Role, User

# reverse() turns the name= we set in urls.py into the path string.
LIST_URL = reverse("organization-list")  # -> "/api/organizations/"


@pytest.mark.django_db
def test_authenticated_user_can_create_org(api_client, user):
    # arrange: mark `user` as the logged-in caller
    api_client.force_authenticate(user=user)

    # act: format="json" sends a JSON body (the default would be multipart)
    response = api_client.post(LIST_URL, {"name": "Acme"}, format="json")

    # assert: the HTTP response
    assert response.status_code == 201
    assert response.data["name"] == "Acme"

    # assert: the database side effects - both rows, because
    # perform_create() writes the Organization AND the membership.
    org = Organization.objects.get(name="Acme")
    membership = OrganizationMembership.objects.get(organization=org, user=user)
    assert membership.role_id == Role.OWNER


# Triage note (2026-09-20): the stub "anonymous user cannot create org" was
# DROPPED as redundant. OrganizationViewSet's IsAuthenticated gate is already
# proven by test_unauthenticated_request_to_real_endpoint_is_rejected in
# api/auth/tests.py (anonymous request -> 401, Decision 87), and the permission
# class applies to every action, so a POST-specific copy would test the same
# code. Kept here so it isn't re-added by accident.


@pytest.mark.django_db
def test_blank_name_is_rejected(api_client, user):
    api_client.force_authenticate(user=user)

    # only spaces: DRF's CharField trims whitespace, so this counts as blank
    response = api_client.post(LIST_URL, {"name": "   "}, format="json")

    assert response.status_code == 400
    assert Organization.objects.count() == 0


@pytest.mark.django_db
def test_list_only_returns_orgs_i_belong_to(api_client, user):
    other_user = User.objects.create_user(
        email="bob@example.com", name="Bob", password="pw12345"
    )
    mine = Organization.objects.create(name="Mine")
    theirs = Organization.objects.create(name="Theirs")
    OrganizationMembership.objects.create(user=user, organization=mine, role_id=Role.OWNER)
    OrganizationMembership.objects.create(user=other_user, organization=theirs, role_id=Role.OWNER)
    api_client.force_authenticate(user=user)

    response = api_client.get(LIST_URL)

    assert response.status_code == 200
    assert [org["name"] for org in response.data] == ["Mine"]


@pytest.mark.django_db
def test_retrieve_non_member_org_returns_404(api_client, user):
    secret = Organization.objects.create(name="Secret")  # `user` is NOT a member
    api_client.force_authenticate(user=user)

    response = api_client.get(reverse("organization-detail", args=[secret.id]))

    # 404, not 403: get_queryset() only contains the caller's orgs, so a
    # non-member org looks identical to one that doesn't exist and its
    # existence isn't revealed.
    assert response.status_code == 404


# --- Archive (soft delete) an organization ---------------------------------------

@pytest.mark.django_db
def test_member_can_archive_an_organization(api_client, user):
    org = Organization.objects.create(name="Acme")
    OrganizationMembership.objects.create(user=user, organization=org, role_id=Role.OWNER)
    api_client.force_authenticate(user=user)
    detail = reverse("organization-detail", args=[org.id])

    assert api_client.delete(detail).status_code == 204

    org.refresh_from_db()
    assert org.archived_at is not None            # soft: the row is kept
    assert api_client.get(LIST_URL).data == []
    assert api_client.get(detail).status_code == 404
    # everything under it is unreachable too
    assert api_client.get(reverse("content-type-list", args=[org.id])).status_code == 404


@pytest.mark.django_db
def test_non_member_cannot_archive_an_organization(api_client, user):
    org = Organization.objects.create(name="Theirs")
    api_client.force_authenticate(user=user)

    response = api_client.delete(reverse("organization-detail", args=[org.id]))

    assert response.status_code == 404  # not in this user's queryset
    org.refresh_from_db()
    assert org.archived_at is None


@pytest.mark.django_db
def test_api_key_of_an_archived_organization_stops_working(api_client, user):
    from accounts.models import APIKey, hash_api_key

    org = Organization.objects.create(name="Acme")
    OrganizationMembership.objects.create(user=user, organization=org, role_id=Role.OWNER)
    APIKey.objects.create(organization=org, name="k", hashed_key=hash_api_key("lat_orgkey"))
    headers = {"HTTP_AUTHORIZATION": "Bearer lat_orgkey"}
    assert api_client.get("/api/delivery/content-types/", **headers).status_code == 200

    api_client.force_authenticate(user=user)
    api_client.delete(reverse("organization-detail", args=[org.id]))
    api_client.force_authenticate(user=None)

    # same as a revoked key: DRF answers 401 or 403 depending on the auth class
    assert api_client.get("/api/delivery/content-types/", **headers).status_code in (401, 403)
