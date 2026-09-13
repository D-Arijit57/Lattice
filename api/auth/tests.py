import pytest
from django.urls import reverse

SIGNUPURL = reverse("signup")  # -> "/api/auth/signup/"
LOGIN_URL = reverse("token-obtain-pair")  # -> "/api/auth/login/"
# organization-list requires IsAuthenticated (api/accounts/views.py) - used
# below as a real endpoint to prove the JWT chain actually protects
# something, instead of a throwaway demo view.
ORG_LIST_URL = reverse("organization-list")  # -> "/api/organizations/"

@pytest.mark.django_db
def test_valid_signup(api_client):
    response = api_client.post(
        SIGNUPURL,
        {"name": "Grace", "email": "grace@example.com", "password": "pw123456"},
        format="json",
    )
    assert response.status_code == 201
    # since the password shouldn't be leaked in client side response
    # we should check it as well
    assert "password" not in response.data
    # since there shouldn't be no auto login
    # the response shouldn't contain refresh or access tokens at all
    assert "access" not in response.data
    assert "refresh" not in response.data
    

@pytest.mark.django_db
def test_valid_login_returns_tokens(api_client, user):
    # act: the `user` fixture (conftest.py) was created with password
    # "pw12345" - that's the one plaintext place it's ever written, since
    # User.objects.create_user() immediately hashes it and never stores it.
    response = api_client.post(
        LOGIN_URL,
        {"email": user.email, "password": "pw12345"},
        format="json",
    )
    # assert: TokenObtainPairView returns 200 with both tokens on success.
    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data


@pytest.mark.django_db
def test_invalid_credentials_are_rejected(api_client, user):
    response = api_client.post(
        LOGIN_URL,
        {"email": user.email, "password": "definitely-wrong-password"},
        format ="json"
    )
    # check if the returned status code is 401 or not
    assert response.status_code == 401
    # check if we are not getting the refresh or access token in case it bypasses and it gives 200 OK
    assert "access" not in response.data
    assert "refresh" not in response.data


@pytest.mark.django_db
def test_unauthenticated_request_to_real_endpoint_is_rejected(api_client):
    # No login call at all - a bare, anonymous GET at a real endpoint that
    # requires IsAuthenticated (OrganizationViewSet).
    response = api_client.get(ORG_LIST_URL)
    assert response.status_code == 401


@pytest.mark.django_db
def test_valid_token_grants_access_to_real_endpoint(api_client, user):
    # The real end-to-end check - the whole reason this is a pytest test
    # and not just a curl call. Deliberately does NOT use
    # force_authenticate() (see api/accounts/tests.py) - that helper
    # injects request.user directly and skips JWTAuthentication entirely,
    # so it would prove nothing about whether the real token mechanism
    # works.
    login_response = api_client.post(
        LOGIN_URL,
        {"email": user.email, "password": "pw12345"},
        format="json",
    )
    access_token = login_response.data["access"]

    # credentials() attaches a header that's sent automatically on every
    # request this client makes from now on - the closest thing to "the
    # client's browser/app attached its token."
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
    response = api_client.get(ORG_LIST_URL)
    assert response.status_code == 200


@pytest.mark.django_db
def test_garbage_token_is_rejected(api_client):
    api_client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
    response = api_client.get(ORG_LIST_URL)
    assert response.status_code == 401
