def describe_schema_fields(schema):
    """
    Turns a stored JSON Schema into [{name, data_type, required}], the same shape the
    control-plane fields endpoint uses. Reading the version's snapshot (not the live
    Field rows) means the answer matches what entries were validated against.
    """
    required = set(schema.get("required", []))
    fields = []
    for name, prop in schema.get("properties", {}).items():
        # TYPE_MAP in schema_generation encodes "date" as a string with format "date"
        data_type = "date" if prop.get("format") == "date" else prop.get("type")
        fields.append({"name": name, "data_type": data_type, "required": name in required})
    return sorted(fields, key=lambda f: f["name"])


def content_type_summary(content_type):
    return {"name": content_type.name, "slug": content_type.slug}


def content_type_detail(content_type, latest_version):
    return {
        **content_type_summary(content_type),
        "version_number": latest_version.version_number if latest_version else None,
        "fields": describe_schema_fields(latest_version.schema) if latest_version else [],
    }
