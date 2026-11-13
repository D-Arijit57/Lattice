def _describe(schema, name):
    """One field as {"type", "format", "required"} read out of a stored schema."""
    prop = schema["properties"][name]
    return {
        "type": prop["type"],
        "format": prop.get("format"),
        "required": name in schema.get("required", []),
    }


def diff_schemas(old_schema, new_schema):
    """
    What changed going from old_schema to new_schema (both made by
    generate_schema). old_schema is None before the first version, so every
    field then counts as added.

    returns {"added": [...], "removed": [...], "changed": [...]} where each
    item has the field name, and "changed" items carry "from" and "to".
    """
    old_props = (old_schema or {}).get("properties", {})
    new_props = new_schema.get("properties", {})

    added = [
        {"name": name, **_describe(new_schema, name)}
        for name in new_props if name not in old_props
    ]
    removed = [
        {"name": name, **_describe(old_schema, name)}
        for name in old_props if name not in new_props
    ]
    changed = []
    for name in new_props:
        if name in old_props:
            before = _describe(old_schema, name)
            after = _describe(new_schema, name)
            if before != after:
                changed.append({"name": name, "from": before, "to": after})
    return {"added": added, "removed": removed, "changed": changed}


def has_changes(diff):
    return bool(diff["added"] or diff["removed"] or diff["changed"])
