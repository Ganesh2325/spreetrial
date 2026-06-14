'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogIn, ArrowRight, Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailVal = email.toLowerCase().trim();
    const passVal = password;

    if (!emailVal || !passVal) {
      setError('Email and password are required.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailVal)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (passVal.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:5002/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal, password: passVal }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        localStorage.setItem('spreetrail_user_id', data.user.id);
        localStorage.setItem('spreetrail_user_name', data.user.name);
        localStorage.setItem('spreetrail_user_email', data.user.email);
        router.push('/dashboard');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      console.error(err);
      setError('Could not connect to backend server. Make sure it is running on port 5001.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">

        {/* Logo Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-lg bg-green-955 border border-green-500/30 flex items-center justify-center font-black text-xl text-green-400">
            S
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Spreetrail - Login </h1>
        </div>

        {/* Login Form Card */}
        <div className="glass-card p-8 bg-zinc-950/80 space-y-6">

          {error && (
            <div className="p-3 text-xs font-semibold text-red-400 bg-red-950/20 border border-red-900/50 rounded-lg">
              {error}
            </div>
          )}

          {/* Manual input */}
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-green-600 uppercase tracking-wider flex items-center gap-1">
                <Mail size={10} /> Email Address
              </label>
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="glass-input text-xs"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-green-600 uppercase tracking-wider flex items-center gap-1">
                <Lock size={10} /> Password
              </label>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input text-xs"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-xs font-semibold py-2.5 mt-2 flex justify-center items-center gap-1"
            >
              {loading ? 'Signing In...' : 'Sign In'} <ArrowRight size={12} />
            </button>
          </form>
        </div>

        {/* Back navigation */}
        <div className="text-center text-xs">
          <span className="text-zinc-500">Need to create an account? </span>
          <Link href="/" className="text-green-500 hover:text-green-400 font-semibold underline underline-offset-4">
            Register Here
          </Link>
        </div>

      </div>
    </div>
  );
}
