from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response

from accounts.models import Organization, OrganizationMembership, Role
from content.models import ContentType, ContentTypeVersion, Entry, Field
from content.services.entry_validation import validate_entry_data

from api.content.serializers import BulkEntrySerializer
from api.content.serializers import ContentTypeSerializer
from api.content.serializers import ContentTypeVersionSerializer
from api.content.serializers import EntrySerializer
from api.content.serializers import FieldSerializer
from api.content.pagination import EntryCursorPagination
from django.db import transaction
from django.db.models import Max


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
                # an archived organization looks exactly like a missing one
                organization = Organization.objects.get(
                    pk=self.kwargs["organization_id"],
                    archived_at__isnull=True,
                )
            except Organization.DoesNotExist:
                raise NotFound("Organization not found.")

            # .first() returns the membership row (or None), so we get the
            # role from the same query that proves the user is a member.
            membership = OrganizationMembership.objects.filter(
                user=self.request.user,
                organization=organization,
            ).first()
            if membership is None:
                raise PermissionDenied(
                    "You are not a member of this organization."
                )

            self._organization = organization
            self._membership = membership
        return self._organization

    def initial(self, request, *args, **kwargs):
        # DRF calls initial() after authentication but BEFORE it validates the
        # body, so the role check in check_role() runs first (403, not 400).
        super().initial(request, *args, **kwargs)
        self.check_role()

    def check_role(self):
        """
        Each ViewSet overrides this to say which actions need which role, by
        calling self.require_role(...). The default requires nothing beyond
        membership, which get_organization() already enforces.
        """

    def require_role(self, minimum_role):
        """
        Raise 403 unless the caller's role is at least `minimum_role`.
        Roles are ordered numbers (VIEWER=0 < ... < OWNER=3), so >= works.
        """
        self.get_organization()  # makes sure self._membership is loaded
        if self._membership.role_id < minimum_role:
            raise PermissionDenied(
                "Your role does not allow this action."
            )


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
                    archived_at__isnull=True,
                )
            except ContentType.DoesNotExist:
                raise NotFound("Content type not found.")
        return self._content_type


class ContentTypeViewSet(OrganizationScopedViewSet):
    """
    list     -> GET    /organizations/<org>/content-types/
    retrieve -> GET    /organizations/<org>/content-types/<pk>/
    create   -> POST   /organizations/<org>/content-types/
    archive  -> DELETE /organizations/<org>/content-types/<pk>/   (soft delete)
    """
    # Configuration: tells DRF which serializer to use for this ViewSet.
    serializer_class = ContentTypeSerializer

    # Changing the schema (new / removed content types) needs ADMIN or higher.
    ADMIN_ACTIONS = {"create", "archive"}

    def check_role(self):
        if self.action in self.ADMIN_ACTIONS:
            self.require_role(Role.ADMIN)

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
            .filter(organization=organization, archived_at__isnull=True)
            .order_by("name")
        )

    def archive(self, request, *args, **kwargs):
        # get_object() goes through get_queryset(), so an unknown, foreign or
        # already-archived content type is a 404 - and so is any other org's.
        content_type = self.get_object()
        content_type.archived_at = timezone.now()
        content_type.save(update_fields=["archived_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

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

    # Publishing a version freezes the schema: ADMIN or higher.
    # (Editors will request a publish instead; see the publish-request phase.)
    def check_role(self):
        if self.action == "create":
            self.require_role(Role.ADMIN)

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
    

class FieldViewSet(ContentTypeScopedViewSet):
    """
    list     -> GET    .../content-types/<ct>/fields/
    retrieve -> GET    .../content-types/<ct>/fields/<pk>/
    create   -> POST   .../content-types/<ct>/fields/
    archive  -> DELETE .../content-types/<ct>/fields/<pk>/   (soft delete)

    These are the *current, live* field definitions for a content type -
    editing them has no effect on ContentTypeVersions already cut. Schema
    generation reads whatever live (non-archived) Fields exist here at the
    moment a new version is created. Archiving a field therefore only takes
    effect in the next version: published versions keep it.
    """

    serializer_class = FieldSerializer

    # Live fields are the draft schema: nothing takes effect until a version is
    # published (and that needs ADMIN, or an admin's approval). So EDITOR may
    # add and archive fields.
    EDITOR_ACTIONS = {"create", "archive"}

    def check_role(self):
        if self.action in self.EDITOR_ACTIONS:
            self.require_role(Role.EDITOR)

    def get_queryset(self):
        content_type = self.get_content_type()
        return (
            Field.objects
            .filter(content_type=content_type, archived_at__isnull=True)
            .order_by("name")
        )

    def archive(self, request, *args, **kwargs):
        field = self.get_object()
        field.archived_at = timezone.now()
        field.save(update_fields=["archived_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # FieldSerializer.content_type is a HiddenField whose default
        # (CurrentContentTypeDefault) reads context["content_type"].
        context["content_type"] = self.get_content_type()
        return context


class EntryViewSet(mixins.UpdateModelMixin, ContentTypeScopedViewSet):
    """
    list     -> GET  .../content-types/<ct>/entries/   (oldest first, by number)
    retrieve -> GET  .../content-types/<ct>/entries/<pk>/
    create   -> POST .../content-types/<ct>/entries/
    partial_update -> PATCH  .../entries/<pk>/          (edit data in place)
    archive  -> DELETE .../entries/<pk>/                (soft delete)
    archive_all -> DELETE .../content-types/<ct>/entries/  (soft delete every live entry)
    restore  -> POST   .../entries/<pk>/restore/

    list hides archived entries unless ?archived=true (then it shows only
    those). Edits are validated against the entry's own pinned version and
    never change its number, version or created_at. list returns entries across every version of the content type. A new
    entry always attaches to the *latest* version, resolved here and only on
    create. list is cursor-paginated (EntryCursorPagination) - the response is
    {"next", "previous", "results"}, 50 rows per page, no total count.
    """

    serializer_class = EntrySerializer
    
    # custom pagination mechanism configuration
    pagination_class = EntryCursorPagination

    # Every action that changes an entry needs EDITOR or higher; list and
    # retrieve need only membership.
    EDITOR_ACTIONS = {
        "create", "bulk_create", "update", "partial_update",
        "archive", "archive_all", "restore",
    }

    def check_role(self):
        if self.action in self.EDITOR_ACTIONS:
            self.require_role(Role.EDITOR)

    def get_queryset(self):
        content_type = self.get_content_type()
        queryset = (
            Entry.objects
            .filter(content_type=content_type)
            .select_related("content_type_version")
            .order_by("number", "id")
        )
        # Only the list is filtered: detail/restore must still find archived rows.
        if self.action == "list":
            if self.request.query_params.get("archived") == "true":
                queryset = queryset.filter(archived_at__isnull=False)
            else:
                queryset = queryset.filter(archived_at__isnull=True)
        return queryset

    def perform_update(self, serializer):
        if serializer.instance.archived_at is not None:
            raise ValidationError({"detail": "Restore this entry before editing it."})
        serializer.save()

    def archive(self, request, *args, **kwargs):
        entry = self.get_object()
        if entry.archived_at is None:
            entry.archived_at = timezone.now()
            entry.save(update_fields=["archived_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def archive_all(self, request, *args, **kwargs):
        # One UPDATE for every live entry of this content type. Nothing is
        # removed: each row can still be restored individually. update()
        # skips auto_now, so updated_at is set by hand.
        now = timezone.now()
        count = (
            Entry.objects
            .filter(content_type=self.get_content_type(), archived_at__isnull=True)
            .update(archived_at=now, updated_at=now)
        )
        return Response({"archived": count})

    def restore(self, request, *args, **kwargs):
        entry = self.get_object()
        if entry.archived_at is not None:
            entry.archived_at = None
            entry.save(update_fields=["archived_at", "updated_at"])
        return Response(EntrySerializer(entry).data)
    
    def perform_create(self, serializer):
        # while you perform the creation always use atomicity
        with transaction.atomic():
            # lock the content type
            # select_for_update() lives on the queryset (ContentType.objects),
            # not on the view, so we re-fetch the row we already resolved,
            # this time locked: a concurrent create for the same content type
            # waits here until this transaction commits or rolls back
            locked_content_type = ContentType.objects.select_for_update().get(
                pk=self.get_content_type().pk
            )

            # get the max number then + 1
            # Max() returns None when this content type has no entries yet,
            # hence the "or 0". This stays inside the with-block: the lock is
            # released when the block ends, so the read and the insert below
            # must both happen while we still hold it.
            last_sequence_number = Entry.objects.filter(
                content_type=locked_content_type
            ).aggregate(Max("number"))["number__max"]
            next_sequence_number = (last_sequence_number or 0) + 1

            # validated_data holds content_type_version (HiddenField, filled
            # from context) and data; Entry.save() derives content_type from
            # the version, so we don't pass it here
            entry = Entry.objects.create(
                content_type_version=serializer.validated_data["content_type_version"],
                data=serializer.validated_data["data"],
                number=next_sequence_number,
            )

        # we skipped serializer.save(), so tell the serializer which object
        # was created - the 201 response is built from serializer.data
        serializer.instance = entry

    def get_latest_version(self):
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
        return latest_version

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # Only a create needs a target version; list / retrieve do not.
        if self.action == "create":
            # EntrySerializer.content_type_version is a HiddenField whose
            # default (CurrentContentTypeVersionDefault) reads this key.
            context["content_type_version"] = self.get_latest_version()
        elif self.action == "partial_update":
            # An edit stays on the version the entry was saved under.
            context["content_type_version"] = self.get_object().content_type_version
        return context

    def bulk_create(self, request, *args, **kwargs):
        """
        POST .../content-types/<ct>/entries/bulk/   body: {"entries": [{...}, ...]}

        All-or-nothing: every row is validated first, and only if all of them
        pass are they inserted (one lock, one INSERT). A rejected batch saves
        nothing and answers 400 {"errors": [{"row": 3, "data": {"price": [...]}}]}
        where "row" is the 0-based index into the array that was sent.

        Not a ModelViewSet action: urls.py binds it by hand, like the others.
        """
        # Runs the org-exists / is-member / content-type-belongs-to-org checks
        # (this is the permission gate - nothing else on this path does it).
        content_type = self.get_content_type()
        # Read once: every row is validated against, and stored under, this
        # same version even if someone publishes a newer one mid-request.
        version = self.get_latest_version()

        envelope = BulkEntrySerializer(data=request.data)
        envelope.is_valid(raise_exception=True)
        rows = envelope.validated_data["entries"]

        # Validate everything BEFORE taking the lock, so a slow or invalid
        # batch never makes other writers of this content type wait.
        errors = []
        for index, row in enumerate(rows):
            row_errors = validate_entry_data(version.schema, row)
            if row_errors:
                errors.append({"row": index, "data": row_errors})
        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Same lock as perform_create, taken once for the whole batch.
            locked_content_type = ContentType.objects.select_for_update().get(
                pk=content_type.pk
            )
            last_sequence_number = Entry.objects.filter(
                content_type=locked_content_type
            ).aggregate(Max("number"))["number__max"]
            first_number = (last_sequence_number or 0) + 1

            # bulk_create() skips Entry.save(), which is what normally derives
            # content_type from the version - so it is set here by hand.
            created = Entry.objects.bulk_create([
                Entry(
                    content_type_version=version,
                    content_type_id=version.content_type_id,
                    data=row,
                    number=first_number + offset,
                )
                for offset, row in enumerate(rows)
            ])

        return Response(
            {
                "created": len(created),
                "entries": EntrySerializer(created, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )
