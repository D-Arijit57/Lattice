import pytest
from django.urls import reverse

LOGIN_URL = reverse("token-obtain-pair")  # -> "/api/auth/login/"
PROTECTED_URL = reverse("protected-test")  # -> "/api/auth/protected/"


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
    # arrange: user.email, but the wrong password.
    # act: POST to LOGIN_URL.
    # assert: response.status_code == 401, and "access" is not in response.data.
    pytest.skip("your turn")


@pytest.mark.django_db
def test_protected_endpoint_without_token_is_rejected(api_client):
    # No login call at all here - a bare, anonymous GET.
    # act: api_client.get(PROTECTED_URL)
    # assert: response.status_code == 401
    pytest.skip("your turn")


@pytest.mark.django_db
def test_protected_endpoint_with_valid_token_succeeds(api_client, user):
    # This is the real end-to-end check - the whole reason we're doing this
    # in pytest instead of curl. It must NOT use force_authenticate() (see
    # api/accounts/tests.py) - that helper injects request.user directly
    # and skips JWTAuthentication entirely, so it would prove nothing about
    # whether our actual token mechanism works.
    #
    # Instead:
    #   1. log in for real:
    #        login_response = api_client.post(LOGIN_URL, {...}, format="json")
    #        access_token = login_response.data["access"]
    #   2. attach it the way a real client would, with api_client.credentials():
    #        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
    #      credentials() sets a header that gets sent automatically on every
    #      request this client makes from now on - it's the closest thing to
    #      "the client's browser/app attached its token."
    #   3. act: response = api_client.get(PROTECTED_URL)
    #   4. assert: response.status_code == 200
    #      assert user.name in response.data["message"]
    pytest.skip("your turn")


@pytest.mark.django_db
def test_protected_endpoint_with_garbage_token_is_rejected(api_client):
    # arrange: api_client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")
    # act: api_client.get(PROTECTED_URL)
    # assert: response.status_code == 401
    pytest.skip("your turn")
