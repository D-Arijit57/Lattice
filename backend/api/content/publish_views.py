from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from accounts.models import Notification, Role
from accounts.services.notifications import notify, reviewers_of
from api.content.serializers.publish_request import (
    DecisionSerializer,
    PublishRequestSerializer,
    RejectionSerializer,
)
from api.content.views import ContentTypeScopedViewSet
from content.models import ContentTypeVersion, Field, PublishRequest
from content.services.schema_diff import diff_schemas, has_changes
from content.services.schema_generation import generate_schema
from content.services.versioning import create_content_type_version


class PublishRequestViewSet(ContentTypeScopedViewSet):
    """
    Editors cannot publish a version themselves. They request it, and an admin
    or owner approves (publishes the live fields as the next version) or rejects.

    list    -> GET    .../content-types/<ct>/publish-requests/            (editor+, ?status=)
    create  -> POST   .../content-types/<ct>/publish-requests/  {note}    (editor+)
    retrieve-> GET    .../publish-requests/<pk>/                          (editor+, with the diff if pending)
    cancel  -> DELETE .../publish-requests/<pk>/                          (the requester, or admin+)
    approve -> POST   .../publish-requests/<pk>/approve/  {decision_note} (admin+)
    reject  -> POST   .../publish-requests/<pk>/reject/   {decision_note} (admin+, a reason is required)
    """

    serializer_class = PublishRequestSerializer

    def check_role(self):
        if self.action in ("approve", "reject"):
            self.require_role(Role.ADMIN)
        else:
            self.require_role(Role.EDITOR)

    def get_queryset(self):
        queryset = (
            PublishRequest.objects
            .filter(content_type=self.get_content_type())
            .select_related("requested_by", "decided_by", "version")
            .order_by("-created_at", "-id")
        )
        wanted = self.request.query_params.get("status")
        if self.action == "list" and wanted:
            queryset = queryset.filter(status=wanted)
        return queryset

    # --- helpers -------------------------------------------------------------

    def current_diff(self):
        """Live (draft) fields compared with the latest published version."""
        content_type = self.get_content_type()
        fields = list(Field.objects.filter(content_type=content_type, archived_at__isnull=True))
        latest = (
            ContentTypeVersion.objects.filter(content_type=content_type)
            .order_by("-version_number").first()
        )
        draft = generate_schema(fields)
        return diff_schemas(latest.schema if latest else None, draft), bool(fields)

    def payload_for(self, publish_request):
        return {
            "organization_id": self.get_organization().pk,
            "content_type_id": publish_request.content_type_id,
            "publish_request_id": publish_request.pk,
        }

    def respond(self, publish_request, with_diff=False, code=status.HTTP_200_OK):
        context = self.get_serializer_context()
        if with_diff and publish_request.status == PublishRequest.Status.PENDING:
            context["diffs"] = {publish_request.pk: self.current_diff()[0]}
        return Response(PublishRequestSerializer(publish_request, context=context).data, status=code)

    # --- actions -------------------------------------------------------------

    def retrieve(self, request, *args, **kwargs):
        return self.respond(self.get_object(), with_diff=True)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        diff, has_fields = self.current_diff()
        if not has_fields:
            raise ValidationError({"detail": "Add at least one field before requesting a publish."})
        if not has_changes(diff):
            raise ValidationError({"detail": "Nothing to publish: the fields match the latest version."})
        try:
            with transaction.atomic():
                publish_request = serializer.save(
                    content_type=self.get_content_type(), requested_by=request.user
                )
                content_type = self.get_content_type()
                notify(
                    reviewers_of(self.get_organization(), exclude_user=request.user),
                    Notification.Kind.PUBLISH_REQUESTED,
                    f"{request.user.name} requested to publish {content_type.name}.",
                    organization=self.get_organization(),
                    payload=self.payload_for(publish_request),
                )
        except IntegrityError:
            # the unique_pending_publish_request constraint
            raise ValidationError({"detail": "There is already a pending publish request for this content type."})
        return self.respond(publish_request, with_diff=True, code=status.HTTP_201_CREATED)

    def cancel(self, request, *args, **kwargs):
        publish_request = self.get_object()
        is_requester = publish_request.requested_by_id == request.user.id
        if not (is_requester or self._membership.role_id >= Role.ADMIN):
            raise PermissionDenied("Only the requester or an admin can cancel this request.")
        if publish_request.status != PublishRequest.Status.PENDING:
            raise ValidationError({"detail": "Only a pending request can be cancelled."})
        publish_request.status = PublishRequest.Status.CANCELLED
        publish_request.decided_by = request.user
        publish_request.decided_at = timezone.now()
        publish_request.save(update_fields=["status", "decided_by", "decided_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def approve(self, request, *args, **kwargs):
        body = DecisionSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        publish_request = self.get_object()
        with transaction.atomic():
            # lock the request so two reviewers cannot both approve it
            locked = PublishRequest.objects.select_for_update().get(pk=publish_request.pk)
            if locked.status != PublishRequest.Status.PENDING:
                raise ValidationError({"detail": "This request has already been decided."})
            diff, _ = self.current_diff()
            if not has_changes(diff):
                raise ValidationError({"detail": "Nothing to publish: the fields match the latest version."})
            try:
                version = create_content_type_version(self.get_content_type())
            except DjangoValidationError as error:
                raise ValidationError({"detail": error.messages})
            locked.status = PublishRequest.Status.APPROVED
            locked.decided_by = request.user
            locked.decision_note = body.validated_data["decision_note"]
            locked.decided_at = timezone.now()
            locked.version = version
            locked.save()
            if locked.requested_by and locked.requested_by_id != request.user.id:
                notify(
                    [locked.requested_by],
                    Notification.Kind.PUBLISH_APPROVED,
                    f"{request.user.name} approved your publish request for "
                    f"{self.get_content_type().name} (v{version.version_number}).",
                    organization=self.get_organization(),
                    payload=self.payload_for(locked),
                )
        return self.respond(locked)

    def reject(self, request, *args, **kwargs):
        body = RejectionSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        publish_request = self.get_object()
        with transaction.atomic():
            locked = PublishRequest.objects.select_for_update().get(pk=publish_request.pk)
            if locked.status != PublishRequest.Status.PENDING:
                raise ValidationError({"detail": "This request has already been decided."})
            locked.status = PublishRequest.Status.REJECTED
            locked.decided_by = request.user
            locked.decision_note = body.validated_data["decision_note"]
            locked.decided_at = timezone.now()
            locked.save()
            if locked.requested_by and locked.requested_by_id != request.user.id:
                notify(
                    [locked.requested_by],
                    Notification.Kind.PUBLISH_REJECTED,
                    f"{request.user.name} rejected your publish request for "
                    f"{self.get_content_type().name}: {locked.decision_note}",
                    organization=self.get_organization(),
                    payload=self.payload_for(locked),
                )
        return self.respond(locked)
