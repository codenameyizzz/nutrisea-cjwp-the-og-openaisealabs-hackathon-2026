from decimal import Decimal
from typing import Literal
from uuid import UUID
import unicodedata

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Unit = Literal["gram", "kg", "ml", "liter", "pcs", "tsp", "tbsp"]


def display_text(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split())


def normalize(value: str) -> str:
    return display_text(value).lower()


class IngredientWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=150)
    category: str = Field(default="Lainnya", min_length=1, max_length=80)
    default_unit: Unit = "gram"
    aliases: list[str] = Field(default_factory=list, max_length=30)
    is_active: bool = True

    @field_validator("name", "category")
    @classmethod
    def clean_text(cls, value, info):
        value = display_text(value)
        maximum = 150 if info.field_name == "name" else 80
        if not value or len(value) > maximum or len(normalize(value)) > maximum or "\x00" in value:
            raise ValueError("Nama dan kategori tidak boleh kosong")
        return value

    @field_validator("aliases")
    @classmethod
    def clean_aliases(cls, values):
        cleaned = [display_text(v) for v in values]
        if any(not v or len(v) > 150 or len(normalize(v)) > 150 or "\x00" in v for v in cleaned):
            raise ValueError("Alias harus berisi 1 sampai 150 karakter")
        if len({normalize(v) for v in cleaned}) != len(cleaned):
            raise ValueError("Alias tidak boleh duplikat")
        return cleaned


class MenuIngredientInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ingredient_id: UUID
    quantity: Decimal = Field(gt=0, le=Decimal("999999.999"), max_digits=12, decimal_places=3, allow_inf_nan=False)
    unit: Unit


class MenuIngredientsWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[MenuIngredientInput] = Field(max_length=100)
    version: str = Field(min_length=64, max_length=64, pattern=r"^[a-f0-9]{64}$")

    @model_validator(mode="after")
    def unique_ingredients(self):
        if len({v.ingredient_id for v in self.items}) != len(self.items):
            raise ValueError("Bahan yang sama tidak boleh dipilih dua kali")
        return self
