import pytest
from django.core.exceptions import ValidationError

from content.services.schema_generation import generate_schema, TYPE_MAP
from content.services.versioning import create_content_type_version
from content.models import Field
# These test the service layer directly (content/services/), not through the
# API - no api_client/user needed, just the `db` fixture pytest-django gives
# every @pytest.mark.django_db test access to.


@pytest.mark.django_db
@pytest.mark.parametrize("data_type,expected_type", TYPE_MAP.items())
def test_generate_schema_maps_each_data_type_correctly(content_type, data_type, expected_type):
    # arrange: one Field of the given data_type, on the shared content_type
    #          fixture (conftest.py) - pytest reruns this test once per
    #          TYPE_MAP entry, substituting data_type/expected_type each time
    field = Field.objects.create(
        content_type=content_type, name="name", data_type=data_type, required=True
    )
    # act: call generate_schema(fields) directly (import from
    #      content.services.schema_generation)
    schema = generate_schema([field])
    # assert: properties["name"] matches what TYPE_MAP says this data_type
    #         should produce - for "date" that's {"type": "string", "format": "date"},
    #         not {"type": "date"} (JSON Schema has no native date type)
    assert schema["properties"]["name"] == expected_type


@pytest.mark.django_db
def test_generate_schema_required_list_only_includes_required_fields(content_type):
    # arrange: two Fields on the same ContentType - one required=True, one
    #          required=False
    field1 = Field.objects.create(
        content_type=content_type, name="name", data_type="string", required=True
    )
    field2 = Field.objects.create(
        content_type=content_type, name="another_name", data_type="string", required=False
    )
    # act: generate_schema(fields)
    result = generate_schema([field1, field2])
    # assert: result["required"] contains only the required=True field's name
    assert result["required"] == ["name"]


@pytest.mark.django_db
def test_generate_schema_sets_additional_properties_false(content_type):
    # arrange: any Field(s)
    field = Field.objects.create(
        content_type=content_type, name="name", data_type="string", required=True
    )
    # act: generate_schema(fields)
    result = generate_schema([field])
    # assert: result["additionalProperties"] is False - this is the keyword
    #         that actually implements "unknown fields are rejected" (Decision 19)
    assert result["additionalProperties"] is False


@pytest.mark.django_db
def test_create_content_type_version_rejects_zero_fields(content_type):
    # arrange: a ContentType with NO Field rows - content_type fixture
    #          already gives us one with none attached
    # act: call create_content_type_version(content_type=content_type) directly
    #      (import from content.services.versioning)
    # assert: raises django.core.exceptions.ValidationError - use
    #         pytest.raises(ValidationError) as a context manager
    with pytest.raises(ValidationError):
        create_content_type_version(content_type=content_type)


@pytest.mark.django_db
def test_create_content_type_version_generates_schema_from_current_fields(content_type):
    # arrange: a ContentType with a couple of Fields
    field1 = Field.objects.create(
        content_type=content_type, name="name", data_type="string", required=True
    )
    field2 = Field.objects.create(
        content_type=content_type, name="price", data_type="number", required=False
    )
    # act: version = create_content_type_version(content_type=content_type)
    version = create_content_type_version(content_type=content_type)
    # assert: version.schema matches what generate_schema(fields) would
    #         produce for those same Fields
    assert version.schema == generate_schema([field1, field2])


@pytest.mark.django_db
def test_create_content_type_version_increments_version_number(content_type):
    # arrange: a ContentType with Fields, one version already created
    #          (call create_content_type_version once to set this up)
    Field.objects.create(
        content_type=content_type, name="name", data_type="string", required=True
    )
    first_version = create_content_type_version(content_type=content_type)
    # act: call create_content_type_version a second time
    second_version = create_content_type_version(content_type=content_type)
    # assert: second_version.version_number == first_version.version_number + 1
    assert second_version.version_number == first_version.version_number + 1
