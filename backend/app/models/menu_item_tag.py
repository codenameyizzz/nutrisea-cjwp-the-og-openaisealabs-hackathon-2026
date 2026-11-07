import enum
from sqlalchemy import Column, String, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from ..core.database import Base

class TagAuthor(str, enum.Enum):
    SYSTEM = "SYSTEM"
    MERCHANT = "MERCHANT"

class MenuItemTag(Base):
    __tablename__ = "menu_item_tag"

    item_id = Column(String(32), ForeignKey("menu_item.id", ondelete="CASCADE"), primary_key=True)
    tag = Column(String(50), primary_key=True)
    tagged_by = Column(SAEnum(TagAuthor, name="tag_author_enum"), default=TagAuthor.SYSTEM, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)

    item = relationship("MenuItem", back_populates="tags")
