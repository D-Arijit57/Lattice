from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieJWTAuthentication(JWTAuthentication):
    # Stock JWTAuthentication only looks at the Authorization header, which
    # is empty for us - the frontend never sees the access token, it only
    # lives in the httpOnly access_token cookie. Override just the part
    # that extracts the raw token string; everything after that (decode,
    # signature check, user lookup) stays the same as the stock class.
    def get_raw_token_from_request(self, request):
        return request.COOKIES.get("access_token")

    def authenticate(self, request):
        raw_token = self.get_raw_token_from_request(request)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        return self.get_user(validated_token), validated_token
