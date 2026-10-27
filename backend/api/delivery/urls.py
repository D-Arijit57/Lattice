from django.urls import path

from api.delivery.views import DeliveryContentTypeViewSet, DeliveryEntryViewSet

# Same hand-written .as_view() pattern as every other urls.py in this
# project - no router, so the routes stay visible here.
entry_list = DeliveryEntryViewSet.as_view({"get": "list"})
entry_detail = DeliveryEntryViewSet.as_view({"get": "retrieve"})

content_type_list = DeliveryContentTypeViewSet.as_view({"get": "list"})
content_type_detail = DeliveryContentTypeViewSet.as_view({"get": "retrieve"})

urlpatterns = [
    # Discovery (read-only): list the key's content types, and one type's latest field schema.
    path("delivery/content-types/", content_type_list, name="delivery-content-type-list"),
    path("delivery/content-types/<str:slug>/", content_type_detail, name="delivery-content-type-detail"),
    # Slug, not id (Decision 121) - external integrators are the audience
    # here and don't know Lattice's internal numeric ids. No <organization_id>
    # segment either: the API key itself carries the organization
    # (request.auth.organization), so it isn't repeated in the URL.
    path(
        "delivery/content-types/<str:slug>/entries/",
        entry_list,
        name="delivery-entry-list",
    ),
    path(
        "delivery/content-types/<str:slug>/entries/<int:pk>/",
        entry_detail,
        name="delivery-entry-detail",
    ),
]
