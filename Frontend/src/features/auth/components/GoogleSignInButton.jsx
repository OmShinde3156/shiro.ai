import React, { useState, useEffect, useRef } from 'react';
import API_BASE_URL from '../../../api/config';
import { Sparkles, Info, X, Check, Loader2 } from 'lucide-react';

// Dynamically load Google Identity Services SDK if not already loaded in DOM
const loadGoogleGsiScript = () => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    if (window.google?.accounts) return resolve(window.google);

    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google || null));
      existing.addEventListener('error', () => resolve(null));
      // In case it finished loading just before the listener
      setTimeout(() => resolve(window.google || null), 500);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
};

export default function GoogleSignInButton({ onSuccess, onError, disabled, text }) {
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState(() => {
    return (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) || '';
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const googleBtnContainerRef = useRef(null);

  // 1. Fetch public Google Client ID configuration if not passed via Vite env
  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      try {
        const endpoints = [`${API_BASE_URL}/api/auth/sso/config`, `${API_BASE_URL}/auth/google/config`];
        for (const ep of endpoints) {
          try {
            const res = await fetch(ep);
            if (res.ok) {
              const data = await res.json();
              const cid = data.google_client_id || data.client_id;
              if (isMounted && cid) {
                setClientId(cid);
                break;
              }
            }
          } catch (_) {}
        }
      } catch (e) {
        // Silently continue
      }
    };

    if (!clientId) {
      fetchConfig();
    }
    return () => {
      isMounted = false;
    };
  }, [clientId]);

  // 2. Initialize Google Identity Services (GSI) when client_id & SDK are available
  useEffect(() => {
    if (!clientId || typeof window === 'undefined') return;

    let isCancelled = false;
    loadGoogleGsiScript().then((google) => {
      if (isCancelled || !google?.accounts?.id) return;
      try {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        if (googleBtnContainerRef.current) {
          google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'outline',
            size: 'large',
            width: '100%',
            text: 'continue_with',
            shape: 'pill',
          });
        }
      } catch (err) {
        console.warn('Google Identity Services initialization warning:', err);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [clientId]);

  // Exchange token or credential with backend
  const exchangeTokenWithBackend = async (credentialOrToken) => {
    setLoading(true);
    try {
      const endpoints = [`${API_BASE_URL}/api/auth/google`, `${API_BASE_URL}/auth/google`];
      let lastErr = null;
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Pinggy-No-Screen': 'true',
              'ngrok-skip-browser-warning': 'true',
            },
            body: JSON.stringify({ credential: credentialOrToken }),
          });

          if (res.ok) {
            const data = await res.json();
            onSuccess?.(data);
            return;
          } else {
            const err = await res.json();
            lastErr = err.detail || 'Google authentication failed on server.';
          }
        } catch (e) {
          lastErr = e.message;
        }
      }
      throw new Error(lastErr || 'Google authentication failed.');
    } catch (err) {
      onError?.(err.message || 'Failed to authenticate with Google.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle credential token exchange from GSI One-Tap
  const handleGoogleCredentialResponse = async (response) => {
    if (!response || !response.credential) {
      onError?.('No credential returned from Google Sign-In.');
      return;
    }
    await exchangeTokenWithBackend(response.credential);
  };

  // 4. Custom Button Click Handler: Dynamic resolution + Popup + Direct OAuth Redirect fallback
  const handleClick = async () => {
    if (disabled || loading) return;

    let targetClientId = clientId;

    // If client ID is not yet in React state, fetch immediately on demand
    if (!targetClientId) {
      setLoading(true);
      try {
        const endpoints = [`${API_BASE_URL}/api/auth/sso/config`, `${API_BASE_URL}/auth/google/config`];
        for (const ep of endpoints) {
          try {
            const res = await fetch(ep);
            if (res.ok) {
              const data = await res.json();
              const cid = data.google_client_id || data.client_id;
              if (cid) {
                targetClientId = cid;
                setClientId(cid);
                break;
              }
            }
          } catch (_) {}
        }
      } catch (e) {
        console.warn('Failed to resolve Google Client ID on demand:', e);
      } finally {
        setLoading(false);
      }
    }

    if (!targetClientId) {
      // Only show developer modal if client ID is completely absent from server and env
      setShowConfigModal(true);
      return;
    }

    setLoading(true);
    const google = await loadGoogleGsiScript();
    setLoading(false);

    // Modern Google Identity Services: OAuth2 Token Client popup
    if (google?.accounts?.oauth2) {
      try {
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: targetClientId,
          scope: 'email profile openid',
          callback: async (tokenResponse) => {
            if (tokenResponse?.error) {
              if (tokenResponse.error !== 'popup_closed_by_user') {
                onError?.(`Google Sign-In: ${tokenResponse.error}`);
              }
              return;
            }
            if (tokenResponse?.access_token) {
              await exchangeTokenWithBackend(tokenResponse.access_token);
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.warn('Google initTokenClient popup failed, attempting direct OAuth redirect:', err);
      }
    }

    // Direct Google OAuth2 Redirect fallback (immune to popup blockers)
    const redirectUri = `${window.location.origin}/login?provider=google`;
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(targetClientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent('email profile openid')}&prompt=select_account`;
    window.location.href = googleAuthUrl;
  };

  // 5. Test with Sandbox/Demo Google Profile (allows verifying user creation and flow without GSI keys)
  const handleTestDemoGoogleLogin = async () => {
    setShowConfigModal(false);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pinggy-No-Screen': 'true',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ credential: 'demo_google_token' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Demo Google login failed.');
      }

      const data = await res.json();
      onSuccess?.(data);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="w-full relative">
        {/* Hidden container for Google GSI rendered button */}
        <div ref={googleBtnContainerRef} className="hidden" aria-hidden="true" />

        {/* Custom High-Aesthetic Button */}
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled || loading}
          className="w-full py-2.5 px-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-focus)] active:scale-[0.99] text-[var(--text-main)] text-xs font-semibold flex items-center justify-center gap-3 transition-all cursor-pointer shadow-2xs group disabled:opacity-50"
          aria-label="Continue with Google"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)]" />
          ) : (
            /* Official Google G Logo SVG */
            <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.94H1.27v3.15C3.25 21.31 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.26c-.25-.72-.38-1.49-.38-2.26s.13-1.54.38-2.26V6.59H1.27C.46 8.21 0 10.05 0 12s.46 3.79 1.27 5.41l4.01-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.27 6.59l4.01 3.15c.95-2.84 3.6-4.99 6.72-4.99z"
              />
            </svg>
          )}

          <span className="truncate">{loading ? 'Connecting...' : (text || 'Google')}</span>
        </button>
      </div>

      {/* Setup / Developer Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--primary)] font-semibold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>Google SSO Integration</span>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-[var(--text-secondary)] space-y-2 leading-relaxed">
              <p>
                The backend <code className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] text-[var(--text-main)] font-mono">/auth/google</code> endpoint is fully wired and ready to verify Google ID Tokens.
              </p>
              <div className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] space-y-1.5">
                <div className="font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>To enable live Google Sign-In:</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Add your OAuth 2.0 Web Client ID from Google Cloud Console into <code className="text-[var(--primary)]">Backend/.env</code>:
                </p>
                <pre className="p-2 rounded bg-black/40 text-[10px] text-emerald-400 font-mono overflow-x-auto select-all">
                  GOOGLE_CLIENT_ID=your-id.apps.googleusercontent.com
                </pre>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleTestDemoGoogleLogin}
                className="flex-1 py-2 px-3 rounded-xl bg-[var(--primary)] hover:brightness-105 active:scale-[0.98] text-white dark:text-[#0F100E] font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Test Demo Google Profile</span>
              </button>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="py-2 px-3 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-main)] text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
