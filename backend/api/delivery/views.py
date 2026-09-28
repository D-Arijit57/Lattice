from rest_framework import mixins, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.throttling import AnonRateThrottle

from content.models import ContentType, Entry
from api.content.pagination import EntryCursorPagination
from api.content.serializers import EntrySerializer
from api.delivery.authentication import APIKeyAuthentication
from api.delivery.permissions import HasValidAPIKey
from api.delivery.throttling import APIKeyRateThrottle


class DeliveryEntryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    authentication_classes = [APIKeyAuthentication]
    permission_classes = [HasValidAPIKey]
    throttle_classes = [AnonRateThrottle, APIKeyRateThrottle]
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
        return Entry.objects.filter(
            content_type_version__content_type = self.get_content_type()
        ).order_by("-created_at","-id")
    