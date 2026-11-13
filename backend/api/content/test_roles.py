"""
Role gating on entries: VIEWER < EDITOR < ADMIN < OWNER.

Reading needs only membership. Every entry write (create, bulk create, edit,
archive, archive all, restore) needs EDITOR or higher.
"""
import pytest
from django.urls import reverse

from accounts.models import Organization, OrganizationMembership, Role
from content.models import ContentType, Entry, Field
from content.services.versioning import create_content_type_version


@pytest.fixture
def setup(db):
    # One org / content type / version, plus one live entry to act on.
    organization = Organization.objects.create(name="Amazon")
    content_type = ContentType.objects.create(
        organization=organization, name="Product", slug="product"
    )
    Field.objects.create(
        content_type=content_type, name="title", data_type="string", required=True
    )
    version = create_content_type_version(content_type=content_type)
    entry = Entry.objects.create(
        content_type_version=version, data={"title": "Shirt"}, number=1
    )
    return organization, content_type, entry


def as_role(api_client, user, organization, role):
    OrganizationMembership.objects.create(
        user=user, organization=organization, role_id=role
    )
    api_client.force_authenticate(user=user)


def urls(organization, content_type, entry):
    args = [organization.id, content_type.id]
    return {
        "list": reverse("entry-list", args=args),
        "bulk": reverse("entry-bulk-create", args=args),
        "detail": reverse("entry-detail", args=[*args, entry.id]),
        "restore": reverse("entry-restore", args=[*args, entry.id]),
    }


# --- the default is the safest role -----------------------------------------


@pytest.mark.django_db
def test_membership_defaults_to_viewer(user):
    organization = Organization.objects.create(name="Acme")
    membership = OrganizationMembership.objects.create(user=user, organization=organization)
    assert membership.role_id == Role.VIEWER


# --- viewers: read yes, write no --------------------------------------------


@pytest.mark.django_db
def test_viewer_can_list_and_retrieve(api_client, user, setup):
    organization, content_type, entry = setup
    u = urls(organization, content_type, entry)
    as_role(api_client, user, organization, Role.VIEWER)

    assert api_client.get(u["list"]).status_code == 200
    assert api_client.get(u["detail"]).status_code == 200


@pytest.mark.django_db
def test_viewer_cannot_create_entry(api_client, user, setup):
    organization, content_type, entry = setup
    u = urls(organization, content_type, entry)
    as_role(api_client, user, organization, Role.VIEWER)

    response = api_client.post(u["list"], {"data": {"title": "New"}}, format="json")

    assert response.status_code == 403
    assert Entry.objects.count() == 1


@pytest.mark.django_db
def test_viewer_cannot_bulk_create_entries(api_client, user, setup):
    organization, content_type, entry = setup
    u = urls(organization, content_type, entry)
    as_role(api_client, user, organization, Role.VIEWER)

    response = api_client.post(
        u["bulk"], {"entries": [{"title": "A"}, {"title": "B"}]}, format="json"
    )

    assert response.status_code == 403
    assert Entry.objects.count() == 1


@pytest.mark.django_db
def test_viewer_cannot_edit_entry(api_client, user, setup):
    organization, content_type, entry = setup
    u = urls(organization, content_type, entry)
    as_role(api_client, user, organization, Role.VIEWER)

    response = api_client.patch(u["detail"], {"data": {"title": "Hacked"}}, format="json")

    assert response.status_code == 403
    entry.refresh_from_db()
    assert entry.data == {"title": "Shirt"}


@pytest.mark.django_db
def test_viewer_cannot_archive_or_restore_entry(api_client, user, setup):
    organization, content_type, entry = setup
    u = urls(organization, content_type, entry)
    as_role(api_client, user, organization, Role.VIEWER)

    assert api_client.delete(u["detail"]).status_code == 403
    assert api_client.post(u["restore"]).status_code == 403
    entry.refresh_from_db()
    assert entry.archived_at is None


@pytest.mark.django_db
def test_viewer_cannot_archive_all_entries(api_client, user, setup):
    organization, content_type, entry = setup
    u = urls(organization, content_type, entry)
    as_role(api_client, user, organization, Role.VIEWER)

    assert api_client.delete(u["list"]).status_code == 403
    entry.refresh_from_db()
    assert entry.archived_at is None


# --- editor and above: write allowed ----------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.EDITOR, Role.ADMIN, Role.OWNER])
def test_editor_and_above_can_write_entries(api_client, user, setup, role):
    organization, content_type, entry = setup
    u = urls(organization, content_type, entry)
    as_role(api_client, user, organization, role)

    assert api_client.post(u["list"], {"data": {"title": "New"}}, format="json").status_code == 201
    assert api_client.patch(
        u["detail"], {"data": {"title": "Edited"}}, format="json"
    ).status_code == 200
    assert api_client.delete(u["detail"]).status_code == 204
    assert api_client.post(u["restore"]).status_code == 200
    assert api_client.delete(u["list"]).status_code == 200


# --- the membership check still comes first ---------------------------------


@pytest.mark.django_db
def test_non_member_is_rejected_even_for_reads(api_client, user, setup):
    organization, content_type, entry = setup
    u = urls(organization, content_type, entry)
    api_client.force_authenticate(user=user)  # no membership at all

    assert api_client.get(u["list"]).status_code == 403
