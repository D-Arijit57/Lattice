from rest_framework.pagination import CursorPagination


class EntryCursorPagination(CursorPagination):
    # Fixed page size; clients cannot override it with ?page_size=.
    page_size = 50

    # The field(s) the cursor walks along. DRF applies this ordering to the
    # queryset itself during list(), and uses the FIRST field (created_at) for
    # the cursor boundary comparison; -id only stabilises the sort. created_at
    # is auto_now_add, so it is non-nullable and never changes - which is what
    # CursorPagination needs to produce a stable cursor.
    ordering = ("-created_at", "-id")
