import assert from "node:assert/strict";
import test from "node:test";
import type { DishItem } from "@/data/menu";
import { checkoutPayload, orderConfirmation } from "./checkout";
const dish = (id: string, merchantId?: string): DishItem => ({ id, name: id, merchantId, merchantName:"Synthetic merchant", category:"hemat", district:"Test", distanceKm:0, rating:0, soldCount:"0", basePrice:10000, discountedPrice:9000, imageUrl:"",healthyTags:[],hygieneBadges:[],cookingNotes:"User kitchen note",macros:{kcal:0,proteinG:0,carbsG:0,fatG:0,sodiumMg:0} });
test("checkout uses real catalog IDs and per-item notes without mutating cart", () => {
  const cart=[{dish:dish("DISH-A","MERCHANT-A"),qty:2}]; const before=structuredClone(cart);
  const result=checkoutPayload(cart,18000);
  assert.equal(result.merchant_id,"MERCHANT-A"); assert.deepEqual(result.items,[{item_id:"DISH-A",qty:2,price_idr:9000}]);
  assert.match(result.kitchen_notes,/User kitchen note/); assert.equal(result.is_healthy_pick,false); assert.deepEqual(cart,before);
});
test("unknown merchant never receives a hardcoded fallback", () => {
  assert.throws(()=>checkoutPayload([{dish:dish("A"),qty:1}],9000),/Merchant/);
});
test("mixed merchant cart is retained and rejected explicitly", () => {
  const cart=[{dish:dish("A","M1"),qty:1},{dish:dish("B","M2"),qty:1}];const before=structuredClone(cart);
  assert.throws(()=>checkoutPayload(cart,18000),/one merchant/);assert.deepEqual(cart,before);
});
test("empty cart and invalid quantities cannot produce an order", () => {
  assert.throws(()=>checkoutPayload([],0));
  for(const qty of [0,-1,1.5,NaN]) assert.throws(()=>checkoutPayload([{dish:dish("A","M"),qty}],9000));
});
test("HTTP success without confirmed order ID is not checkout success", () => {
  for(const result of [null,{}, {status:"CONFIRMED"},{status:"FAILED",order_id:1},{status:"CONFIRMED",order_id:0}]) assert.throws(()=>orderConfirmation(result));
  assert.deepEqual(orderConfirmation({status:"CONFIRMED",order_id:42}),{order_id:42});
});
