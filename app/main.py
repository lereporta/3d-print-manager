from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.database import init_db
from app.routes import dashboard, history, queue, inventory

app = FastAPI(title="3D Print Manager", version="2.0.0")

app.mount("/static", StaticFiles(directory="app/static"), name="static")

app.include_router(dashboard.router)
app.include_router(history.router)
app.include_router(queue.router)
app.include_router(inventory.router)


@app.on_event("startup")
def on_startup():
    init_db()

