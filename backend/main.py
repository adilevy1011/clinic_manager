"""Application entrypoint for the Clinic Manager API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from .app.config import settings
    from .app.routers import auth, clients, email, meetings, rates, reminders, users
except ImportError:
    from app.config import settings
    from app.routers import auth, clients, email, meetings, rates, reminders, users


def create_app() -> FastAPI:
    application = FastAPI(title="Clinic Manager API", version="1.0.0")

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    application.include_router(auth.router)
    application.include_router(users.router)
    application.include_router(clients.router)
    application.include_router(meetings.router)
    application.include_router(email.router)
    application.include_router(rates.router)
    application.include_router(reminders.router)

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "clinic-manager-api"}

    return application


app = create_app()
