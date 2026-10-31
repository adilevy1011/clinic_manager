"""Environment-backed application settings."""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    supabase_url: str = os.environ.get("SUPABASE_URL", "")
    supabase_anon_key: str = os.environ.get(
        "SUPABASE_ANON_KEY",
        os.environ.get("SUPABASE_PUBLIC_KEY", ""),
    )
    resend_api_key: str = os.environ.get("RESEND_API_KEY", "")
    resend_from: str = os.environ.get("RESEND_FROM", "")
    frontend_url: str = os.environ.get("FRONTEND_URL", "http://localhost:3000")
    cors_origins: list[str] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        if self.cors_origins is None:
            object.__setattr__(
                self,
                "cors_origins",
                [
                    origin.strip()
                    for origin in os.environ.get(
                        "CORS_ORIGINS",
                        self.frontend_url,
                    ).split(",")
                    if origin.strip()
                ],
            )


settings = Settings()
