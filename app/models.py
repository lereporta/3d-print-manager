from sqlalchemy import Column, Integer, Float, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime, timezone
import enum
import json


class JobStatus(str, enum.Enum):
    PENDENTE = "Pendente"
    IMPRIMINDO = "Imprimindo"
    FINALIZADO = "Finalizado"


class JobPriority(str, enum.Enum):
    BAIXA = "Baixa"
    MEDIA = "Média"
    ALTA = "Alta"
    URGENTE = "Urgente"


# ═══════════════════════════════════════════════════════════
#  USUÁRIOS E AUTENTICAÇÃO
# ═══════════════════════════════════════════════════════════
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PasswordResetRequest(Base):
    __tablename__ = "password_reset_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reset_token = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_resolved = Column(Boolean, default=False, nullable=False)

    user = relationship("User")


# ═══════════════════════════════════════════════════════════
#  TELEMETRIA
# ═══════════════════════════════════════════════════════════
class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    text_content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")


class UsageAnalytics(Base):
    __tablename__ = "usage_analytics"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action_name = Column(String, nullable=False, index=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))


# ═══════════════════════════════════════════════════════════
#  DADOS DA APLICAÇÃO (agora com user_id)
# ═══════════════════════════════════════════════════════════
class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    filament_price_kg = Column(Float, default=120.00)
    energy_tariff = Column(Float, default=0.85)
    printer_consumption = Column(Float, default=0.12)
    depreciation_per_hour = Column(Float, default=2.00)
    labor_per_hour = Column(Float, default=30.00)
    risk_rate = Column(Float, default=10.0)
    machine_cost = Column(Float, default=0.0)


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    piece_name = Column(String, default="Sem nome")
    filament_price_kg = Column(Float, nullable=False)
    piece_weight_g = Column(Float, nullable=False)
    print_time_h = Column(Float, nullable=False)
    manual_time_h = Column(Float, nullable=False)
    filament_cost = Column(Float, nullable=False)
    energy_cost = Column(Float, nullable=False)
    depreciation_cost = Column(Float, nullable=False)
    labor_cost = Column(Float, nullable=False)
    supplies_cost = Column(Float, nullable=False, default=0.0)
    subtotal = Column(Float, nullable=False)
    risk_rate = Column(Float, nullable=False, default=10.0)
    risk_cost = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    margin_percent = Column(Float, nullable=False, default=100.0)
    value_multiplier = Column(Float, nullable=False, default=1.0)
    final_price = Column(Float, nullable=False)
    price_100 = Column(Float, nullable=False)
    price_200 = Column(Float, nullable=False)
    price_400 = Column(Float, nullable=False)
    lot_quantity = Column(Integer, default=1)
    unit_cost = Column(Float, nullable=True)
    unit_price = Column(Float, nullable=True)
    filaments_json = Column(Text, nullable=True, default="[]")
    supplies_json = Column(Text, nullable=True, default="[]")
    depreciation_per_hour = Column(Float, nullable=True)
    labor_per_hour = Column(Float, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    @property
    def filaments(self):
        try:
            return json.loads(self.filaments_json or "[]")
        except (json.JSONDecodeError, TypeError):
            return []

    @filaments.setter
    def filaments(self, value):
        self.filaments_json = json.dumps(value, ensure_ascii=False)

    @property
    def supplies(self):
        try:
            return json.loads(self.supplies_json or "[]")
        except (json.JSONDecodeError, TypeError):
            return []

    @supplies.setter
    def supplies(self, value):
        self.supplies_json = json.dumps(value, ensure_ascii=False)

    @property
    def profit_margin(self):
        """Margem de lucro real (%) baseada em unit_price e unit_cost."""
        if self.unit_cost and self.unit_cost > 0 and self.unit_price:
            return round(((self.unit_price - self.unit_cost) / self.unit_price) * 100, 2)
        return 0.0

    def to_dict(self):
        return {
            "id": self.id,
            "piece_name": self.piece_name,
            "filament_price_kg": self.filament_price_kg,
            "piece_weight_g": self.piece_weight_g,
            "print_time_h": self.print_time_h,
            "manual_time_h": self.manual_time_h,
            "filament_cost": self.filament_cost,
            "energy_cost": self.energy_cost,
            "depreciation_cost": self.depreciation_cost,
            "depreciation_per_hour": self.depreciation_per_hour,
            "labor_cost": self.labor_cost,
            "labor_per_hour": self.labor_per_hour,
            "supplies_cost": self.supplies_cost,
            "subtotal": self.subtotal,
            "risk_rate": self.risk_rate,
            "risk_cost": self.risk_cost,
            "total_cost": self.total_cost,
            "margin_percent": self.margin_percent,
            "value_multiplier": self.value_multiplier,
            "final_price": self.final_price,
            "price_100": self.price_100,
            "price_200": self.price_200,
            "price_400": self.price_400,
            "lot_quantity": self.lot_quantity,
            "unit_cost": self.unit_cost,
            "unit_price": self.unit_price,
            "filaments": self.filaments,
            "supplies": self.supplies,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PrintJob(Base):
    __tablename__ = "print_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    job_name = Column(String, nullable=False)
    piece_weight_g = Column(Float, default=0.0)
    spool_id = Column(Integer, nullable=True)
    status = Column(String, default=JobStatus.PENDENTE.value)
    priority = Column(String, default=JobPriority.MEDIA.value)
    notes = Column(String, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class Spool(Base):
    __tablename__ = "spools"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False, default="Branco")
    color_hex = Column(String, default="#FFFFFF")
    material = Column(String, default="PLA")
    price_per_kg = Column(Float, nullable=False, default=0.0)
    initial_weight_g = Column(Float, nullable=False)
    current_weight_g = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    @property
    def usage_percent(self):
        if self.initial_weight_g <= 0:
            return 0
        return round(((self.initial_weight_g - self.current_weight_g) / self.initial_weight_g) * 100, 1)

    @property
    def remaining_percent(self):
        if self.initial_weight_g <= 0:
            return 0
        return round((self.current_weight_g / self.initial_weight_g) * 100, 1)

    @property
    def is_low(self):
        return self.remaining_percent <= 10

    @property
    def is_empty(self):
        return self.current_weight_g <= 0

