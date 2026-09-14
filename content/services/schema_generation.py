# TYPE_MAP : dict literals (a value that you write directly in your code)
# its actually a look up table
TYPE_MAP = {
    "string": {"type": "string"},
    "number": {"type": "number"},
    "boolean": {"type": "boolean"},
    "date": {"type": "string", "format": "date"},
}

def generate_schema(fields):
    """
    fields : an iterable of Field instances (name, data_type, required)
    returns : a plain dict matching: 
    {"type": "object", "properties": {...}, "required":[...], "additionalProperties": False}
    """
    # Properties own the field information
    # type wise, its an empty dictionary
    properties = {}
    # required owns the required field info
    # an empty list
    required = []
    
    for field in fields :
        properties[field.name] = dict(TYPE_MAP[field.data_type])
        # Insert all the required fields in required
        if field.required == True:
            required.append(field.name)

    return{
        "type" : "object",
        "properties" : properties,
        "required" : required,
        "additionalProperties": False
    }