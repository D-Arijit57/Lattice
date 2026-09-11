from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from api.auth.views import ProtectedDataView

# TokenObtainPairView checks email+password (via check_password) and
# returns {"access": ..., "refresh": ...}. TokenRefreshView trades a
# valid refresh token for a new access token once the old one expires.
urlpatterns = [
    path("login/", TokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    # Manual sanity-check route: proves a real Authorization: Bearer <token>
    # header actually resolves to request.user, end to end.
    path("protected/", ProtectedDataView.as_view(), name="protected-test"),
]
