from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework.throttling import BaseThrottle, ScopedRateThrottle

from api.auth.serializers.signup_serializer import SignupSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.settings import api_settings
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class SignupView(APIView):
    # No authentication at all: an expired leftover access cookie must not
    # turn signup into a 401 (API-Contract.md, Surprise 1).
    authentication_classes = []
    # AllowAny: signup has to be reachable by someone who isn't
    # authenticated yet - that's the whole point of the endpoint.
    permission_classes = [AllowAny]
    # Strict per-IP limit (DEFAULT_THROTTLE_RATES["signup"]) against signup
    # spam. Naming ScopedRateThrottle here replaces the loose default
    # throttles for this view only; the scope picks which rate applies.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "signup"

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        # raise_exception=True: if validate_email/validate_password/the
        # required-field checks fail, DRF turns the ValidationError into a
        # 400 response itself - we never reach the lines below.
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # serializer.data re-serializes the saved User. password is
        # write_only, so it's already excluded here - no manual stripping
        # needed. No tokens are returned; the client must call
        # /api/auth/login/ next (signup and login stay separate).
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
class CookieTokenObtainPairView(TokenObtainPairView):
    # Strictest limit: this is the endpoint password guessing goes through.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        # super().post() runs simplejwt's normal login: validates
        # credentials via the serializer and returns a Response whose
        # .data is {"access": ..., "refresh": ...}. We only change what
        # happens to that response after it's built.
        try:
            response = super().post(request, *args, **kwargs)
        except AuthenticationFailed:
            # Wrong password or unknown email (same error for both, by
            # design). Log the caller's address, never the email or password:
            # a burst of these from one address is what a guessing attack
            # looks like. get_ident() is the same lookup the throttle uses,
            # so it honours NUM_PROXIES and shows the real client behind the
            # proxy, not the proxy itself.
            logger.warning("login failed ip=%s", BaseThrottle().get_ident(request))
            raise

        # .pop() both reads the token and removes it from response.data in
        # one step. This is what actually makes the tokens httpOnly: if we
        # left them in response.data too, they'd still be readable by any
        # JS that touches the fetch() response, cookie flag or not.
        access_token = response.data.pop("access")
        refresh_token = response.data.pop("refresh")

        # access_token cookie: sent on every request (path="/"), since any
        # authenticated endpoint needs to read it.
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
            path="/",
            # max_age is read from SIMPLE_JWT settings, not hardcoded, so
            # the cookie's lifetime can't silently drift out of sync with
            # the token's actual signed expiry.
            max_age=int(api_settings.ACCESS_TOKEN_LIFETIME.total_seconds())
        )

        # refresh_token cookie: deliberately scoped to only the refresh
        # endpoint's path (must start with "/" - cookie Path is an
        # absolute path, not a relative one). The browser will not attach
        # this cookie to any other request, which shrinks what's exposed
        # if some other endpoint/response is ever compromised.
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
            path="/api/auth/refresh/",
            max_age=int(api_settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
        )

        return response


class CookieTokenRefreshView(TokenRefreshView):
    # Looser than login (the frontend refreshes on its own when a token
    # expires) but still capped so a stolen refresh cookie can't be spun
    # into unlimited access tokens.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "refresh"

    def post(self, request, *args, **kwargs):
        # Stock TokenRefreshView reads the refresh token from
        # request.data["refresh"]. Ours lives in the refresh_token cookie
        # instead (scoped to this path, see CookieTokenObtainPairView), so
        # we copy it into request.data before handing off to the stock
        # implementation - everything else about token validation and
        # rotation stays exactly as simplejwt does it.
        refresh_token = request.COOKIES.get("refresh_token")
        if refresh_token is None:
            return Response(
                {"detail": "Refresh token cookie not found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        request.data["refresh"] = refresh_token
        response = super().post(request, *args, **kwargs)

        # super().post() returns {"access": ...} (rotation is off by
        # default, so no new refresh token comes back here). Same
        # pop-then-cookie treatment as login: the new access token must
        # never reach response.data, only the cookie.
        access_token = response.data.pop("access")
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=not settings.DEBUG,
            samesite="Lax",
            path="/",
            max_age=int(api_settings.ACCESS_TOKEN_LIFETIME.total_seconds()),
        )
        return response


class LogoutView(APIView):
    # Same reason: logout must still clear the cookies when the access
    # token has already expired, otherwise the user stays stuck logged in.
    authentication_classes = []

    def post(self, request):
        # delete_cookie() only works if the Path matches how the cookie was
        # set - the refresh_token cookie was scoped to
        # /api/auth/refresh/, so it has to be deleted with that same path
        # or the browser will silently keep it.
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie("access_token", path="/")
        response.delete_cookie("refresh_token", path="/api/auth/refresh/")
        return response 


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # No serializer needed - this is intentionally minimal, just enough
        # for the frontend to know who's logged in. Never include password
        # or anything else sensitive here.
        return Response({
            "id": request.user.id,
            "email": request.user.email,
            "name": request.user.name,
        })