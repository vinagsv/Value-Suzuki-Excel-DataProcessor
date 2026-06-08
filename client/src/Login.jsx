import React, { useState, useEffect } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL;

const Login = ({ onLogin, initialError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Generate a dynamic name for the password field to heavily discourage 
  // password managers from recognizing and saving/autofilling it.
  const [pwdFieldName] = useState(() => `pwd_${Math.random().toString(36).substring(2, 8)}`);

  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include', 
      });

      const data = await res.json();

      if (res.ok) {
        sessionStorage.setItem("userEmail", email);
        onLogin(data.role, data.email);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-gradient-to-br from-blue-50 via-white to-purple-100 flex items-center justify-center p-4">
      <div className="bg-white/40 backdrop-blur-xl border border-white/40 p-10 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] w-full max-w-md">
        
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/10 rounded-2xl mb-4">
            <ShieldCheck className="text-blue-600" size={32} />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">Value Suzuki</h1>
          <p className="text-gray-500 mt-2 font-medium">Secure Access</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl mb-6 text-sm text-center font-medium flex items-center justify-center gap-2">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
          
          {/* FAKE inputs to trick aggressive password managers into autofilling here instead */}
          <input type="text" style={{ display: 'none' }} autoComplete="username" />
          <input type="password" style={{ display: 'none' }} autoComplete="current-password" />

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-600 ml-1 uppercase tracking-wider">Email</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                className="w-full bg-white/60 border border-gray-200 rounded-2xl py-3.5 pl-12 pr-4 text-gray-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
                placeholder="user@domain.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-600 ml-1 uppercase tracking-wider">Password</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input
                name={pwdFieldName}
                id={pwdFieldName}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                
                // Aggressive Anti-paste and Anti-autofill
                onPaste={(e) => e.preventDefault()}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                onDrag={(e) => e.preventDefault()}
                autoComplete="new-password"
                
                className="w-full bg-white/60 border border-gray-200 rounded-2xl py-3.5 pl-12 pr-4 text-gray-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm select-none"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 rounded-2xl shadow-lg transform transition active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><span>Sign In</span><ArrowRight size={20} /></>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;