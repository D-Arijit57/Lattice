from rest_framework.permissions import BasePermission

class HasValidAPIKey(BasePermission):
    def has_permission(self, request, view):
        return getattr(request, "auth", None) is not None