"""
Admin / owner gating: schema changes need ADMIN, org delete needs OWNER,
API keys need ADMIN. Editors and viewers get 403.
"""
import pytest
from django.urls import reverse

from accounts.models import APIKey, Organization, OrganizationMembership, Role
from content.models import ContentType, Field


@pytest.fixture
def org_ct(db):
    organization = Organization.objects.create(name="Amazon")
    content_type = ContentType.objects.create(
        organization=organization, name="Product", slug="product"
    )
    field = Field.objects.create(
        content_type=content_type, name="title", data_type="string", required=True
    )
    return organization, content_type, field


def login_as(api_client, user, organization, role):
    OrganizationMembership.objects.create(user=user, organization=organization, role_id=role)
    api_client.force_authenticate(user=user)


# --- schema: content types and fields ---------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.VIEWER, Role.EDITOR])
def test_below_admin_cannot_create_or_archive_content_types_or_publish(api_client, user, org_ct, role):
    organization, content_type, _ = org_ct
    login_as(api_client, user, organization, role)
    args = [organization.id, content_type.id]

    ct_create = api_client.post(
        reverse("content-type-list", args=[organization.id]),
        {"name": "Post", "slug": "post"}, format="json",
    )
    ct_archive = api_client.delete(reverse("content-type-detail", args=args))
    v_create = api_client.post(reverse("content-type-version-list", args=args), {}, format="json")

    assert [r.status_code for r in (ct_create, ct_archive, v_create)] == [403] * 3
    content_type.refresh_from_db()
    assert content_type.archived_at is None


@pytest.mark.django_db
def test_viewer_cannot_edit_fields(api_client, user, org_ct):
    organization, content_type, field = org_ct
    login_as(api_client, user, organization, Role.VIEWER)
    args = [organization.id, content_type.id]

    created = api_client.post(
        reverse("field-list", args=args),
        {"name": "price", "data_type": "number", "required": False}, format="json",
    )
    archived = api_client.delete(reverse("field-detail", args=[*args, field.id]))

    assert (created.status_code, archived.status_code) == (403, 403)
    field.refresh_from_db()
    assert field.archived_at is None


@pytest.mark.django_db
def test_editor_can_edit_fields_as_a_draft(api_client, user, org_ct):
    # Fields are the draft schema: nothing changes for entries until a version
    # is published, which an editor cannot do on their own.
    organization, content_type, field = org_ct
    login_as(api_client, user, organization, Role.EDITOR)
    args = [organization.id, content_type.id]

    created = api_client.post(
        reverse("field-list", args=args),
        {"name": "price", "data_type": "number", "required": False}, format="json",
    )
    archived = api_client.delete(reverse("field-detail", args=[*args, field.id]))

    assert (created.status_code, archived.status_code) == (201, 204)


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.VIEWER, Role.EDITOR, Role.ADMIN, Role.OWNER])
def test_everyone_can_read_the_schema(api_client, user, org_ct, role):
    organization, content_type, _ = org_ct
    login_as(api_client, user, organization, role)

    assert api_client.get(reverse("content-type-list", args=[organization.id])).status_code == 200
    assert api_client.get(reverse("field-list", args=[organization.id, content_type.id])).status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.ADMIN, Role.OWNER])
def test_admin_and_owner_can_change_the_schema(api_client, user, org_ct, role):
    organization, content_type, field = org_ct
    login_as(api_client, user, organization, role)
    args = [organization.id, content_type.id]

    assert api_client.post(
        reverse("field-list", args=args),
        {"name": "price", "data_type": "number", "required": False}, format="json",
    ).status_code == 201
    assert api_client.delete(reverse("field-detail", args=[*args, field.id])).status_code == 204
    assert api_client.delete(reverse("content-type-detail", args=args)).status_code == 204


# --- organization delete: owner only ----------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.VIEWER, Role.EDITOR, Role.ADMIN])
def test_only_owner_can_delete_the_organization(api_client, user, org_ct, role):
    organization, _, _ = org_ct
    login_as(api_client, user, organization, role)

    response = api_client.delete(reverse("organization-detail", args=[organization.id]))

    assert response.status_code == 403
    organization.refresh_from_db()
    assert organization.archived_at is None


@pytest.mark.django_db
def test_owner_can_delete_the_organization(api_client, user, org_ct):
    organization, _, _ = org_ct
    login_as(api_client, user, organization, Role.OWNER)

    assert api_client.delete(reverse("organization-detail", args=[organization.id])).status_code == 204
    organization.refresh_from_db()
    assert organization.archived_at is not None


@pytest.mark.django_db
def test_non_member_deleting_an_organization_gets_404(api_client, user, org_ct):
    organization, _, _ = org_ct
    api_client.force_authenticate(user=user)  # not a member

    assert api_client.delete(reverse("organization-detail", args=[organization.id])).status_code == 404


# --- API keys: admin and above ----------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.VIEWER, Role.EDITOR])
def test_below_admin_cannot_manage_api_keys(api_client, user, org_ct, role):
    organization, _, _ = org_ct
    login_as(api_client, user, organization, role)
    url = reverse("api-key-list", args=[organization.id])

    assert api_client.get(url).status_code == 403
    assert api_client.post(url, {"name": "Site"}, format="json").status_code == 403
    assert APIKey.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.ADMIN, Role.OWNER])
def test_admin_and_owner_can_manage_api_keys(api_client, user, org_ct, role):
    organization, _, _ = org_ct
    login_as(api_client, user, organization, role)
    url = reverse("api-key-list", args=[organization.id])

    created = api_client.post(url, {"name": "Site"}, format="json")
    assert created.status_code == 201
    assert api_client.get(url).status_code == 200
    detail = reverse("api-key-detail", args=[organization.id, created.data["id"]])
    assert api_client.delete(detail).status_code == 204


# --- my_role on the organization API ----------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("role", [Role.VIEWER, Role.EDITOR, Role.ADMIN, Role.OWNER])
def test_organization_api_reports_my_role(api_client, user, org_ct, role):
    organization, _, _ = org_ct
    login_as(api_client, user, organization, role)

    listed = api_client.get(reverse("organization-list"))
    detail = api_client.get(reverse("organization-detail", args=[organization.id]))

    assert listed.data[0]["my_role"] == role
    assert detail.data["my_role"] == role
