from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from accounts.models import Organization, OrganizationMembership
from content.models import ContentType
from content.models import ContentTypeVersion
from api.content.serializers import ContentTypeSerializer
from api.content.serializers import ContentTypeVersionSerializer
from api.content.serializers import EntrySerializer

# So here it is acting like the orchestrator of this particular API Request
class ContentTypeCreateView(APIView):
    # check if the user is authenticated
    # isAuthenticated is provided by DRF, it's only true if the user has authenticatd 
    # through our authentication mechanism
    # also we don't check permission classes anywhere, becasue APIview does that for us
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

# View defines what actions should be done
# before it goes for translation and validation in serializer
class ContentTypeVersionCreateView(APIView):
    # [] needed since DRF iterates over permisson_classes and a bare class isn't iteratable
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, content_type_id, organization_id):
    # the content_type_version creation a user needs to be a valid member of the specific organization the content type is from as well as the content type should exist in that organization
        try:
            organization = Organization.objects.get(pk=organization_id)
        except Organization.DoesNotExist:
            return Response(
                {"detail": "Organization not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # we need to check the organization membership first
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

        # check if the content type exist in that organization or not 
        # since the content_type has a fk organization_id 
        # we can use that to find out if this specific content_type actually exist in that orgnization
        try:
            content_type = ContentType.objects.get(pk=content_type_id, organization=organization)
        except ContentType.DoesNotExist:
            return Response(
                {"detail": "Content type doesn't exist"},
                status=status.HTTP_404_NOT_FOUND
            )
        # you have to be a member of the organization to create a new version of the existing content
        serializer = ContentTypeVersionSerializer(
            data=request.data,
            context={"content_type": content_type, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

# Entry : this is where the actual content lives
class EntryCreateView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, organization_id, content_type_id):
    # the user should have a valid organization membership before being allowed to sent any request
        try :
            organization = Organization.objects.get(pk=organization_id)
        except Organization.DoesNotExist:
            return Response(
                {"detail": "Organization not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        # Membership check
        is_member = OrganizationMembership.objects.filter(
            user = request.user,
            organization = organization
        ).exists()
        
        if not is_member:
            return Response(
                {"detail": "You are not a member of this organization."},
                status=status.HTTP_403_FORBIDDEN,
            )
        
        # check if the content type exist in that organization or not 
        # since the content_type has a fk organization_id 
        # we can use that to find out if this specific content_type actually exist in that orgnization
        try:
            content_type = ContentType.objects.get(pk=content_type_id, organization=organization)
        except ContentType.DoesNotExist:
            return Response(
                {"detail": "Content type doesn't exist"},
                status=status.HTTP_404_NOT_FOUND
            )
        # find the latest version of the verified content type
        # version is handled by the backend, user shouldn't decide the version
        latest_version = (
            ContentTypeVersion.objects.filter(content_type=content_type)
            .order_by("-version_number")
            .first()
        )

        # check if that content type has any version at all
        if latest_version is None:
            return Response(
                {"detail": "This content type has no versions yet."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # sent the client request data to the EntrySerializer
        serializer = EntrySerializer(
            data=request.data,
            context={
                "content_type_version": latest_version,
                "request": request,
            },
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
