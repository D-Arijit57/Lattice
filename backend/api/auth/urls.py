from django.urls import path

from api.auth.views import (
    SignupView,
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    LogoutView,
    MeView,
)

# TokenObtainPairView checks email+password (via check_password) and
# returns {"access": ..., "refresh": ...}. TokenRefreshView trades a
# valid refresh token for a new access token once the old one expires.
# that's why we don't need a loginView and loginSerializer for that
urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
    path("login/", CookieTokenObtainPairView.as_view(), name="token-obtain-pair"),
    path("refresh/", CookieTokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
]
