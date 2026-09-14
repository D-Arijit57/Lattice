import pytest
from django.urls import reverse

from accounts.models import Organization, OrganizationMembership, User

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
    assert membership.role_id == 1  # OWNER_ROLE_ID


@pytest.mark.django_db
def test_anonymous_user_cannot_create_org(api_client):
    # No force_authenticate() call this time.
    # act: POST {"name": "Acme"} without logging in.
    # assert: response.status_code == 401 (not 403 - JWTAuthentication is the
    #         sole authentication class and implements authenticate_header(),
    #         so DRF raises NotAuthenticated for a request with no credentials
    #         at all, see Decision 87), and Organization.objects.count() == 0
    pytest.skip("your turn")


@pytest.mark.django_db
def test_blank_name_is_rejected(api_client, user):
    # arrange: force_authenticate(user=user)
    # act: POST {"name": "   "} (only spaces)
    # assert: response.status_code == 400, and no Organization row exists
    pytest.skip("your turn")


@pytest.mark.django_db
def test_list_only_returns_orgs_i_belong_to(api_client, user):
    # arrange: make a second user; create two orgs; add `user` to one via an
    #          OrganizationMembership row, the other user to the second.
    # act: force_authenticate(user=user); api_client.get(LIST_URL)
    # assert: the response lists exactly the org `user` belongs to.
    pytest.skip("your turn")


@pytest.mark.django_db
def test_retrieve_non_member_org_returns_404(api_client, user):
    # arrange: create an org that `user` is NOT a member of.
    # act: force_authenticate(user=user); GET
    #      reverse("organization-detail", args=[that_org.id])
    # assert: response.status_code == 404 - the get_queryset() filter makes a
    #         non-member org look identical to one that does not exist.
    pytest.skip("your turn")
