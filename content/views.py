from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Organization, OrganizationMembership
from api.serializers.content import ContentTypeSerializer


# This class represents an API Endpoint
# So here it is acting like the orchestrator of this particular API Request
class ContentTypeCreateView(APIView):
    # check if the user is authenticated
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, organization_id):
        # try to find the organization by its id
        # if no row matches, Django raises Organization.DoesNotExist
        try:
            organization = Organization.objects.get(pk=organization_id)
        except Organization.DoesNotExist:
            return Response(
                {"detail": "Organization not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        # if member exists :
        # is_member = true
        # otherwise false
        is_member = OrganizationMembership.objects.filter(
            user=request.user,
            organization=organization,
        ).exists()

        # if the member doesn't exist in the organization
        if not is_member:
            return Response(
                {"detail": "You are not a member of this organization."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # givbe the context to the serializer
        serializer = ContentTypeSerializer(
            data=request.data,
            context={"organization": organization, "request": request},
        )

        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
