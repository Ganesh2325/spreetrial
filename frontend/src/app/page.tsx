'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, ArrowRight, User, Mail, Lock } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const nameVal = form.name.trim();
    const emailVal = form.email.toLowerCase().trim();
    const passVal = form.password;

    if (!nameVal || !emailVal || !passVal) {
      setError('All fields are required.');
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002')}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameVal, email: emailVal, password: passVal }),
      });
      const data = await res.json();

      if (res.ok && data.user) {
        router.push('/login');
      } else {
        setError(data.error || 'Registration failed.');
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
          <div className="mx-auto w-12 h-12 rounded-lg bg-green-950/40 border border-green-500/30 flex items-center justify-center font-extrabold text-xl text-green-400">
            S
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Spreetrail - Register </h1>
        </div>

        {/* Form Card */}
        <div className="glass-card p-8 bg-zinc-950/80">

          {error && (
            <div className="p-3 mb-4 text-xs font-semibold text-red-400 bg-red-950/20 border border-red-900/50 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-green-600 uppercase tracking-wider flex items-center gap-1">
                <User size={10} /> UserName
              </label>
              <input
                type="text"
                placeholder="Username"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="glass-input text-xs"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-green-600 uppercase tracking-wider flex items-center gap-1">
                <Mail size={10} /> Email Address
              </label>
              <input
                type="email"
                placeholder="Email Address"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
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
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="glass-input text-xs"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-xs flex justify-center items-center gap-1.5 mt-4"
            >
              {loading ? 'Processing...' : 'Register'}
            </button>
          </form>
        </div>

        <div className="text-center text-xs">
          <span className="text-zinc-500">Already registered? </span>
          <Link href="/login" className="text-green-500 hover:text-green-400 font-semibold underline underline-offset-4">
            Login
          </Link>
        </div>

      </div>
    </div>
  );
}
