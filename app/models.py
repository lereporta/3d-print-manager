from sqlalchemy import Column, Integer, Float, String, DateTime, Boolean
from app.database import Base
from datetime import datetime, timezone
import enum


class JobStatus(str, enum.Enum):
    PENDENTE = "Pendente"
    IMPRIMINDO = "Imprimindo"
    FINALIZADO = "Finalizado"


class JobPriority(str, enum.Enum):
    BAIXA = "Baixa"
    MEDIA = "Média"
    ALTA = "Alta"
    URGENTE = "Urgente"


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
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
    piece_name = Column(String, default="Sem nome")
    filament_price_kg = Column(Float, nullable=False)
    piece_weight_g = Column(Float, nullable=False)
    print_time_h = Column(Float, nullable=False)
    manual_time_h = Column(Float, nullable=False)
    filament_cost = Column(Float, nullable=False)
    energy_cost = Column(Float, nullable=False)
    depreciation_cost = Column(Float, nullable=False)
    labor_cost = Column(Float, nullable=False)
    subtotal = Column(Float, nullable=False)
    risk_rate = Column(Float, nullable=False, default=10.0)
    risk_cost = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    margin_percent = Column(Float, nullable=False, default=100.0)
    final_price = Column(Float, nullable=False)
    price_100 = Column(Float, nullable=False)
    price_200 = Column(Float, nullable=False)
    price_400 = Column(Float, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class PrintJob(Base):
    __tablename__ = "print_jobs"

    id = Column(Integer, primary_key=True, index=True)
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
    name = Column(String, nullable=False)
    color = Column(String, nullable=False, default="Branco")
    color_hex = Column(String, default="#FFFFFF")
    material = Column(String, default="PLA")
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
        return round(
            ((self.initial_weight_g - self.current_weight_g) / self.initial_weight_g)
            * 100,
            1,
        )

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

