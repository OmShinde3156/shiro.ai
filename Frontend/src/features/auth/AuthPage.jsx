import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import API_BASE_URL from '../../api/config.js';
import KnowledgeMesh from '../../components/ui/KnowledgeMesh';
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
  Sparkles, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-react';

const AuthPage = ({ initialMode }) => {
  const { user, login: contextLogin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (user && token) {
      navigate('/home', { replace: true });
    }
  }, [user, navigate]);

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
        headers: { 'Content-Type': 'application/json' },
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

  const handleGuestLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Guest session failed');
      }
      const data = await response.json();
      contextLogin(data.user, data.access_token);
      navigate('/home');
    } catch (err) {
      // Direct guest fallback
      contextLogin({ id: 1, name: "Guest User", email: "guest@study.ai" }, "guest");
      navigate('/home');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen min-h-[100dvh] flex flex-col justify-between relative bg-[var(--bg-canvas)] text-[var(--text-main)] overflow-hidden font-body transition-colors duration-300">
      {/* Ambient Knowledge Graph Background */}
      <KnowledgeMesh className="opacity-30 pointer-events-none" />

      {/* Top Navigation Bar */}
      <header className="w-full max-w-5xl mx-auto px-6 py-5 flex items-center justify-between relative z-20">
        {/* Brand Logo */}
        <div 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="w-9 h-9 rounded-2xl overflow-hidden border border-[var(--border)] shadow-xs flex items-center justify-center bg-[var(--bg-surface)]">
            <img src="/logo.jpg" alt="Shiro Logo" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          </div>
          <span className="font-serif font-bold text-xl tracking-tight text-[var(--text-main)]">
            Shiro<span className="text-[var(--primary)] font-sans">.ai</span>
          </span>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer shadow-2xs"
            aria-label="Toggle Theme"
            title={`Switch to ${theme === 'dark' ? 'Warm Ivory Light' : 'Obsidian Dark'} Mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-[#F59E0B]" />
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
            <span>Back to Site</span>
          </button>
        </div>
      </header>

      {/* Center Auth Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 relative z-10">
        <div className="w-full max-w-[430px] p-7 sm:p-9 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-xl relative space-y-6">
          
          {/* Header */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--primary-subtle)] text-[var(--primary)] border border-[var(--primary)]/20 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Grounded Academic Workspace</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[var(--text-main)] tracking-tight">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              {isLogin ? 'Sign in to access your notes, quizzes, and spaced review.' : 'Turn your lecture slides and notes into an active study space.'}
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
              Register
            </button>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-500 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{message}</span>
            </div>
          )}

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
                    className="w-full bg-[var(--bg-surface-elevated)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] rounded-xl py-2.5 pl-10 pr-4 border border-[var(--border)] focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] outline-none text-xs transition-all"
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
                  className="w-full bg-[var(--bg-surface-elevated)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] rounded-xl py-2.5 pl-10 pr-4 border border-[var(--border)] focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] outline-none text-xs transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-main)] block">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[var(--bg-surface-elevated)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] rounded-xl py-2.5 pl-10 pr-10 border border-[var(--border)] focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] outline-none text-xs transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
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
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[var(--bg-surface-elevated)] text-[var(--text-main)] placeholder:text-[var(--text-muted)] rounded-xl py-2.5 pl-10 pr-10 border border-[var(--border)] focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] outline-none text-xs transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 rounded-xl bg-[var(--primary)] hover:brightness-105 active:scale-[0.99] text-white dark:text-[#0F100E] font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span>{loading ? 'Processing...' : (isLogin ? 'Sign In to Shiro' : 'Create Student Account')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Alternative Exploration Divider */}
          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-[var(--border)] w-full"></div>
            <span className="bg-[var(--bg-surface)] px-3 text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-mono shrink-0">
              or explore freely
            </span>
          </div>

          {/* Guest Access Button */}
          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] hover:border-[var(--primary)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-main)] text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <UserCheck className="w-4 h-4 text-[var(--primary)] shrink-0" />
            <span>Continue as Guest (No sign up needed)</span>
          </button>

        </div>
      </div>

      {/* Minimal Footer */}
      <footer className="w-full max-w-5xl mx-auto px-6 py-4 text-center text-xs text-[var(--text-muted)] font-mono relative z-20">
        Shiro.ai · Grounded Academic Learning OS · Oxford Editorial Sanctuary
      </footer>
    </main>
  );
};

export default AuthPage;
