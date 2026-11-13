from django.utils import timezone
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.response import Response

from accounts.models import Notification
from api.accounts.serializers.notification_serializer import NotificationSerializer

LIST_LIMIT = 50


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    The caller's own notifications. Nobody can see or change anyone else's:
    every query starts from recipient=request.user, so another person's id is a 404.

    list         -> GET  /notifications/            newest 50 (?unread=true for unread only)
    unread_count -> GET  /notifications/unread-count/   {"unread": n}, cheap enough to poll
    mark_read    -> POST /notifications/<pk>/read/
    read_all     -> POST /notifications/read-all/
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSerializer
    pagination_class = None  # a plain list, capped by LIST_LIMIT

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset().order_by("-created_at", "-id")
        if request.query_params.get("unread") == "true":
            queryset = queryset.filter(read_at__isnull=True)
        return Response(self.get_serializer(queryset[:LIST_LIMIT], many=True).data)

    def unread_count(self, request, *args, **kwargs):
        return Response({"unread": self.get_queryset().filter(read_at__isnull=True).count()})

    def mark_read(self, request, *args, **kwargs):
        notification = self.get_object()
        if notification.read_at is None:  # idempotent: reading twice changes nothing
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(self.get_serializer(notification).data)

    def read_all(self, request, *args, **kwargs):
        updated = self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"marked": updated}, status=status.HTTP_200_OK)
