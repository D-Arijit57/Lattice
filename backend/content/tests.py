import pytest
from django.core.exceptions import ValidationError

from content.services.entry_validation import validate_entry_data, NON_FIELD_ERRORS
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


# --- validate_entry_data (content/services/entry_validation.py) -------------
# Pure function: (schema dict, payload) -> {field: [messages]}. No db mark
# needed, these never touch the database.

# what generate_schema() produces for a Product with these four Fields
PRODUCT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "price": {"type": "number"},
        "in_stock": {"type": "boolean"},
        "released": {"type": "string", "format": "date"},
    },
    "required": ["title", "price"],
    "additionalProperties": False,
}


def test_validate_entry_data_accepts_a_fully_valid_payload():
    data = {"title": "Shirt", "price": 499, "in_stock": True, "released": "2026-09-20"}
    assert validate_entry_data(PRODUCT_SCHEMA, data) == {}


def test_validate_entry_data_accepts_payload_with_only_required_fields():
    assert validate_entry_data(PRODUCT_SCHEMA, {"title": "Shirt", "price": 5}) == {}


def test_validate_entry_data_reports_each_missing_required_field_once():
    # both required fields missing: one message per field, not duplicated
    assert validate_entry_data(PRODUCT_SCHEMA, {}) == {
        "title": ["This field is required."],
        "price": ["This field is required."],
    }


def test_validate_entry_data_rejects_wrong_type():
    result = validate_entry_data(PRODUCT_SCHEMA, {"title": "Shirt", "price": "banana"})
    assert result == {"price": ["Must be a number."]}


def test_validate_entry_data_rejects_null_values():
    # Decision 19: null is not allowed unless nullable fields are added later
    result = validate_entry_data(PRODUCT_SCHEMA, {"title": None, "price": 5})
    assert result == {"title": ["This field may not be null."]}


def test_validate_entry_data_does_not_treat_boolean_as_number():
    # in Python True is an int; JSON Schema must not accept it as a number
    result = validate_entry_data(PRODUCT_SCHEMA, {"title": "Shirt", "price": True})
    assert result == {"price": ["Must be a number."]}


def test_validate_entry_data_rejects_unknown_fields():
    data = {"title": "Shirt", "price": 5, "hax": True, "zzz": 1}
    assert validate_entry_data(PRODUCT_SCHEMA, data) == {
        "hax": ["Unknown field."],
        "zzz": ["Unknown field."],
    }


@pytest.mark.parametrize("bad_date", ["not-a-date", "20260920", "2026-13-45", "2026-9-2"])
def test_validate_entry_data_enforces_date_format(bad_date):
    # without a FormatChecker the library would accept all of these
    data = {"title": "Shirt", "price": 5, "released": bad_date}
    assert validate_entry_data(PRODUCT_SCHEMA, data) == {
        "released": ["Must be a valid date (YYYY-MM-DD)."]
    }


@pytest.mark.parametrize("bad_root", [[1, 2, 3], "hello", 5])
def test_validate_entry_data_rejects_non_object_payload(bad_root):
    # no field to attach the error to, so it goes under NON_FIELD_ERRORS
    assert validate_entry_data(PRODUCT_SCHEMA, bad_root) == {
        NON_FIELD_ERRORS: ["Must be a JSON object."]
    }


def test_validate_entry_data_reports_all_errors_at_once():
    # a form needs every problem in one response, not one per submit
    result = validate_entry_data(PRODUCT_SCHEMA, {"price": "x", "hax": 1})
    assert result == {
        "title": ["This field is required."],
        "price": ["Must be a number."],
        "hax": ["Unknown field."],
    }


def test_validate_entry_data_works_with_a_schema_from_generate_schema():
    # guards the contract between the two services: whatever generate_schema
    # emits must be something validate_entry_data understands. Unsaved Field
    # instances are enough - generate_schema only reads attributes.
    fields = [
        Field(name="title", data_type="string", required=True),
        Field(name="released", data_type="date", required=False),
    ]
    schema = generate_schema(fields)
    assert validate_entry_data(schema, {"title": "Shirt", "released": "2026-09-20"}) == {}
    assert validate_entry_data(schema, {"released": "nope", "extra": 1}) == {
        "title": ["This field is required."],
        "released": ["Must be a valid date (YYYY-MM-DD)."],
        "extra": ["Unknown field."],
    }
