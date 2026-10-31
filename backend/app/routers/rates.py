"""Exchange-rate endpoint backed by the Bank of Israel public API."""

from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import current_user

router = APIRouter(prefix="/api", tags=["currency"])


def extract_usd_rate(payload: Any) -> float | None:
    if isinstance(payload, (int, float, str)):
        value = float(payload)
        return value if value > 0 else None

    if isinstance(payload, dict):
        for key in ("currentExchangeRate", "exchangeRate", "rate"):
            if key in payload:
                return extract_usd_rate(payload[key])
        for key in ("exchangeRates", "data"):
            if isinstance(payload.get(key), list) and payload[key]:
                return extract_usd_rate(payload[key][0])

    return None


@router.get("/exchange-rate")
def exchange_rate(context=Depends(current_user)) -> dict[str, float | str]:
    del context
    try:
        response = httpx.get(
            "https://boi.org.il/PublicApi/GetExchangeRate?key=USD",
            timeout=8,
        )
        response.raise_for_status()
        rate = extract_usd_rate(response.json())
    except (httpx.HTTPError, ValueError, TypeError):
        rate = None

    if not rate:
        raise HTTPException(502, "The official exchange rate is temporarily unavailable.")

    return {"base": "USD", "quote": "ILS", "rate": rate}
