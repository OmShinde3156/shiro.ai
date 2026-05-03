import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API_BASE_URL from '../../api/config.js';

const AuthPage = () => {
  const { user, login: contextLogin } = useAuth();
  const navigate = useNavigate();
  
  const [isLogin, setIsLogin] = useState(true);
  const [isOtpMode, setIsOtpMode] = useState(false);
  const [step, setStep] = useState(1); // 1: Email, 2: OTP
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to send OTP');
      }
      setStep(2);
      setMessage("OTP sent to your email!");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      if (!response.ok) throw new Error('Invalid or expired OTP');
      const userData = await response.json();
      contextLogin(userData);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
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
      const userData = await response.json();
      contextLogin(userData);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="flex-1 min-h-screen flex items-center justify-center p-4 md:p-8 relative overflow-hidden bg-[#0b0e14]">
      {/* Atmospheric Background Depth */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-[#72dcff]/10 blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#dd8bfb]/10 blur-[100px]"></div>
      </div>

      {/* Auth Container */}
      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white/5 backdrop-blur-3xl rounded-[2.5rem] p-8 md:p-10 shadow-[0_32px_64px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col gap-8">
          
          {/* Header */}
          <div className="text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20 mb-2 rotate-12">
              <span className="material-symbols-outlined text-4xl text-white fill">bubble_chart</span>
            </div>
            <div>
              <h1 className="font-headline font-black text-3xl tracking-tight text-white">SHIRO.AI</h1>
              <p className="text-white/90 mt-2 text-sm font-semibold">
                {isOtpMode ? 'OTP Verification' : isLogin ? 'Welcome Back' : 'Create Your Account'}
              </p>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-100 p-4 rounded-2xl text-xs font-bold text-center animate-shake">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-100 p-4 rounded-2xl text-xs font-bold text-center">
              {message}
            </div>
          )}

          <form onSubmit={isOtpMode ? (step === 1 ? handleRequestOtp : handleVerifyOtp) : handleSubmit} className="flex flex-col gap-5">
            {!isLogin && !isOtpMode && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-white/80 ml-1">Your Full Name</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40 group-focus-within:text-primary transition-colors">
                    <span className="material-symbols-outlined text-[20px]">person</span>
                  </div>
                  <input 
                    className="w-full bg-black/40 text-white placeholder:text-white/30 rounded-2xl py-3.5 pl-11 pr-4 border border-white/10 focus:border-primary transition-all outline-none text-sm" 
                    placeholder="e.g. John Doe" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required 
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-white/80 ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40 group-focus-within:text-primary transition-colors">
                  <span className="material-symbols-outlined text-[20px]">mail</span>
                </div>
                <input 
                  className="w-full bg-black/40 text-white placeholder:text-white/30 rounded-2xl py-3.5 pl-11 pr-4 border border-white/10 focus:border-primary transition-all outline-none text-sm" 
                  type="email"
                  placeholder="name@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>

            {!isOtpMode ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/80">Password</label>
                  {isLogin && <button type="button" onClick={() => setIsOtpMode(true)} className="text-[10px] font-bold text-secondary-container bg-secondary/10 px-2 py-0.5 rounded uppercase hover:bg-secondary/20 transition-colors">Login with OTP</button>}
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/40 group-focus-within:text-primary transition-colors">
                    <span className="material-symbols-outlined text-[20px]">lock</span>
                  </div>
                  <input 
                    className="w-full bg-black/40 text-white placeholder:text-white/30 rounded-2xl py-3.5 pl-11 pr-12 border border-white/10 focus:border-primary transition-all outline-none text-sm" 
                    type={showPassword ? "text" : "password"}
                    placeholder="Your secret password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
            ) : step === 2 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-secondary ml-1">Enter 6-Digit Code</label>
                <input 
                  className="w-full bg-black/40 text-white text-center tracking-[1em] font-black rounded-2xl py-4 border border-secondary/50 focus:border-secondary transition-all outline-none text-lg" 
                  placeholder="000000"
                  maxLength="6"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required 
                />
              </div>
            )}

            <button className="mt-4 w-full bg-gradient-to-br from-primary to-primary-container text-on-primary font-headline font-bold text-sm tracking-widest py-4 rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden group">
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isOtpMode ? (step === 1 ? 'SEND CODE' : 'VERIFY & LOG IN') : (isLogin ? 'LOG IN' : 'CREATE ACCOUNT')}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
            </button>
          </form>

          <div className="text-center pt-6 border-t border-white/10">
            <p className="text-sm text-white/80 font-medium">
              {isLogin || isOtpMode ? "Don't have an account?" : "Already have an account?"} 
              <button 
                onClick={() => { setIsLogin(!isLogin); setIsOtpMode(false); setStep(1); setError(null); setMessage(null); }}
                className="ml-2 text-secondary font-bold hover:text-primary transition-colors underline decoration-secondary/30 underline-offset-4"
                type="button"
              >
                {isLogin || isOtpMode ? 'Sign Up' : 'Log In'}
              </button>
            </p>
            {isOtpMode && (
              <button 
                onClick={() => { setIsOtpMode(false); setStep(1); }}
                className="mt-4 text-[10px] font-bold text-white/40 uppercase hover:text-white block w-full"
              >
                Back to Password Login
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default AuthPage;
