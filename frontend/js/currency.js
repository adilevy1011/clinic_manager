export const DEFAULT_USD_TO_ILS = 3.6;

export async function getOfficialShekelRate() {
  try {
    const response = await fetch('/api/exchange-rate', {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Exchange-rate request failed: ${response.status}`);
    }

    const payload = await response.json();
    const rate = Number(payload.rate);

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('The exchange-rate response was invalid.');
    }

    return rate;
  } catch (error) {
    console.warn('Using the fallback USD/ILS rate:', error);
    return DEFAULT_USD_TO_ILS;
  }
}

export function ils(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function usd(value, rate = DEFAULT_USD_TO_ILS) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(Number(value || 0) / rate);
}

export function primary(value, currency = 'ILS', rate = DEFAULT_USD_TO_ILS) {
  return currency === 'USD' ? usd(value, rate) : ils(value);
}

export function secondary(value, currency = 'ILS', rate = DEFAULT_USD_TO_ILS) {
  return currency === 'USD' ? ils(value) : usd(value, rate);
}
