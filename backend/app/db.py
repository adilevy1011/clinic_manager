"""Small authenticated PostgREST client used by the API layer."""

from typing import Any

import httpx
from fastapi import HTTPException

from .config import settings


class SupabaseResult:
    def __init__(self, data: Any):
        self.data = data


class SupabaseTable:
    def __init__(self, database: "SupabaseDatabase", table: str):
        self.database = database
        self.table = table
        self.params: list[tuple[str, str]] = []
        self.headers: dict[str, str] = {}
        self.method = "GET"
        self.payload: Any = None

    def select(self, columns: str = "*") -> "SupabaseTable":
        self.params.append(("select", columns))
        return self

    def eq(self, column: str, value: Any) -> "SupabaseTable":
        self.params.append((column, f"eq.{value}"))
        return self

    def gte(self, column: str, value: Any) -> "SupabaseTable":
        self.params.append((column, f"gte.{value}"))
        return self

    def lt(self, column: str, value: Any) -> "SupabaseTable":
        self.params.append((column, f"lt.{value}"))
        return self

    def order(self, column: str) -> "SupabaseTable":
        self.params.append(("order", column))
        return self

    def single(self) -> "SupabaseTable":
        self.headers["Accept"] = "application/vnd.pgrst.object+json"
        return self

    def insert(self, payload: Any) -> "SupabaseTable":
        self.method = "POST"
        self.payload = payload
        self.headers["Prefer"] = "return=representation"
        return self

    def upsert(self, payload: Any) -> "SupabaseTable":
        self.method = "POST"
        self.payload = payload
        self.headers["Prefer"] = "resolution=merge-duplicates,return=representation"
        return self

    def update(self, payload: Any) -> "SupabaseTable":
        self.method = "PATCH"
        self.payload = payload
        self.headers["Prefer"] = "return=representation"
        return self

    def delete(self) -> "SupabaseTable":
        self.method = "DELETE"
        self.headers["Prefer"] = "return=representation"
        return self

    def execute(self) -> SupabaseResult:
        response = httpx.request(
            self.method,
            f"{self.database.url}/rest/v1/{self.table}",
            params=self.params,
            headers={**self.database.headers, **self.headers},
            json=self.payload,
            timeout=10,
        )
        if response.status_code >= 400:
            raise HTTPException(502, "The database request failed.")

        data = response.json() if response.content else []
        if self.headers.get("Accept") == "application/vnd.pgrst.object+json":
            return SupabaseResult(data)
        return SupabaseResult(data if isinstance(data, list) else [data])


class SupabaseDatabase:
    def __init__(self, token: str):
        self.url = settings.supabase_url
        self.headers = {
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    def table(self, table: str) -> SupabaseTable:
        return SupabaseTable(self, table)


def require_database(token: str) -> SupabaseDatabase:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(503, "Supabase is not configured.")
    return SupabaseDatabase(token)
