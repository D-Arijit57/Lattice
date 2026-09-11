from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

class ProtectedDataView(APIView):
    permission_classes = [IsAuthenticated]  # This view now requires a valid JWT

    def get(self, request):
        content = {'message': f'Hello, {request.user.name}! You are authenticated.'}
        return Response(content)
    