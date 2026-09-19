import pytest
from django.urls import reverse
#reverse() is a utility function used to dynamically generate URL paths based on a target view's name or pattern name

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
def test_valid_login_sets_httponly_cookies_that_grant_access(api_client, user):
    # One test for the whole login -> authenticated-request flow, because a
    # token only proves anything once it is used: "login returns tokens" and
    # "a valid token grants access" are the same behavior seen from two ends.
    #
    # History: login used to return {"access", "refresh"} in the body and the
    # client sent an Authorization header. Since the httpOnly-cookie change
    # (commits 90092fc / 10833cc) the tokens live only in cookies, so the two
    # old tests (body has tokens / Bearer header grants access) went stale.
    #
    # Deliberately no force_authenticate() and no credentials(): those skip
    # the real token mechanism. Django's test client keeps the cookies from a
    # response and sends them on the next request, exactly like a browser.

    # act: the `user` fixture (conftest.py) was created with password
    # "pw12345" - the one plaintext place it's ever written, since
    # User.objects.create_user() hashes it immediately.
    login_response = api_client.post(
        LOGIN_URL,
        {"email": user.email, "password": "pw12345"},
        format="json",
    )

    assert login_response.status_code == 200
    # tokens must NOT be readable from the body, or JS could steal them and
    # the httpOnly flag would be pointless (CookieTokenObtainPairView .pop()s them)
    assert "access" not in login_response.data
    assert "refresh" not in login_response.data
    # they arrive as httpOnly cookies instead
    assert login_response.cookies["access_token"]["httponly"]
    assert login_response.cookies["refresh_token"]["httponly"]
    # the refresh cookie is scoped to the refresh endpoint only, so the
    # browser never attaches it to any other request
    assert login_response.cookies["refresh_token"]["path"] == "/api/auth/refresh/"

    # the real check: the cookie from the login response now authenticates
    response = api_client.get(ORG_LIST_URL)
    assert response.status_code == 200


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
def test_garbage_token_is_rejected(api_client):
    # The token has to go in the access_token COOKIE. CookieJWTAuthentication
    # only reads that cookie and ignores the Authorization header, so the old
    # version of this test (a garbage Bearer header) passed vacuously: the
    # header was never looked at, the request was simply anonymous. A garbage
    # cookie makes the token check actually run and fail.
    api_client.cookies["access_token"] = "not-a-real-token"
    response = api_client.get(ORG_LIST_URL)
    assert response.status_code == 401
    # 401 alone can't tell "bad token" from "no token at all" - both are 401.
    # The code can: an anonymous request gets "not_authenticated", a token that
    # was read and rejected gets "token_not_valid".
    assert response.data["code"] == "token_not_valid"
