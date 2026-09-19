from jsonschema import Draft202012Validator, FormatChecker

# key for errors about the payload as a whole rather than one field
# (same name DRF uses for serializer-level errors)
NON_FIELD_ERRORS = "non_field_errors"

# readable labels for the JSON Schema types TYPE_MAP can produce
TYPE_LABELS = {
    "string": "text",
    "number": "a number",
    "boolean": "true or false",
    "object": "a JSON object",
}


def _message(error):
    """
    Turn a jsonschema error into a message a form can show. The library's own
    text quotes Python reprs ("None is not of type 'string'"), which is not
    something an API client should see.
    """
    if error.validator == "type":
        if error.instance is None:
            return "This field may not be null."
        label = TYPE_LABELS.get(error.validator_value) if isinstance(error.validator_value, str) else None
        if label:
            return f"Must be {label}."
    if error.validator == "format" and error.validator_value == "date":
        return "Must be a valid date (YYYY-MM-DD)."
    # a keyword we don't have a friendlier wording for
    return error.message


def _add(errors, field, message):
    # setdefault creates the list the first time a field errors.
    # the `not in` check: jsonschema reports `required` once per missing field,
    # and we work out every missing name from each report, so the same message
    # can arrive more than once
    messages = errors.setdefault(field, [])
    if message not in messages:
        messages.append(message)


def validate_entry_data(schema, data):
    """
    schema : the JSON Schema dict stored on a ContentTypeVersion
    data   : the Entry payload as sent by the client
    returns : {field_name: [messages]} - empty dict means the data is valid.
              Errors about the payload as a whole (e.g. not an object) are
              under NON_FIELD_ERRORS.
    """
    # FormatChecker is what makes "format": "date" actually enforced; without
    # it the library treats format as a hint and accepts "not-a-date"
    validator = Draft202012Validator(schema, format_checker=FormatChecker())

    errors = {}
    # iter_errors() : maps the errors to the defined schema, so instead of manually handling that
    # iter_errors() handles that alone
    for error in validator.iter_errors(data):
        if error.validator == "required":
            # error.path points at the parent object, not the missing field,
            # so the names have to be worked out from the schema + payload
            for name in error.validator_value:
                if name not in error.instance:
                    _add(errors, name, "This field is required.")
        elif error.validator == "additionalProperties":
            # same problem: the unexpected field names are not in error.path
            for name in sorted(set(error.instance) - set(error.schema["properties"])):
                _add(errors, name, "Unknown field.")
        else:
            field = ".".join(str(part) for part in error.path) or NON_FIELD_ERRORS
            _add(errors, field, _message(error))
    return errors
