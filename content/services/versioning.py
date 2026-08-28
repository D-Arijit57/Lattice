from django.db import transaction
from django.db.models import Max

from content.models import ContentType, ContentTypeVersion


def create_content_type_version(content_type, schema):
    # to make separate transactions behave as one
    with transaction.atomic():
        # lock the parent ContentType row so a second concurrent request
        # has to wait here until this whole transaction commits (or rolls back)
        # select_for_update() : while you retrieve the database row, lock it for the current transaction
        locked_content_type = ContentType.objects.select_for_update().get(
            pk=content_type.pk
        )

        last_version_number = ContentTypeVersion.objects.filter(
            content_type=locked_content_type
        ).aggregate(Max("version_number"))["version_number__max"]

        # Max() returns None when there are zero versions yet (first version ever)
        next_version_number = (last_version_number or 0) + 1

        version = ContentTypeVersion.objects.create(
            content_type=locked_content_type,
            version_number=next_version_number,
            schema=schema,
        )

    return version
