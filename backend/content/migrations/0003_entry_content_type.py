import django.db.models.deletion
from django.db import migrations, models
from django.db.models import OuterRef, Subquery


def backfill_content_type(apps, schema_editor):
    # Copy each entry's content type from its version, in one UPDATE statement.
    Entry = apps.get_model("content", "Entry")
    ContentTypeVersion = apps.get_model("content", "ContentTypeVersion")
    Entry.objects.update(
        content_type_id=Subquery(
            ContentTypeVersion.objects.filter(pk=OuterRef("content_type_version_id"))
            .values("content_type_id")[:1]
        )
    )


class Migration(migrations.Migration):

    dependencies = [
        ('content', '0002_contenttypeversion_entry_field_and_more'),
    ]

    operations = [
        # 1. Add the column as nullable: existing rows have no value yet.
        migrations.AddField(
            model_name='entry',
            name='content_type',
            field=models.ForeignKey(
                null=True, editable=False,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='entries', to='content.contenttype',
            ),
        ),
        # 2. Fill it in for every existing row.
        migrations.RunPython(backfill_content_type, migrations.RunPython.noop),
        # 3. Now that every row has a value, make it required.
        migrations.AlterField(
            model_name='entry',
            name='content_type',
            field=models.ForeignKey(
                editable=False,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='entries', to='content.contenttype',
            ),
        ),
        # 4. Index for the delivery / entries list query.
        migrations.AddIndex(
            model_name='entry',
            index=models.Index(fields=['content_type', '-created_at', '-id'], name='entry_ct_newest_idx'),
        ),
    ]
