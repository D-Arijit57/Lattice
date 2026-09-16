from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from api.auth.serializers.signup_serializer import SignupSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.settings import api_settings
from django.conf import settings

class SignupView(APIView):
    # AllowAny: signup has to be reachable by someone who isn't
    # authenticated yet - that's the whole point of the endpoint.
    permission_classes = [AllowAny]

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
    def post(self, request, *args, **kwargs):
        # super().post() runs simplejwt's normal login: validates
        # credentials via the serializer and returns a Response whose
        # .data is {"access": ..., "refresh": ...}. We only change what
        # happens to that response after it's built.
        response = super().post(request, *args, **kwargs)

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