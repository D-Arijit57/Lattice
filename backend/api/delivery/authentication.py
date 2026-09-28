from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from accounts.models import APIKey, hash_api_key

class APIKeyAuthentication(BaseAuthentication):
    keyword = "Bearer"
    
    def authenticate(self,request):
        header = request.headers.get("Authorization", "")
        if not header.startswith(f"{self.keyword} lat_"):
            return None 
        
        raw_key = header[len(self.keyword) + 1:]
        
        try:
            api_key = APIKey.objects.get(hashed_key=hash_api_key(raw_key))
        except APIKey.DoesNotExist:
            raise AuthenticationFailed("Invalid API Key")
        
        if api_key.revoked_at is not None:
            raise AuthenticationFailed("This API key has been revoked")
        
        # No Django User here - request.user stays anonymous, request.auth
        # carries the key. Delivery views must check request.auth, never
        # IsAuthenticated (see permissions.py below - that's the bug this
        # would otherwise cause).
        return (None, api_key)        