from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status

from api.auth.serializers.signup_serializer import SignupSerializer


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