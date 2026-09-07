/**
 * Dynamic API and WebSocket configuration (FE-01).
 * Reads environment variables from Vite or falls back safely to local ports.
 */

const rawApiUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
  ? import.meta.env.VITE_API_URL
  : "";

// Ensure URL does not end with trailing slash
export const API_BASE_URL = rawApiUrl.replace(/\/+$/, "");

// Derive WebSocket base URL (http->ws, https->wss)
const defaultWs = (typeof window !== 'undefined' && window.location)
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  : "ws://127.0.0.1:8000";

const rawWsUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WS_URL)
  ? import.meta.env.VITE_WS_URL
  : (API_BASE_URL ? API_BASE_URL.replace(/^http/, 'ws') : defaultWs);

export const WS_BASE_URL = rawWsUrl.replace(/\/+$/, "");

export default API_BASE_URL;
