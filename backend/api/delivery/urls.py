from django.urls import path

from api.delivery.views import DeliveryEntryViewSet

# Same hand-written .as_view() pattern as every other urls.py in this
# project - no router, so the routes stay visible here.
entry_list = DeliveryEntryViewSet.as_view({"get": "list"})
entry_detail = DeliveryEntryViewSet.as_view({"get": "retrieve"})

urlpatterns = [
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
