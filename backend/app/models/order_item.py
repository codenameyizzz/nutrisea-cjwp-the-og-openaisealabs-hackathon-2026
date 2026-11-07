from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from ..core.database import Base

class OrderItem(Base):
    __tablename__ = "order_item"

    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), primary_key=True)
    item_id = Column(String(32), ForeignKey("menu_item.id"), primary_key=True)
    qty = Column(Integer, default=1, nullable=False)
    price_idr = Column(Integer, nullable=False)

    order = relationship("Order", back_populates="items")
    item = relationship("MenuItem", back_populates="order_items")
