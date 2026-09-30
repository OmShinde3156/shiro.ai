import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../../../api/config';
import { Loader2, Sparkles, X, Check, Info } from 'lucide-react';

export default function GitHubSignInButton({ onSuccess, onError, disabled, text }) {
  const [loading, setLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [clientId, setClientId] = useState(() => {
    return (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GITHUB_CLIENT_ID) || '';
  });

  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      try {
        const endpoints = [`${API_BASE_URL}/api/auth/sso/config`, `${API_BASE_URL}/auth/sso/config`];
        for (const ep of endpoints) {
          try {
            const res = await fetch(ep);
            if (res.ok) {
              const data = await res.json();
              if (isMounted && data.github_client_id) {
                setClientId(data.github_client_id);
                break;
              }
            }
          } catch (_) {}
        }
      } catch (e) {
        // Fallback silently
      }
    };
    if (!clientId) {
      fetchConfig();
    }
    return () => {
      isMounted = false;
    };
  }, [clientId]);

  const handleClick = async () => {
    if (disabled || loading) return;

    let targetClientId = clientId;

    // If client ID is not yet in React state, fetch immediately on demand
    if (!targetClientId) {
      setLoading(true);
      try {
        const endpoints = [`${API_BASE_URL}/api/auth/sso/config`, `${API_BASE_URL}/auth/sso/config`];
        for (const ep of endpoints) {
          try {
            const res = await fetch(ep);
            if (res.ok) {
              const data = await res.json();
              if (data.github_client_id) {
                targetClientId = data.github_client_id;
                setClientId(targetClientId);
                break;
              }
            }
          } catch (_) {}
        }
      } catch (e) {
        console.warn('Failed to resolve GitHub Client ID on demand:', e);
      } finally {
        setLoading(false);
      }
    }

    if (targetClientId) {
      const redirectUri = `${window.location.origin}/login?provider=github`;
      const scope = 'read:user user:email';
      window.location.href = `https://github.com/login/oauth/authorize?client_id=${targetClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
      return;
    }

    // Only show modal if GitHub OAuth is genuinely unconfigured on server
    setShowConfigModal(true);
  };

  const handleTestDemoGitHubLogin = async () => {
    setShowConfigModal(false);
    setLoading(true);
    try {
      const endpoints = [`${API_BASE_URL}/api/auth/github`, `${API_BASE_URL}/auth/github`];
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
            body: JSON.stringify({ credential: 'demo_github_engineer_token' }),
          });

          if (res.ok) {
            const data = await res.json();
            onSuccess?.(data);
            return;
          } else {
            const err = await res.json();
            lastErr = err.detail || 'Demo GitHub login failed.';
          }
        } catch (e) {
          lastErr = e.message;
        }
      }
      throw new Error(lastErr || 'Demo GitHub login failed.');
    } catch (err) {
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className="w-full py-2.5 px-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-focus)] active:scale-[0.99] text-[var(--text-main)] text-xs font-semibold flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-2xs group disabled:opacity-50"
        aria-label="Continue with GitHub"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)]" />
        ) : (
          /* Official GitHub Octocat SVG */
          <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110 fill-current text-[var(--text-main)]" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
        )}
        <span className="truncate">{loading ? 'Connecting...' : (text || 'GitHub')}</span>
      </button>

      {/* Developer Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--primary)] font-semibold text-sm">
                <Sparkles className="w-4 h-4" />
                <span>GitHub Developer SSO</span>
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
                The backend <code className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] text-[var(--text-main)] font-mono">/auth/github</code> endpoint is active and ready to link GitHub developer accounts.
              </p>
              <div className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] space-y-1.5">
                <div className="font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>To enable live GitHub OAuth redirect:</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Register a GitHub OAuth App in GitHub Developer Settings and add to <code className="text-[var(--primary)]">Frontend/.env</code>:
                </p>
                <pre className="p-2 rounded bg-black/40 text-[10px] text-emerald-400 font-mono overflow-x-auto select-all">
                  VITE_GITHUB_CLIENT_ID=your_github_client_id
                </pre>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleTestDemoGitHubLogin}
                className="flex-1 py-2 px-3 rounded-xl bg-[var(--primary)] hover:brightness-105 active:scale-[0.98] text-white dark:text-[#0F100E] font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Test Demo GitHub Profile</span>
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
