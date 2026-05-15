from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data"
)
os.makedirs(DATABASE_DIR, exist_ok=True)

DATABASE_URL = f"sqlite:///{os.path.join(DATABASE_DIR, 'print_manager.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models import Budget, PrintJob, Settings, Spool

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        existing = db.query(Settings).first()
        if not existing:
            defaults = Settings(
                filament_price_kg=120.00,
                energy_tariff=0.85,
                printer_consumption=0.12,
                depreciation_per_hour=2.00,
                labor_per_hour=30.00,
                risk_rate=10.0,
                machine_cost=0.0,
            )
            db.add(defaults)
            db.commit()
        else:
            # Migrate: add machine_cost if column missing in old DB
            if not hasattr(existing, "machine_cost") or existing.machine_cost is None:
                existing.machine_cost = 0.0
                db.commit()
    finally:
        db.close()

