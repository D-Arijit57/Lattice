from django.db import migrations

# Before roles, role_id=1 meant "owner" (OWNER_ROLE_ID). In the new scale
# (VIEWER=0, EDITOR=1, ADMIN=2, OWNER=3) 1 is EDITOR, so move old owners to 3.
OLD_OWNER = 1
NEW_OWNER = 3


def old_owners_to_new_owner(apps, schema_editor):
    Membership = apps.get_model("accounts", "OrganizationMembership")
    Membership.objects.filter(role_id=OLD_OWNER).update(role_id=NEW_OWNER)


def new_owner_to_old_owner(apps, schema_editor):
    Membership = apps.get_model("accounts", "OrganizationMembership")
    Membership.objects.filter(role_id=NEW_OWNER).update(role_id=OLD_OWNER)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0005_alter_organizationmembership_role_id"),
    ]

    operations = [
        migrations.RunPython(old_owners_to_new_owner, new_owner_to_old_owner),
    ]
