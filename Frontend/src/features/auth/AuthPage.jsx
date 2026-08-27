import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API_BASE_URL from '../../api/config.js';
import './LandingPage.css';

const AuthPage = () => {
  const { user, login: contextLogin } = useAuth();
  const navigate = useNavigate();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Only redirect if it's a real user (not guest)
    if (user) {
      navigate('/home');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!isLogin && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

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
    }
  };

  const handleGuestLogin = async () => {
    setError(null);
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
    }
  };


  return (
    <main className="min-h-screen flex flex-col relative bg-[#0a0a0a] font-body text-white w-full overflow-hidden">
      {/* ===== NAVBAR ===== */}
      <div className="landing-nav-wrapper">
        <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
          {/* Left: Logo */}
          <div className="landing-nav-logo" onClick={() => navigate('/')}>
            <div className="landing-logo-circle" style={{ overflow: 'hidden' }}>
              <img src="/logo.jpg" alt="Shiro.ai Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <span className="landing-logo-text">Shiro.ai</span>
          </div>

          {/* Center: Links in a pill */}
          <div className="landing-nav-center">
            <ul className="landing-nav-links">
              <li><a onClick={() => navigate('/')}>Home</a></li>
              <li><a onClick={() => navigate('/')}>Features</a></li>
              <li><a onClick={() => navigate('/')}>How it Works</a></li>
              <li><a onClick={() => navigate('/')}>FAQ</a></li>
            </ul>
          </div>

          {/* Right: Auth Button */}
          <div className="landing-nav-right">
            <button className="landing-auth-pill" onClick={() => navigate('/')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
              <span>Back to Site</span>
            </button>
          </div>
        </nav>
      </div>

      <div className="flex-1 flex items-center justify-center relative">
      
      {/* Background Diagram */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50 z-0 min-w-[1000px]">
        <svg width="1200" height="800" viewBox="0 0 1200 800" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Top Left Path */}
          <path d="M 120 150 L 300 150 L 350 200 L 350 350 L 450 450 L 500 450" stroke="#27272a" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Top Right Path */}
          <path d="M 1080 150 L 900 150 L 850 200 L 850 350 L 750 450 L 700 450" stroke="#27272a" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Bottom Left Path */}
          <path d="M 120 700 L 300 700 L 350 650 L 350 500 L 450 400 L 500 400" stroke="#27272a" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Bottom Right Path */}
          <path d="M 1080 700 L 900 700 L 850 650 L 850 500 L 750 400 L 700 400" stroke="#27272a" strokeWidth="1.5" strokeLinejoin="round" />
          
          {/* Top Left Node */}
          <rect x="40" y="126" width="80" height="48" rx="8" fill="#18181b" stroke="#27272a" strokeWidth="1" />
          <circle cx="56" cy="140" r="1.5" fill="#52525b" />
          <circle cx="56" cy="150" r="1.5" fill="#52525b" />
          <circle cx="56" cy="160" r="1.5" fill="#52525b" />
          <circle cx="120" cy="150" r="2.5" fill="#fff" />
          <circle cx="120" cy="150" r="6" fill="#fff" fillOpacity="0.2" />

          {/* Top Right Node */}
          <rect x="1080" y="126" width="80" height="48" rx="8" fill="#18181b" stroke="#27272a" strokeWidth="1" />
          <circle cx="1144" cy="140" r="1.5" fill="#52525b" />
          <circle cx="1144" cy="150" r="1.5" fill="#52525b" />
          <circle cx="1144" cy="160" r="1.5" fill="#52525b" />
          <circle cx="1080" cy="150" r="2.5" fill="#fff" />
          <circle cx="1080" cy="150" r="6" fill="#fff" fillOpacity="0.2" />

          {/* Bottom Left Node */}
          <rect x="40" y="676" width="80" height="48" rx="8" fill="#18181b" stroke="#27272a" strokeWidth="1" />
          <circle cx="56" cy="690" r="1.5" fill="#52525b" />
          <circle cx="56" cy="700" r="1.5" fill="#52525b" />
          <circle cx="56" cy="710" r="1.5" fill="#52525b" />
          <circle cx="120" cy="700" r="2.5" fill="#fff" />
          <circle cx="120" cy="700" r="6" fill="#fff" fillOpacity="0.2" />

          {/* Bottom Right Node */}
          <rect x="1080" y="676" width="80" height="48" rx="8" fill="#18181b" stroke="#27272a" strokeWidth="1" />
          <circle cx="1144" cy="690" r="1.5" fill="#52525b" />
          <circle cx="1144" cy="700" r="1.5" fill="#52525b" />
          <circle cx="1144" cy="710" r="1.5" fill="#52525b" />
          <circle cx="1080" cy="700" r="2.5" fill="#fff" />
          <circle cx="1080" cy="700" r="6" fill="#fff" fillOpacity="0.2" />
        </svg>
      </div>

      {/* Auth Card */}
      <div className="relative z-10 w-full max-w-[420px] p-8 rounded-2xl bg-[#18181b] shadow-2xl animate-in fade-in zoom-in-95 duration-500 border border-white/5">
        
        {/* Top Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[#202024] border border-white/5 shadow-inner flex items-center justify-center overflow-hidden">
            <img src="/logo.jpg" alt="Shiro.ai Logo" className="w-full h-full object-cover" />
          </div>
        </div>

        <h1 className="text-center text-2xl font-semibold mb-2 tracking-tight">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-center text-[#71717a] text-sm mb-8">
          {isLogin ? "Don't have an account yet?" : "Already have an account?"} <button type="button" onClick={() => { setIsLogin(!isLogin); setError(null); setMessage(null); }} className="text-[#e4e4e7] font-medium hover:underline ml-1">{isLogin ? 'Sign up' : 'Login'}</button>
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-400 p-3 rounded-lg text-sm mb-4 text-center">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 p-3 rounded-lg text-sm mb-4 text-center">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isLogin && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#52525b]">
                <span className="material-symbols-outlined text-[20px]">person</span>
              </div>
              <input 
                className="w-full bg-black text-white placeholder:text-[#52525b] rounded-xl py-3 pl-11 pr-4 border border-white/5 focus:border-[#3b82f6]/50 focus:ring-1 focus:ring-[#3b82f6]/50 transition-all outline-none text-sm" 
                placeholder="full name" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required 
              />
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#52525b]">
              <span className="material-symbols-outlined text-[18px]">mail</span>
            </div>
            <input 
              className="w-full bg-black text-white placeholder:text-[#52525b] rounded-xl py-3 pl-11 pr-4 border border-white/5 focus:border-[#3b82f6]/50 focus:ring-1 focus:ring-[#3b82f6]/50 transition-all outline-none text-sm" 
              type="email"
              placeholder="email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#52525b]">
              <span className="material-symbols-outlined text-[18px]">lock</span>
            </div>
            <input 
              className="w-full bg-black text-white placeholder:text-[#52525b] rounded-xl py-3 pl-11 pr-12 border border-white/5 focus:border-[#3b82f6]/50 focus:ring-1 focus:ring-[#3b82f6]/50 transition-all outline-none text-sm" 
              type={showPassword ? "text" : "password"}
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
            {password && (
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#52525b] hover:text-[#e4e4e7] transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            )}
          </div>

          {!isLogin && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#52525b]">
                <span className="material-symbols-outlined text-[18px]">lock</span>
              </div>
              <input 
                className="w-full bg-black text-white placeholder:text-[#52525b] rounded-xl py-3 pl-11 pr-12 border border-white/5 focus:border-[#3b82f6]/50 focus:ring-1 focus:ring-[#3b82f6]/50 transition-all outline-none text-sm" 
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm Password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required 
              />
              {confirmPassword && (
                <button 
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#52525b] hover:text-[#e4e4e7] transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              )}
            </div>
          )}

          <button className="w-full bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-medium py-3 rounded-xl mt-2 transition-colors shadow-lg shadow-[#0ea5e9]/20">
            {isLogin ? 'Login' : 'Sign up'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="h-[1px] flex-1 bg-white/5"></div>
          <span className="text-[10px] text-[#52525b] font-medium tracking-widest uppercase">OR</span>
          <div className="h-[1px] flex-1 bg-white/5"></div>
        </div>

        {/* Social Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="flex items-center justify-center py-2.5 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] transition-colors border border-white/5">
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          </button>
          <button type="button" className="flex items-center justify-center py-2.5 rounded-xl bg-[#27272a] hover:bg-[#3f3f46] transition-colors border border-white/5">
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] fill-[#e4e4e7]"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
          </button>
        </div>

        {/* Guest Access Button */}
        <button
          type="button"
          onClick={handleGuestLogin}
          className="w-full mt-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#a1a1aa] hover:text-white transition-all border border-white/5 text-xs font-semibold flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[16px] text-cyan-400">person_outline</span>
          Continue as Guest (Try without signing up)
        </button>

      </div>
      </div>
    </main>
  );
};

export default AuthPage;
