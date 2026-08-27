/**
 * Dynamic API and WebSocket configuration (FE-01).
 * Reads environment variables from Vite or falls back safely to local ports.
 */

const rawApiUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) 
  ? import.meta.env.VITE_API_URL 
  : "http://127.0.0.1:8000";

// Ensure URL does not end with trailing slash
export const API_BASE_URL = rawApiUrl.replace(/\/+$/, "");

// Derive WebSocket base URL (http->ws, https->wss)
const rawWsUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WS_URL)
  ? import.meta.env.VITE_WS_URL
  : API_BASE_URL.replace(/^http/, 'ws');

export const WS_BASE_URL = rawWsUrl.replace(/\/+$/, "");

export default API_BASE_URL;
