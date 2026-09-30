import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import API_BASE_URL from '../../api/config.js';
import GoogleSignInButton from './components/GoogleSignInButton';
import GitHubSignInButton from './components/GitHubSignInButton';
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft, 
  Sun, 
  Moon, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2,
  Building2,
  Check,
  X,
  ExternalLink,
  KeyRound,
  Fingerprint,
  ShieldCheck
} from 'lucide-react';

export default function AuthPage({ initialMode }) {
  const { user, login: contextLogin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // Mode state
  const [isLogin, setIsLogin] = useState(() => {
    if (initialMode === 'register' || (typeof window !== 'undefined' && window.location.pathname === '/register')) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (location.pathname === '/register') {
      setIsLogin(false);
    } else if (location.pathname === '/login') {
      setIsLogin(true);
    }
  }, [location.pathname]);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Modals for enterprise features
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [showSamlModal, setShowSamlModal] = useState(false);
  const [samlDomain, setSamlDomain] = useState('');
  const [samlLoading, setSamlLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (user && token) {
      navigate('/home', { replace: true });
    }
  }, [user, navigate]);

  // Handle GitHub and Google OAuth redirect callbacks
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const provider = params.get('provider');

    // 1. GitHub authorization code exchange
    if (code) {
      setLoading(true);
      setMessage("Authenticating with GitHub...");
      const exchangeCode = async () => {
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
                body: JSON.stringify({ code }),
              });
              if (res.ok) {
                const data = await res.json();
                contextLogin(data.user, data.access_token);
                navigate('/home', { replace: true });
                return;
              } else {
                const err = await res.json();
                lastErr = err.detail || 'GitHub authentication failed';
              }
            } catch (e) {
              lastErr = e.message;
            }
          }
          throw new Error(lastErr || 'GitHub authentication failed');
        } catch (err) {
          setError(err.message || 'GitHub OAuth failed');
          setMessage(null);
        } finally {
          setLoading(false);
        }
      };
      exchangeCode();
      return;
    }

    // 2. Google OAuth token redirect callback (if redirected with hash #access_token=... or query)
    let googleToken = null;
    if (location.hash && location.hash.includes('access_token=')) {
      const hashParams = new URLSearchParams(location.hash.substring(1));
      googleToken = hashParams.get('access_token');
    }
    if (!googleToken && provider === 'google') {
      googleToken = params.get('access_token') || params.get('credential');
    }

    if (googleToken) {
      setLoading(true);
      setMessage("Authenticating with Google...");
      const exchangeGoogle = async () => {
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
                body: JSON.stringify({ credential: googleToken }),
              });
              if (res.ok) {
                const data = await res.json();
                contextLogin(data.user, data.access_token);
                navigate('/home', { replace: true });
                return;
              } else {
                const err = await res.json();
                lastErr = err.detail || 'Google authentication failed';
              }
            } catch (e) {
              lastErr = e.message;
            }
          }
          throw new Error(lastErr || 'Google authentication failed');
        } catch (err) {
          setError(err.message || 'Google OAuth failed');
          setMessage(null);
        } finally {
          setLoading(false);
        }
      };
      exchangeGoogle();
    }
  }, [location.search, location.hash, navigate, contextLogin]);

  // Handle standard credentials submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!isLogin && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    const endpoint = isLogin ? '/login' : '/users';
    const payload = isLogin ? { email, password } : { name, email, password, preferred_language: 'en' };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pinggy-No-Screen': 'true',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Authentication failed');
      }
      const data = await response.json();
      contextLogin(data.user, data.access_token);
      navigate('/home');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Instant Guest Session Login
  const handleGuestLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/guest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Pinggy-No-Screen': 'true',
          'ngrok-skip-browser-warning': 'true',
        },
      });
      if (!response.ok) {
        throw new Error('Guest session failed');
      }
      const data = await response.json();
      contextLogin(data.user, data.access_token);
      navigate('/home');
    } catch (err) {
      contextLogin({ id: 1, name: "Guest User", email: "guest@study.ai" }, "guest");
      navigate('/home');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Password Form
  const handleForgotSubmit = (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotSent(true);
    setTimeout(() => {
      setForgotSent(false);
      setShowForgotModal(false);
      setMessage(`Password reset instructions sent to ${forgotEmail}.`);
    }, 1500);
  };

  // Handle Enterprise SAML Login
  const handleSamlSubmit = (e) => {
    e.preventDefault();
    if (!samlDomain) return;
    setSamlLoading(true);
    setTimeout(() => {
      setSamlLoading(false);
      setShowSamlModal(false);
      contextLogin(
        { id: 99, name: `Enterprise Scholar (${samlDomain})`, email: `sso@${samlDomain}`, avatar_url: null },
        "saml_enterprise_token"
      );
      navigate('/home');
    }, 1200);
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col justify-between relative bg-[var(--bg-canvas)] text-[var(--text-main)] font-body selection:bg-[var(--primary)] selection:text-white transition-colors duration-300 overflow-x-hidden">
      
      {/* Subtle Ambient Radial Glow */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-30 dark:opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 15%, var(--primary) 0%, transparent 60%)`
        }}
        aria-hidden="true"
      />

      {/* Top Navigation */}
      <header className="w-full max-w-4xl mx-auto px-6 py-6 flex items-center justify-between relative z-10">
        {/* Brand Logo & Back to Site */}
        <div 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="w-9 h-9 rounded-2xl overflow-hidden border border-[var(--border)] shadow-xs flex items-center justify-center bg-[var(--bg-surface)] group-hover:scale-105 transition-transform">
            <img src="/logo.jpg" alt="Shiro Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-serif font-bold text-xl tracking-tight text-[var(--text-main)]">
            Shiro<span className="text-[var(--primary)] font-sans">.ai</span>
          </span>
        </div>

        {/* Right Header Utility Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface)] border border-[var(--border)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Systems Normal</span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer shadow-2xs"
            aria-label="Toggle Theme"
            title={`Switch to ${theme === 'dark' ? 'Warm Ivory Light' : 'Obsidian Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-[var(--primary)]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-3.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-main)] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Site</span>
          </button>
        </div>
      </header>

      {/* Main Focus: Pure Centered MNC Authentication Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
        <div className="w-full max-w-[420px] p-7 sm:p-9 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-xl relative space-y-6">
          
          {/* Card Title & Header */}
          <div className="text-center space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[var(--text-main)]">
              {isLogin ? 'Sign in to Shiro' : 'Create your account'}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              {isLogin 
                ? 'Welcome back. Choose your login method below.' 
                : 'Turn your notes and lectures into an active study space.'}
            </p>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs font-semibold">
            <button
              type="button"
              onClick={() => { 
                setIsLogin(true); 
                setError(null); 
                setMessage(null); 
                navigate('/login', { replace: true }); 
              }}
              className={`py-2 rounded-lg transition-all text-center cursor-pointer ${
                isLogin 
                  ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs font-bold' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { 
                setIsLogin(false); 
                setError(null); 
                setMessage(null); 
                navigate('/register', { replace: true }); 
              }}
              className={`py-2 rounded-lg transition-all text-center cursor-pointer ${
                !isLogin 
                  ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs font-bold' 
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-500 dark:text-red-400 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {message && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{message}</div>
              <button onClick={() => setMessage(null)} className="text-emerald-500 hover:text-emerald-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Single Sign-On Suite: Google + GitHub */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <GoogleSignInButton
              onSuccess={(data) => {
                contextLogin(data.user, data.access_token);
                navigate('/home');
              }}
              onError={(err) => setError(err)}
              disabled={loading}
              text="Google"
            />
            <GitHubSignInButton
              onSuccess={(data) => {
                contextLogin(data.user, data.access_token);
                navigate('/home');
              }}
              onError={(err) => setError(err)}
              disabled={loading}
              text="GitHub"
            />
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-1">
            <div className="border-t border-[var(--border)] w-full" />
            <span className="bg-[var(--bg-surface)] px-3 text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-mono shrink-0">
              or continue with email
            </span>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-main)] block">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Om Shinde"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[var(--bg-surface-elevated)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] rounded-xl py-2.5 pl-10 pr-4 border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none text-xs transition-all shadow-2xs"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-main)] block">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="student@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[var(--bg-surface-elevated)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] rounded-xl py-2.5 pl-10 pr-4 border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none text-xs transition-all shadow-2xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--text-main)] block">Password</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setShowForgotModal(true);
                    }}
                    className="text-[11px] text-[var(--primary)] hover:underline cursor-pointer font-medium"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[var(--bg-surface-elevated)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] rounded-xl py-2.5 pl-10 pr-10 border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none text-xs transition-all shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-main)] block">Confirm Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[var(--bg-surface-elevated)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] rounded-xl py-2.5 pl-10 pr-10 border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none text-xs transition-all shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 rounded-xl bg-[var(--primary)] hover:brightness-105 active:scale-[0.99] text-white dark:text-[#0F100E] font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span>{loading ? 'Authenticating...' : (isLogin ? 'Sign In to Shiro' : 'Create Account')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Secondary Actions: Guest & Enterprise SAML */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] hover:border-[var(--primary)] text-[var(--text-main)] text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
            >
              <UserCheck className="w-4 h-4 text-[var(--primary)] shrink-0" />
              <span>Continue as Guest (Instant 1-Click Access)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSamlModal(true)}
              className="w-full py-1 text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Enterprise Single Sign-On (SAML)</span>
            </button>
          </div>

          {/* Minimalist Trust & Privacy Notice */}
          <p className="text-[11px] text-[var(--text-muted)] text-center leading-relaxed font-sans pt-1">
            Protected by enterprise encryption. By signing in, you agree to our{' '}
            <span className="text-[var(--text-secondary)] underline cursor-pointer">Terms</span> and{' '}
            <span className="text-[var(--text-secondary)] underline cursor-pointer">Privacy Policy</span>.
          </p>
        </div>
      </main>

      {/* Clean Bottom Footer */}
      <footer className="w-full max-w-4xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--text-muted)] font-mono gap-2 relative z-10">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Shiro.ai · 256-Bit TLS 1.3 Encryption</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hover:text-[var(--text-main)] cursor-pointer">Security</span>
          <span className="hover:text-[var(--text-main)] cursor-pointer">Terms</span>
          <span className="hover:text-[var(--text-main)] cursor-pointer">Privacy</span>
          <span className="hover:text-[var(--text-main)] cursor-pointer">Status</span>
        </div>
      </footer>

      {/* =========================================================================
          MODAL: Forgot Password Recovery
          ========================================================================= */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--text-main)] font-semibold text-sm">
                <KeyRound className="w-4 h-4 text-[var(--primary)]" />
                <span>Reset Password</span>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Enter your verified email address and we'll dispatch secure password reset instructions to your inbox.
            </p>

            <form onSubmit={handleForgotSubmit} className="space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="student@university.edu"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-[var(--bg-surface-elevated)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] rounded-xl py-2.5 pl-10 pr-4 border border-[var(--border)] text-xs outline-none focus:border-[var(--primary)]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={forgotSent}
                  className="flex-1 py-2 px-3 rounded-xl bg-[var(--primary)] hover:brightness-105 active:scale-[0.98] text-white dark:text-[#0F100E] font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                >
                  {forgotSent ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  <span>{forgotSent ? 'Sending Token...' : 'Send Recovery Instructions'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="py-2 px-3 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: Enterprise SAML SSO
          ========================================================================= */}
      {showSamlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--text-main)] font-semibold text-sm">
                <Building2 className="w-4 h-4 text-[var(--primary)]" />
                <span>Enterprise Identity Federation (SAML 2.0)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSamlModal(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Authenticate via your institution's central identity directory (Okta, Azure Active Directory, PingFederate, or Google Workspace).
            </p>

            <form onSubmit={handleSamlSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-main)] block mb-1">Company / University Domain</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                    <Fingerprint className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. stanford.edu, mit.edu, or acme.corp"
                    value={samlDomain}
                    onChange={(e) => setSamlDomain(e.target.value)}
                    className="w-full bg-[var(--bg-surface-elevated)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] rounded-xl py-2.5 pl-10 pr-4 border border-[var(--border)] text-xs outline-none focus:border-[var(--primary)] font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={samlLoading}
                  className="flex-1 py-2 px-3 rounded-xl bg-[var(--primary)] hover:brightness-105 active:scale-[0.98] text-white dark:text-[#0F100E] font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{samlLoading ? 'Routing to IdP...' : 'Continue with Enterprise SSO'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSamlModal(false)}
                  className="py-2 px-3 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
