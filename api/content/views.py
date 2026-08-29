from rest_framework import mixins, permissions, viewsets
from rest_framework.exceptions import NotFound, PermissionDenied

from accounts.models import Organization, OrganizationMembership
from content.models import ContentType, ContentTypeVersion, Entry

from api.content.serializers import ContentTypeSerializer
from api.content.serializers import ContentTypeVersionSerializer
from api.content.serializers import EntrySerializer
from api.content.pagination import EntryCursorPagination


class OrganizationScopedViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    """
    Base for every content ViewSet.

    - ListModelMixin      gives us `list`
    - RetrieveModelMixin  gives us `retrieve`
    - CreateModelMixin    gives us `create`
    - GenericViewSet      gives us the plumbing they call
      (get_queryset, get_object, get_serializer, ...)

    We deliberately do NOT inherit update / partial_update / destroy - those
    endpoints are out of scope for now, so the class declaration itself says
    "read + create only".

    Every request in this layer is scoped to one organization, named in the
    URL as <organization_id>. Before any row is read or written we check:
      1. the organization exists       -> otherwise 404
      2. the caller is a member of it  -> otherwise 403

    get_organization() runs both checks once and caches the answer on the
    instance, so get_queryset() and get_serializer_context() can both call it
    in the same request without a second round of queries. DRF builds a fresh
    view instance per request, so the cache never leaks between requests.

    Note: inside a mixin-driven flow we are too deep in inherited code to
    `return Response(...)`, so a failed check raises an exception instead and
    DRF's handler turns it into the 404 / 403 with a {"detail": "..."} body.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_organization(self):
        # Cache the organization on this ViewSet instance.
        # The first call fetches it from the DB and stores it in self._organization.
        # Later calls during the same request reuse the cached object instead of
        # querying the database again. Each request gets its own ViewSet instance,
        # so the cache does not get shared between different requests.
        if not hasattr(self, "_organization"):
            try:
                organization = Organization.objects.get(
                    pk=self.kwargs["organization_id"]
                )
            except Organization.DoesNotExist:
                raise NotFound("Organization not found.")

            is_member = OrganizationMembership.objects.filter(
                user=self.request.user,
                organization=organization,
            ).exists()
            if not is_member:
                raise PermissionDenied(
                    "You are not a member of this organization."
                )

            self._organization = organization
        return self._organization


class ContentTypeScopedViewSet(OrganizationScopedViewSet):
    """
    Base for ViewSets nested under one content type:
        /organizations/<organization_id>/content-types/<content_type_id>/...

    get_content_type() looks the content type up with organization=... in the
    same query, so a content type that belongs to another org looks exactly
    like one that does not exist - a 404 either way, no leak of which
    content_type ids are real under some other org.
    """

    def get_content_type(self):
        if not hasattr(self, "_content_type"):
            organization = self.get_organization()
            try:
                self._content_type = ContentType.objects.get(
                    pk=self.kwargs["content_type_id"],
                    organization=organization,
                )
            except ContentType.DoesNotExist:
                raise NotFound("Content type not found.")
        return self._content_type


class ContentTypeViewSet(OrganizationScopedViewSet):
    """
    list     -> GET  /organizations/<org>/content-types/
    retrieve -> GET  /organizations/<org>/content-types/<pk>/
    create   -> POST /organizations/<org>/content-types/
    """
    # Configuration: tells DRF which serializer to use for this ViewSet.
    serializer_class = ContentTypeSerializer
    # querySet(), get_serializer_context() are bascially the hooks or the decisions provided by us
    # the DRF controls the overall workflow
    
    
    # get_queryset() is a DRF hook used by the generic views/mixins.
    # It returns a Django QuerySet describing which objects this ViewSet
    # is allowed to work with.
    # DRF calls this internally, e.g. during list() and retrieve().
    # get_queryset() returns a Django QuerySet describing the data this ViewSet should operate on. Django evaluates that QuerySet when the data is actually needed.
    def get_queryset(self):
        organization = self.get_organization()
        return (
            ContentType.objects
            .filter(organization=organization)
            .order_by("name")
        )

    # get_serializer_context : provided by genericViewSet
    # it gets internally called by DRF's get_serializer()
    def get_serializer_context(self):
        
        # get the version of this method from the parent class (that is from genericViewSet)
        # DRF's normal format is {
        #     "request": request,
        #     "format": ...,
        #     "view": self
        # }
        # So we don't throw that away we just add another context that is organization as our organization 
        
        context = super().get_serializer_context()
        # ContentTypeSerializer.organization is a HiddenField whose default
        # (CurrentOrganizationDefault) reads context["organization"].
        
        # Add our application specific context that is organization
        context["organization"] = self.get_organization()
        return context


class ContentTypeVersionViewSet(ContentTypeScopedViewSet):
    """
    list     -> GET  .../content-types/<ct>/versions/   (newest version first)
    retrieve -> GET  .../content-types/<ct>/versions/<pk>/
    create   -> POST .../content-types/<ct>/versions/

    We don't touch create here: ContentTypeVersionSerializer.create()
    delegates to content.services.versioning.create_content_type_version(),
    which locks the parent row and assigns the next version_number.
    """

    serializer_class = ContentTypeVersionSerializer

    def get_queryset(self):
        content_type = self.get_content_type()
        return (
            ContentTypeVersion.objects
            .filter(content_type=content_type)
            .order_by("-version_number")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # ContentTypeVersionSerializer.content_type is a HiddenField whose
        # default (CurrentContentTypeDefault) reads context["content_type"].
        context["content_type"] = self.get_content_type()
        return context


class EntryViewSet(ContentTypeScopedViewSet):
    """
    list     -> GET  .../content-types/<ct>/entries/   (newest first)
    retrieve -> GET  .../content-types/<ct>/entries/<pk>/
    create   -> POST .../content-types/<ct>/entries/

    list returns entries across every version of the content type. A new
    entry always attaches to the *latest* version, resolved here and only on
    create. list is cursor-paginated (EntryCursorPagination) - the response is
    {"next", "previous", "results"}, 50 rows per page, no total count.
    """

    serializer_class = EntrySerializer
    
    # custom pagination mechanism configuration
    pagination_class = EntryCursorPagination

    def get_queryset(self):
        content_type = self.get_content_type()
        return (
            Entry.objects
            .filter(content_type_version__content_type=content_type)
            .select_related("content_type_version")
            .order_by("-created_at", "-id")
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # Only a create needs a target version; list / retrieve do not.
        if self.action == "create":
            latest_version = (
                ContentTypeVersion.objects
                .filter(content_type=self.get_content_type())
                # -version_number : - is django orm syntax for descending order
                # since we want to get the latest version 
                .order_by("-version_number")
                .first()
            )
            if latest_version is None:
                raise NotFound("This content type has no versions yet.")
            # EntrySerializer.content_type_version is a HiddenField whose
            # default (CurrentContentTypeVersionDefault) reads this key.
            context["content_type_version"] = latest_version
        return context
