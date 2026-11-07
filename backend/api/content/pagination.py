from rest_framework.pagination import CursorPagination


class EntryCursorPagination(CursorPagination):
    # Fixed page size; clients cannot override it with ?page_size=.
    page_size = 50

    # The field(s) the cursor walks along. DRF applies this ordering to the
    # queryset itself during list(), and uses the FIRST field (number) for the
    # cursor boundary comparison; id only stabilises the sort. number is the
    # per-content-type sequence (1, 2, 3...), assigned once under a lock and
    # never changed, so the cursor stays stable. Must mirror
    # EntryViewSet.get_queryset and the entry_ct_number_idx index.
    ordering = ("number", "id")
