import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API_BASE_URL from '../../api/config.js';
import './authpage.css';

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

  useEffect(() => {
    if (user) {
      navigate('/');
    }
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

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Invalid or expired OTP');
      }

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

    if (isLogin) {
      try {
        const response = await fetch(`${API_BASE_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Login failed');
        }

        const userData = await response.json();
        contextLogin(userData);
        navigate('/');
      } catch (err) {
        setError(err.message);
      }
    } else {
      try {
        const response = await fetch(`${API_BASE_URL}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, preferred_language: 'en' }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Sign up failed');
        }

        const newUser = await response.json();
        contextLogin(newUser);
        navigate('/');
      } catch (err) {
        setError(err.message);
      }
    }
  };

  if (isOtpMode) {
    return (
      <div className="auth-container">
        <div className="auth-form">
          <h2>Login with OTP</h2>
          {error && <p className="error-message">{error}</p>}
          {message && <p className="success-message" style={{color: '#daae51'}}>{message}</p>}
          
          {step === 1 ? (
            <form onSubmit={handleRequestOtp}>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  required
                />
              </div>
              <button type="submit">Send OTP</button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <div className="form-group">
                <label>Enter 6-Digit OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="000000"
                  maxLength="6"
                  required
                  style={{letterSpacing: '5px', textAlign: 'center', fontSize: '20px'}}
                />
              </div>
              <button type="submit">Verify & Login</button>
              <button type="button" className="toggle-btn" onClick={() => setStep(1)} style={{marginTop: '10px'}}>
                Back to Email
              </button>
            </form>
          )}
          
          <p>
            <button className="toggle-btn" onClick={() => { setIsOtpMode(false); setStep(1); }}>
              Back to Password Login
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit">{isLogin ? 'Login' : 'Sign Up'}</button>
        </form>
        
        {isLogin && (
          <p>
            <button className="toggle-btn" onClick={() => setIsOtpMode(true)} style={{color: '#daae51', fontWeight: 'bold'}}>
              Forgot Password / Login with OTP
            </button>
          </p>
        )}

        <p>
          {isLogin ? "Don't have an account?" : 'Already have an account?'}
          <button className="toggle-btn" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
