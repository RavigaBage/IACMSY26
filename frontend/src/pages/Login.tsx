'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { api, setAccessToken } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
const HERO_PATTERN = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Cg fill='none' stroke='%23FFFFFF' stroke-width='1.5' opacity='0.5'%3E%3Ccircle cx='70' cy='70' r='46'/%3E%3Ccircle cx='70' cy='70' r='30'/%3E%3Cpath d='M70 24a46 46 0 0 1 46 46'/%3E%3Cpath d='M24 70a46 46 0 0 1 46-46'/%3E%3Ccircle cx='0' cy='0' r='18'/%3E%3Ccircle cx='140' cy='0' r='18'/%3E%3Ccircle cx='0' cy='140' r='18'/%3E%3Ccircle cx='140' cy='140' r='18'/%3E%3C/g%3E%3C/svg%3E`;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fillDemoAdmin = () => {
    setIdentifier('admin@iac.com');
    setPassword('Admin@1234');
    setError('');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Please enter your email or phone number.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.post('/api/auth/login', { identifier: cleanId, password });
      if (res?.status === 'success' && res?.access) {
        setAccessToken(res.access);
        await checkAuth();
        navigate(from, { replace: true });
        return;
      }
      if (res?.status !== 'success') {
        throw new Error(res?.message || res?.error || 'Invalid email/phone or password.');
      }
    } catch (err: any) {
      const rawMsg = err?.message || 'Something went wrong. Please try again.';
      if (rawMsg === 'Bad Request' || rawMsg.includes('400')) {
        setError('Invalid email/phone or password. Please try again.');
      } else if (rawMsg.includes('<body') || rawMsg.includes('<!DOCTYPE') || rawMsg.includes('Unexpected token') || rawMsg.includes('SyntaxError')) {
        setError('Unable to authenticate with the server. Please verify your credentials or try again later.');
      } else {
        setError(rawMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, from]);

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white">
      <div className="relative hidden md:flex md:w-1/2 lg:w-3/5 flex-col justify-end overflow-hidden bg-gradient-to-b from-amber-50 via-amber-700 to-stone-900">
        <div
          className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: `url("${HERO_PATTERN}")`, backgroundSize: '140px 140px' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900/70 via-transparent to-transparent" />

        <div className="relative z-10 px-12 pb-16 max-w-xl">
          <span className="inline-block bg-white/10 backdrop-blur-sm text-white/80 text-xs font-semibold tracking-[0.2em] uppercase px-3 py-1.5 rounded-sm mb-6">
            Gateway to Digital Access
          </span>
          <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Everything the Lounge
            <br />
            Runs On, In One Place.
          </h1>
          <p className="text-white/80 text-base leading-relaxed">
            Manage room bookings, connected devices, attendance, and reports
            for the Internet Access Center — all from a single dashboard.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-xs">
              IAC
            </div>
            <div>
              <p className="font-bold text-stone-900 leading-tight">IAC Admin Portal</p>
              <p className="text-xs text-stone-500 leading-tight">Internet Access Center</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-stone-900 mb-1">Sign in to your account</h2>
          <p className="text-sm text-stone-500 mb-8">
            Access room bookings, device controls, attendance, and reports.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="identifier" className="block text-sm font-semibold text-stone-800 mb-1.5">
                Email or Phone <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Email or 10-digit phone number"
                  className="w-full rounded-lg border border-stone-300 pl-10 pr-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-stone-800 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-stone-300 pl-10 pr-10 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-end">
              <a href="/forgot-password" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
                Forgot Password?
              </a>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 text-sm transition-colors cursor-pointer ${isSubmitting ? 'animate-pulse' : ''}`}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Quick Demo Access */}
          <div className="mt-4 p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-amber-900 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                Demo Administrator
              </p>
              <p className="text-amber-700 text-[11px]">admin@iac.com • Admin@1234</p>
            </div>
            <button
              type="button"
              onClick={fillDemoAdmin}
              className="px-2.5 py-1.5 font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer text-xs"
            >
              Auto-fill ⚡
            </button>
          </div>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-stone-200" />
            <span className="text-xs text-stone-400">or</span>
            <div className="h-px flex-1 bg-stone-200" />
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm text-stone-500">Don&apos;t have access yet?</p>
            <a href="/" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
              Go To Portal Homepage
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}