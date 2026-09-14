import pytest

# These test the service layer directly (content/services/), not through the
# API - no api_client/user needed, just the `db` fixture pytest-django gives
# every @pytest.mark.django_db test access to.


@pytest.mark.django_db
def test_generate_schema_maps_each_data_type_correctly():
    # arrange: an Organization + ContentType, then one Field per data_type
    #          ("string", "number", "boolean", "date")
    # act: call generate_schema(fields) directly (import from
    #      content.services.schema_generation)
    # assert: properties[name]["type"] matches TYPE_MAP for each - and the
    #         "date" field specifically becomes {"type": "string", "format": "date"},
    #         not {"type": "date"} (JSON Schema has no native date type)
    pytest.skip("your turn")


@pytest.mark.django_db
def test_generate_schema_required_list_only_includes_required_fields():
    # arrange: two Fields on the same ContentType - one required=True, one
    #          required=False
    # act: generate_schema(fields)
    # assert: result["required"] contains only the required=True field's name
    pytest.skip("your turn")


@pytest.mark.django_db
def test_generate_schema_sets_additional_properties_false():
    # arrange: any Field(s)
    # act: generate_schema(fields)
    # assert: result["additionalProperties"] is False - this is the keyword
    #         that actually implements "unknown fields are rejected" (Decision 19)
    pytest.skip("your turn")


@pytest.mark.django_db
def test_create_content_type_version_rejects_zero_fields():
    # arrange: a ContentType with NO Field rows
    # act: call create_content_type_version(content_type=content_type) directly
    #      (import from content.services.versioning)
    # assert: raises django.core.exceptions.ValidationError - use
    #         pytest.raises(ValidationError) as a context manager
    pytest.skip("your turn")


@pytest.mark.django_db
def test_create_content_type_version_generates_schema_from_current_fields():
    # arrange: a ContentType with a couple of Fields
    # act: version = create_content_type_version(content_type=content_type)
    # assert: version.schema matches what generate_schema(fields) would
    #         produce for those same Fields
    pytest.skip("your turn")


@pytest.mark.django_db
def test_create_content_type_version_increments_version_number():
    # arrange: a ContentType with Fields, one version already created
    #          (call create_content_type_version once to set this up)
    # act: call create_content_type_version a second time
    # assert: second_version.version_number == first_version.version_number + 1
    pytest.skip("your turn")
