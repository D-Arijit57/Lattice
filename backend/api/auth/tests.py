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


# ---- throttling (rate limiting) -------------------------------------------
# The limits themselves are in settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]:
# login 5/min, signup 5/min. conftest.py clears the counters before each test.

def _bad_login(client, **extra):
    return client.post(
        LOGIN_URL,
        {"email": "nobody@example.com", "password": "wrong-password"},
        format="json",
        **extra,
    )


@pytest.mark.django_db
def test_login_is_blocked_after_five_attempts(api_client):
    # Five wrong guesses are answered normally (401)...
    for _ in range(5):
        assert _bad_login(api_client).status_code == 401
    # ...the sixth never reaches the login code at all.
    response = _bad_login(api_client)
    assert response.status_code == 429
    # Retry-After tells the client how many seconds to wait, so the frontend
    # can show a message instead of guessing.
    assert int(response["Retry-After"]) > 0


@pytest.mark.django_db
def test_login_limit_is_per_address_not_global(api_client):
    # One address using up its five attempts must not lock everyone else out.
    for _ in range(6):
        _bad_login(api_client, REMOTE_ADDR="203.0.113.1")
    assert _bad_login(api_client, REMOTE_ADDR="203.0.113.1").status_code == 429
    assert _bad_login(api_client, REMOTE_ADDR="203.0.113.2").status_code == 401


@pytest.mark.django_db
def test_correct_password_is_also_blocked_once_over_the_limit(api_client, user):
    # The limit counts attempts, not failures - otherwise an attacker could
    # keep guessing and the real password would still be accepted mid-attack.
    for _ in range(5):
        _bad_login(api_client)
    response = api_client.post(
        LOGIN_URL, {"email": user.email, "password": "pw12345"}, format="json"
    )
    assert response.status_code == 429


@pytest.mark.django_db
def test_signup_is_blocked_after_five_attempts(api_client):
    def signup(i):
        return api_client.post(
            SIGNUPURL,
            {"name": "N", "email": f"user{i}@example.com", "password": "pw123456"},
            format="json",
        )

    for i in range(5):
        assert signup(i).status_code == 201
    assert signup(5).status_code == 429


@pytest.mark.django_db
def test_forwarded_header_is_ignored_when_no_proxy_is_configured(api_client):
    # NUM_PROXIES is 0 in tests, so X-Forwarded-For must NOT be trusted: if it
    # were, an attacker could dodge the limit by sending a new fake address
    # with every request.
    for i in range(5):
        _bad_login(api_client, HTTP_X_FORWARDED_FOR=f"198.51.100.{i}")
    response = _bad_login(api_client, HTTP_X_FORWARDED_FOR="198.51.100.99")
    assert response.status_code == 429


@pytest.mark.django_db
def test_health_check_is_never_throttled(api_client):
    # Azure polls this constantly from one address.
    for _ in range(40):
        assert api_client.get("/api/monitoring/health/").status_code == 200


# ---- logout / signup must work with a bad or expired access cookie ---------
# DRF authenticates any request that touches request.user, so a leftover
# expired cookie used to answer 401 before these views ran (API-Contract.md,
# Surprise 1). Both views set authentication_classes = [] so they never look
# at the cookie at all.

LOGOUT_URL = reverse("logout")


@pytest.mark.django_db
def test_logout_works_even_with_an_expired_or_garbage_access_cookie(api_client):
    api_client.cookies["access_token"] = "not-a-real-token"
    response = api_client.post(LOGOUT_URL)
    # 401 here would mean the cookies were never cleared and the user stays
    # stuck "logged in" on the client.
    assert response.status_code == 204
    # delete_cookie() answers with an already-expired cookie (max-age 0)
    assert response.cookies["access_token"]["max-age"] == 0
    assert response.cookies["refresh_token"]["max-age"] == 0


@pytest.mark.django_db
def test_signup_works_even_with_an_expired_or_garbage_access_cookie(api_client):
    api_client.cookies["access_token"] = "not-a-real-token"
    response = api_client.post(
        SIGNUPURL,
        {"name": "Lin", "email": "lin@example.com", "password": "pw123456"},
        format="json",
    )
    assert response.status_code == 201
