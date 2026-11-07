"""Canonical identifiers shared by profile restrictions and catalog filtering."""

ALLERGENS = {
    "shrimp": "udang", "prawn": "udang", "peanut": "kacang",
    "peanuts": "kacang", "egg": "telur", "eggs": "telur", "milk": "susu",
}


def normalize_allergen(value):
    value = str(value).strip().lower()
    return ALLERGENS.get(value, value)


def normalize_allergens(values):
    if isinstance(values, str):
        values = values.split(",")
    return sorted({normalize_allergen(value) for value in (values or [])
                   if value and str(value).strip().lower() not in ("", "none")})
