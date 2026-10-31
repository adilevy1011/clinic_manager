export const API_URL = window.API_URL || '/api';

// Demo mode keeps the static frontend useful before a backend is configured.
// Production can disable it with window.ENABLE_PRODUCTION_AUTH = true.
export const DEMO_MODE =
  location.hostname === 'localhost' &&
  location.port === '3000' &&
  !window.ENABLE_PRODUCTION_AUTH;
