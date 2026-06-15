'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, ArrowLeft, Loader2, Info, CheckCircle2 } from 'lucide-react';

export default function CreateGroupPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currencyCode, setCurrencyCode] = useState('INR');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const userId = localStorage.getItem('spreetrail_user_id');
    const userName = localStorage.getItem('spreetrail_user_name');
    if (!userId || !userName) {
      router.push('/login');
    } else {
      setCurrentUser({ id: userId, name: userName });
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Group name is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002')}/api/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({ name, description, currencyCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create group');
      }

      router.push(`/groups/${data.group.id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-4xl mx-auto">
      {/* Header */}
      <nav className="flex items-center gap-4 mb-8 pb-4 border-b border-green-950">
        <button 
          onClick={() => router.push('/dashboard')}
          className="p-2 rounded-lg bg-zinc-950 border border-green-950 text-zinc-400 hover:text-green-400 hover:border-green-500/50 transition-all cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Layers className="text-green-500" /> Create New Group
          </h1>
          <p className="text-zinc-500 text-sm">Set up a shared workspace for expenses</p>
        </div>
      </nav>

      {/* Form */}
      <div className="glass-card p-8 bg-zinc-950/60 border border-green-900 rounded-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {error && (
            <div className="bg-red-950/50 border border-red-900 text-red-400 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
              <Info size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-semibold text-zinc-300">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black border border-green-950 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-green-500 transition-colors"
              placeholder="e.g., Goa Trip, Apartment 404"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-zinc-300">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-black border border-green-950 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-green-500 transition-colors min-h-[100px]"
              placeholder="What is this group for?"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-zinc-300">Base Currency</label>
            <select
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              className="w-full bg-black border border-green-950 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors cursor-pointer appearance-none"
            >
              <option value="INR">INR (₹) - Indian Rupee</option>
              <option value="USD">USD ($) - US Dollar</option>
              <option value="EUR">EUR (€) - Euro</option>
            </select>
          </div>

          <div className="pt-4 border-t border-green-950/50">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
