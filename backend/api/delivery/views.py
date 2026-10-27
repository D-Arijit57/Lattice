from rest_framework import mixins, viewsets
from rest_framework.response import Response
from rest_framework.exceptions import NotFound

from content.models import ContentType, Entry
from api.content.pagination import EntryCursorPagination
from api.content.serializers import EntrySerializer
from api.delivery.authentication import APIKeyAuthentication
from api.delivery.permissions import HasValidAPIKey
from api.delivery.serializers import content_type_detail, content_type_summary
from api.delivery.throttling import APIKeyRateThrottle


class DeliveryEntryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [HasValidAPIKey]
    # Per-key limit only. API-key requests have no user, so DRF's AnonRateThrottle
    # would also count them per client IP (30/min) and cap a server-side
    # integration well below the intended per-key limit.
    throttle_classes = [APIKeyRateThrottle]
    serializer_class = EntrySerializer
    pagination_class = EntryCursorPagination
    
    def get_content_type(self):
        if not hasattr(self, "_content_type"):
            try :
                self._content_type = ContentType.objects.get(
                    organization = self.request.auth.organization,
                    slug = self.kwargs["slug"],
                )
            except ContentType.DoesNotExist:
                raise NotFound("Content type not found")
        return self._content_type
    
    def get_queryset(self):
        return (
            Entry.objects
            .filter(content_type=self.get_content_type())
            .select_related("content_type_version")
            .order_by("-created_at", "-id")
        )


class DeliveryContentTypeViewSet(viewsets.ViewSet):
    """
    Read-only discovery for API-key consumers: which content types does my organization
    have, and what fields does each one's latest version declare? Same auth, permission,
    throttle and org scoping as the entries endpoints; exposes no ids, timestamps or data.
    """
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [HasValidAPIKey]
    throttle_classes = [APIKeyRateThrottle]

    def list(self, request):
        content_types = ContentType.objects.filter(
            organization=request.auth.organization
        ).order_by("name")
        return Response([content_type_summary(ct) for ct in content_types])

    def retrieve(self, request, slug=None):
        try:
            content_type = ContentType.objects.get(
                organization=request.auth.organization, slug=slug
            )
        except ContentType.DoesNotExist:
            raise NotFound("Content type not found")
        latest = content_type.versions.order_by("-version_number").first()
        return Response(content_type_detail(content_type, latest))
