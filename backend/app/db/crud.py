from datetime import datetime, timezone, date
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from .models import (
    AppUser,
    HealthProfile,
    Merchant,
    MenuItem,
    MenuItemTag,
    Recommendation,
    Order,
    OrderItem,
    MealLog,
    RewardLedger,
    MerchantDemandInsight,
    ChatMessage,
    Persona,
    UserMemoryItem,
    UserActionLog,
    UserRole,
    UserSex,
    ActivityLevel,
    HealthGoal,
    MealSlot,
    NutritionSource,
    TagAuthor,
    RecommendationMealType,
    RecommendationSource,
    RecommendationStatus,
    OrderStatus,
    MealSource,
    MealTypeEnum,
    utcnow
)


# =====================================================================
# 1. USER & PROFILE CRUD
# =====================================================================
def get_user(db: Session, user_id: str) -> Optional[AppUser]:
    return db.query(AppUser).filter(AppUser.id == user_id).first()

def upsert_user(
    db: Session,
    user_id: str,
    name: str,
    email: Optional[str] = None,
    role: Optional[UserRole] = None,
    is_demo: bool = False,
    consent_health_data: bool = True,
    streak_days: Optional[int] = None
) -> AppUser:
    user = get_user(db, user_id)
    if not user:
        user = AppUser(
            id=user_id,
            name=name,
            email=email,
            role=role or UserRole.CONSUMER,
            is_demo=is_demo,
            consent_health_data=consent_health_data,
            streak_days=streak_days if streak_days is not None else 0
        )
        db.add(user)
    else:
        user.name = name
        if email:
            user.email = email
        if role is not None:
            user.role = role
        user.consent_health_data = consent_health_data
        if streak_days is not None:
            user.streak_days = streak_days
    db.commit()
    db.refresh(user)
    return user


def update_user_role(db: Session, user_id: str, role: UserRole) -> AppUser:
    user = get_user(db, user_id)
    if not user:
        user = AppUser(
            id=user_id,
            name="Pengguna NutriSea",
            role=role,
            is_demo=False,
            consent_health_data=True
        )
        db.add(user)
    else:
        user.role = role
    db.commit()
    db.refresh(user)
    return user


def calculate_metabolic_targets(
    age: int,
    sex: str,
    height_cm: float,
    weight_kg: float,
    activity_level: str = "LIGHT",
    goal: str = "MAINTAIN"
) -> Dict[str, int]:
    """
    Computes clinical baseline using Mifflin-St Jeor formula (Kemenkes & WHO aligned).
    """
    is_female = sex.upper() in ("F", "WANITA", "PEREMPUAN")
    # Mifflin-St Jeor formula
    if is_female:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5

    bmr = max(1000, round(bmr))

    multipliers = {
        "SEDENTARY": 1.2,
        "LIGHT": 1.375,
        "MODERATE": 1.55,
        "ACTIVE": 1.725
    }
    mult = multipliers.get(activity_level.upper(), 1.375)
    tdee = round(bmr * mult)

    floor = 1200 if is_female else 1500

    goal_upper = goal.upper()
    if goal_upper in ("LOSE_WEIGHT", "TURUN", "TURUN-BERAT-BADAN"):
        target = max(floor, tdee - 300)
    elif goal_upper in ("GAIN_MUSCLE", "OTOT"):
        target = tdee + 300
    else:
        target = tdee

    target_protein = round(weight_kg * (1.6 if goal_upper in ("GAIN_MUSCLE", "OTOT") else 1.2))
    target_carbs = round((target * 0.50) / 4)

    return {
        "bmr_kcal": int(bmr),
        "tdee_kcal": int(tdee),
        "kcal_target": int(target),
        "kcal_floor": int(floor),
        "target_protein_g": int(target_protein),
        "target_carbs_g": int(target_carbs),
        "sodium_cap_mg": 2000
    }


def get_health_profile(db: Session, user_id: str) -> Optional[HealthProfile]:
    return db.query(HealthProfile).filter(HealthProfile.user_id == user_id).first()


def upsert_health_profile(db: Session, user_id: str, data: Dict[str, Any], *, commit: bool = True) -> HealthProfile:
    profile = get_health_profile(db, user_id)

    age = int(data.get("age", 25))
    raw_sex = str(data.get("sex", data.get("gender", "F"))).upper()
    sex_enum = UserSex.F if raw_sex in ("F", "PEREMPUAN", "WANITA") else UserSex.M
    height_cm = float(data.get("height_cm", data.get("heightCm", 160.0)))
    weight_kg = float(data.get("weight_kg", data.get("weightKg", 52.0)))
    occupation = data.get("occupation")
    act_str = str(data.get("activity_level", "LIGHT")).upper()
    act_enum = getattr(ActivityLevel, act_str, ActivityLevel.LIGHT)

    raw_goal = str(data.get("goal", "MAINTAIN")).upper()
    if "TURUN" in raw_goal or "LOSE" in raw_goal:
        goal_enum = HealthGoal.LOSE_WEIGHT
    elif "OTOT" in raw_goal or "MUSCLE" in raw_goal:
        goal_enum = HealthGoal.GAIN_MUSCLE
    else:
        goal_enum = HealthGoal.MAINTAIN

    allergies = data.get("allergies", [])
    meal_budget = int(data.get("meal_budget_idr", data.get("mealBudget", 35000)))
    has_med = bool(data.get("has_medical_condition", False))

    targets = calculate_metabolic_targets(age, sex_enum.value, height_cm, weight_kg, act_enum.value, goal_enum.value)

    if not profile:
        profile = HealthProfile(
            user_id=user_id,
            age=age,
            sex=sex_enum,
            height_cm=height_cm,
            weight_kg=weight_kg,
            occupation=occupation,
            activity_level=act_enum,
            goal=goal_enum,
            allergies=allergies,
            meal_budget_idr=meal_budget,
            has_medical_condition=has_med,
            bmr_kcal=targets["bmr_kcal"],
            tdee_kcal=targets["tdee_kcal"],
            kcal_target=targets["kcal_target"],
            kcal_floor=targets["kcal_floor"],
            target_protein_g=targets["target_protein_g"],
            target_carbs_g=targets["target_carbs_g"],
            sodium_cap_mg=targets["sodium_cap_mg"],
            max_dinner_cut_pct=int(data.get("max_dinner_cut_pct", 25)),
            learned_palate=data.get("learned_palate", {})
        )
        db.add(profile)
    else:
        profile.age = age
        profile.sex = sex_enum
        profile.height_cm = height_cm
        profile.weight_kg = weight_kg
        if occupation:
            profile.occupation = occupation
        profile.activity_level = act_enum
        profile.goal = goal_enum
        profile.allergies = allergies
        profile.meal_budget_idr = meal_budget
        profile.has_medical_condition = has_med
        profile.bmr_kcal = targets["bmr_kcal"]
        profile.tdee_kcal = targets["tdee_kcal"]
        profile.kcal_target = targets["kcal_target"]
        profile.kcal_floor = targets["kcal_floor"]
        profile.target_protein_g = targets["target_protein_g"]
        profile.target_carbs_g = targets["target_carbs_g"]
        profile.sodium_cap_mg = targets["sodium_cap_mg"]
        if "max_dinner_cut_pct" in data:
            profile.max_dinner_cut_pct = int(data["max_dinner_cut_pct"])
        if "learned_palate" in data:
            profile.learned_palate = data["learned_palate"]

    if commit:
        db.commit()
        db.refresh(profile)
    else:
        db.flush()
    return profile


# =====================================================================
# 2. MERCHANT & MENU CRUD
# =====================================================================
def get_all_merchants(db: Session) -> List[Merchant]:
    return db.query(Merchant).all()

def get_merchant_by_id(db: Session, merchant_id: str) -> Optional[Merchant]:
    return db.query(Merchant).filter(Merchant.id == merchant_id).first()

def upsert_merchant(db: Session, data: Dict[str, Any]) -> Merchant:
    m_id = data["id"]
    merchant = get_merchant_by_id(db, m_id)
    if not merchant:
        merchant = Merchant(
            id=m_id,
            name=data["name"],
            area=data.get("area", "Kuningan"),
            lat=data.get("lat"),
            lng=data.get("lng"),
            distance_km=data.get("distance_km", 1.0),
            delivery_radius_km=data.get("delivery_radius_km", 2.5),
            rating=data.get("rating", 4.8),
            rating_count=data.get("rating_count", 420),
            is_verified_hygiene=data.get("is_verified_hygiene", True),
            commission_rate=data.get("commission_rate", 0.05),
            image_url=data.get("image_url"),
            is_open=data.get("is_open", True)
        )
        db.add(merchant)
    else:
        merchant.name = data["name"]
        merchant.area = data.get("area", merchant.area)
        merchant.distance_km = data.get("distance_km", merchant.distance_km)
        merchant.delivery_radius_km = data.get("delivery_radius_km", merchant.delivery_radius_km)
        merchant.rating = data.get("rating", merchant.rating)
        merchant.rating_count = data.get("rating_count", merchant.rating_count)
        merchant.is_verified_hygiene = data.get("is_verified_hygiene", merchant.is_verified_hygiene)
        merchant.commission_rate = data.get("commission_rate", merchant.commission_rate)
        merchant.image_url = data.get("image_url", merchant.image_url)
        merchant.is_open = data.get("is_open", merchant.is_open)
    db.commit()
    db.refresh(merchant)
    return merchant


def get_menu_items(
    db: Session,
    merchant_id: Optional[str] = None,
    category: Optional[str] = None,
    is_available: bool = True
) -> List[MenuItem]:
    q = db.query(MenuItem).filter(MenuItem.is_available == is_available)
    if merchant_id:
        q = q.filter(MenuItem.merchant_id == merchant_id)
    if category and category != "semua":
        q = q.filter(MenuItem.category == category)
    return q.all()

def get_menu_item_by_id(db: Session, item_id: str) -> Optional[MenuItem]:
    return db.query(MenuItem).filter(MenuItem.id == item_id).first()

def upsert_menu_item(db: Session, data: Dict[str, Any], *, commit: bool = True) -> MenuItem:
    item_id = data["id"]
    item = get_menu_item_by_id(db, item_id)
    slot = getattr(MealSlot, str(data.get("meal_slot", "ANY")).upper(), MealSlot.ANY)
    source = getattr(NutritionSource, str(data.get("nutrition_source", "ESTIMATE")).upper(), NutritionSource.ESTIMATE)

    if not item:
        item = MenuItem(
            id=item_id,
            merchant_id=data["merchant_id"],
            name=data["name"],
            description=data.get("description", ""),
            meal_slot=slot,
            category=data.get("category", "protein"),
            base_price_idr=int(data["base_price_idr"]),
            discounted_price_idr=int(data["discounted_price_idr"]),
            has_promo=bool(data.get("has_promo", False)),
            rating=float(data.get("rating", 4.8)),
            sold_count=str(data.get("sold_count", "1.2rb+")),
            kcal=int(data["kcal"]),
            protein_g=float(data.get("protein_g", 0.0)),
            carbs_g=float(data.get("carbs_g", 0.0)),
            fat_g=float(data.get("fat_g", 0.0)),
            sodium_mg=int(data.get("sodium_mg", 0)),
            image_url=data.get("image_url"),
            allergens=data.get("allergens", []),
            hygiene_badges=data.get("hygiene_badges", ["Minyak Baru Terverifikasi"]),
            default_notes=data.get("default_notes"),
            nutrition_source=source,
            is_available=bool(data.get("is_available", True))
        )
        db.add(item)
    else:
        item.name = data["name"]
        item.description = data.get("description", item.description)
        item.category = data.get("category", item.category)
        item.base_price_idr = int(data.get("base_price_idr", item.base_price_idr))
        item.discounted_price_idr = int(data.get("discounted_price_idr", item.discounted_price_idr))
        item.has_promo = bool(data.get("has_promo", item.has_promo))
        item.rating = float(data.get("rating", item.rating))
        item.sold_count = str(data.get("sold_count", item.sold_count))
        item.kcal = int(data.get("kcal", item.kcal))
        item.protein_g = float(data.get("protein_g", item.protein_g))
        item.carbs_g = float(data.get("carbs_g", item.carbs_g))
        item.fat_g = float(data.get("fat_g", item.fat_g))
        item.sodium_mg = int(data.get("sodium_mg", item.sodium_mg))
        item.image_url = data.get("image_url", item.image_url)
        item.hygiene_badges = data.get("hygiene_badges", item.hygiene_badges)
        item.default_notes = data.get("default_notes", item.default_notes)
        item.is_available = bool(data.get("is_available", item.is_available))

    db.flush()

    # Empty list explicitly clears tags; omitted tags preserve existing tags.
    if "tags" in data:
        tags = data["tags"]
        db.query(MenuItemTag).filter(MenuItemTag.item_id == item_id).delete()
        for t in tags:
            tag_obj = MenuItemTag(
                item_id=item_id,
                tag=t,
                tagged_by=TagAuthor.MERCHANT if data.get("tagged_by_merchant") else TagAuthor.SYSTEM,
                verified=bool(data.get("verified", False))
            )
            db.add(tag_obj)
        db.flush()
        db.expire(item, ["tags"])
    if commit:
        db.commit()
        db.refresh(item)
    return item

def delete_menu_item(db: Session, item_id: str) -> bool:
    item = get_menu_item_by_id(db, item_id)
    if not item:
        return False
    db.delete(item)
    db.commit()
    return True


# =====================================================================
# 3. RECOMMENDATION CRUD
# =====================================================================
def create_recommendation(
    db: Session,
    reco_id: str,
    user_id: str,
    meal_type: str,
    item_id: str,
    chips: List[str],
    payload: Dict[str, Any],
    source: str = "LIVE",
    is_recalibration: bool = False
) -> Recommendation:
    meal_type_enum = RecommendationMealType.DINNER if meal_type.upper() == "DINNER" else RecommendationMealType.LUNCH
    source_enum = RecommendationSource.CACHED if source.upper() == "CACHED" else RecommendationSource.LIVE
    reco = Recommendation(
        id=reco_id,
        user_id=user_id,
        meal_type=meal_type_enum,
        item_id=item_id,
        chips=chips,
        payload=payload,
        source=source_enum,
        is_recalibration=is_recalibration,
        status=RecommendationStatus.SHOWN
    )
    db.add(reco)
    db.commit()
    db.refresh(reco)
    return reco

def get_latest_recommendation(db: Session, user_id: str) -> Optional[Recommendation]:
    return (
        db.query(Recommendation)
        .filter(Recommendation.user_id == user_id)
        .order_by(Recommendation.created_at.desc())
        .first()
    )


# =====================================================================
# 4. ORDER & CART INJECTION CRUD
# =====================================================================
def create_order(
    db: Session,
    user_id: str,
    merchant_id: str,
    total_idr: int,
    items: List[Dict[str, Any]],
    delivery_fee_idr: int = 10000,
    delivery_discount_idr: int = 10000,
    voucher_code: Optional[str] = "SEABANKSEHAT",
    discount_idr: int = 10000,
    payment_method: str = "seabank",
    delivery_address: str = "Gedung Equity Tower, SCBD / Kuningan, Jakarta Selatan",
    kitchen_notes: Optional[str] = None,
    recommendation_id: Optional[str] = None,
    is_healthy_pick: bool = True
) -> Order:
    # Ensure user exists
    if not get_user(db, user_id):
        upsert_user(db, user_id=user_id, name="NutriSea User", consent_health_data=True)

    # Ensure merchant exists or fallback
    m = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not m:
        fallback_merchant = db.query(Merchant).first()
        merchant_id = fallback_merchant.id if fallback_merchant else "MTR-WBM-01"

    # Verify recommendation FK if supplied
    valid_reco_id = None
    if recommendation_id:
        reco = db.query(Recommendation.id).filter(Recommendation.id == recommendation_id).first()
        if reco:
            valid_reco_id = recommendation_id

    order = Order(
        user_id=user_id,
        merchant_id=merchant_id,
        recommendation_id=valid_reco_id,
        status=OrderStatus.CONFIRMED,
        is_healthy_pick=is_healthy_pick,
        total_idr=total_idr,
        delivery_fee_idr=delivery_fee_idr,
        delivery_discount_idr=delivery_discount_idr,
        voucher_code=voucher_code,
        discount_idr=discount_idr,
        payment_method=payment_method,
        delivery_address=delivery_address,
        kitchen_notes=kitchen_notes
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Ensure valid item_id for order items
    for it in items:
        item_id = it.get("item_id")
        dish = db.query(MenuItem).filter(MenuItem.id == item_id).first()
        if not dish:
            # Fallback to first available dish
            first_dish = db.query(MenuItem).first()
            item_id = first_dish.id if first_dish else "DISH-001"

        oi = OrderItem(
            order_id=order.id,
            item_id=item_id,
            qty=it.get("qty", 1),
            price_idr=it.get("price_idr", 25000)
        )
        db.add(oi)

    db.commit()
    db.refresh(order)
    return order

def get_user_orders(db: Session, user_id: str, limit: int = 20) -> List[Order]:
    return (
        db.query(Order)
        .filter(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
        .limit(limit)
        .all()
    )


# =====================================================================
# 5. MEAL LOG (STM / Vision Scanner) CRUD
# =====================================================================
def log_meal(
    db: Session,
    user_id: str,
    source: str,
    meal_type: str,
    label: str,
    kcal: int,
    protein_g: float = 0.0,
    carbs_g: float = 0.0,
    fat_g: float = 0.0,
    sodium_mg: int = 0,
    order_id: Optional[int] = None,
    food_category: Optional[str] = None,
    cooking_style: Optional[str] = None,
    nutri_grade: Optional[str] = "C",
    density_flags: Optional[List[str]] = None,
    rebalance_note: Optional[str] = None,
    image_url: Optional[str] = None,
    portion_factor: float = 1.0,
    confidence: Optional[float] = None
) -> MealLog:
    src_enum = getattr(MealSource, source.upper(), MealSource.MANUAL)
    meal_enum = getattr(MealTypeEnum, meal_type.upper(), MealTypeEnum.LUNCH)

    entry = MealLog(
        user_id=user_id,
        source=src_enum,
        meal_type=meal_enum,
        order_id=order_id,
        label=label,
        food_category=food_category,
        cooking_style=cooking_style,
        nutri_grade=nutri_grade,
        density_flags=density_flags or [],
        rebalance_note=rebalance_note,
        image_url=image_url,
        portion_factor=portion_factor,
        confidence=confidence,
        kcal=kcal,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
        sodium_mg=sodium_mg
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry

def get_user_meal_logs_today(db: Session, user_id: str) -> List[MealLog]:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return (
        db.query(MealLog)
        .filter(MealLog.user_id == user_id, MealLog.logged_at >= today_start)
        .order_by(MealLog.logged_at.desc())
        .all()
    )


# =====================================================================
# 6. SEABANK REWARD CRUD
# =====================================================================
def award_seabank_reward(
    db: Session,
    user_id: str,
    order_id: int,
    amount_idr: int = 10000,
    reason: str = "HEALTHY_ORDER_DELIVERED",
    interest_bonus_pct: float = 0.50
) -> RewardLedger:
    existing = db.query(RewardLedger).filter(RewardLedger.order_id == order_id).first()
    if existing:
        return existing

    reward = RewardLedger(
        user_id=user_id,
        order_id=order_id,
        amount_idr=amount_idr,
        reason=reason,
        interest_bonus_pct=interest_bonus_pct
    )
    db.add(reward)
    db.commit()
    db.refresh(reward)
    return reward

def get_total_rewards(db: Session, user_id: str) -> int:
    result = db.query(func.coalesce(func.sum(RewardLedger.amount_idr), 0)).filter(RewardLedger.user_id == user_id).scalar()
    return int(result or 0)


# =====================================================================
# 7. MERCHANT DEMAND INSIGHT & CHAT PERSISTENCE CRUD
# =====================================================================
def get_merchant_demand_insight(db: Session, district: str = "Kuningan") -> Optional[MerchantDemandInsight]:
    return db.query(MerchantDemandInsight).filter(MerchantDemandInsight.district.ilike(f"%{district}%")).first()

def save_chat_message(db: Session, user_id: str, role: str, content: str, dish_context: Optional[str] = None, model_used: str = "gemini-3.1-flash-lite") -> ChatMessage:
    msg = ChatMessage(
        user_id=user_id,
        role=role,
        content=content,
        dish_context=dish_context,
        model_used=model_used
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


# =====================================================================
# 8. SHORT-TERM MEMORY (STM) & LONG-TERM MEMORY (LTM) CRUD
# =====================================================================
def log_user_action(db: Session, user_id: str, action_type: str, payload: Dict[str, Any]) -> UserActionLog:
    user = get_user(db, user_id)
    if not user:
        user = upsert_user(db, user_id=user_id, name="NutriSea User", consent_health_data=True)
    
    action = UserActionLog(
        user_id=user_id,
        action_type=action_type,
        payload=payload or {}
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action

def get_user_recent_actions(db: Session, user_id: str, limit: int = 15) -> List[UserActionLog]:
    return (
        db.query(UserActionLog)
        .filter(UserActionLog.user_id == user_id)
        .order_by(UserActionLog.created_at.desc())
        .limit(limit)
        .all()
    )

def get_user_memories(db: Session, user_id: str) -> List[UserMemoryItem]:
    return (
        db.query(UserMemoryItem)
        .filter(UserMemoryItem.user_id == user_id)
        .order_by(UserMemoryItem.created_at.desc())
        .all()
    )

def save_user_memory(
    db: Session,
    user_id: str,
    category: str,
    fact_text: str,
    confidence: float = 0.90,
    source: str = "chat_interaction"
) -> Optional[UserMemoryItem]:
    user = get_user(db, user_id)
    if not user:
        user = upsert_user(db, user_id=user_id, name="NutriSea User", consent_health_data=True)

    # Check for existing duplicate fact
    existing = (
        db.query(UserMemoryItem)
        .filter(UserMemoryItem.user_id == user_id, func.lower(UserMemoryItem.fact_text) == fact_text.strip().lower())
        .first()
    )
    if existing:
        return existing

    memory = UserMemoryItem(
        user_id=user_id,
        category=category,
        fact_text=fact_text.strip(),
        confidence=confidence,
        source=source
    )
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory

def get_persona(db: Session, persona_id: str) -> Optional[Persona]:
    return db.query(Persona).filter(Persona.id == persona_id).first()

def get_personas_by_ids(db: Session, persona_ids: List[str]) -> List[Persona]:
    if not persona_ids:
        return []
    return db.query(Persona).filter(Persona.id.in_(persona_ids)).all()
