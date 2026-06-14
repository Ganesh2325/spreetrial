'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Receipt, 
  CheckCircle2, 
  Loader2,
  Info
} from 'lucide-react';

export default function CreateExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: groupId } = use(params);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    currency: 'INR',
    payerId: '',
    expenseDate: new Date().toISOString().split('T')[0],
    category: 'General',
    splitType: 'EQUAL' as 'EQUAL' | 'PERCENTAGE' | 'FIXED' | 'CUSTOM',
  });

  const [splitParticipants, setSplitParticipants] = useState<Record<string, number>>({});

  useEffect(() => {
    const userId = localStorage.getItem('spreetrail_user_id');
    if (!userId) {
      router.push('/login');
      return;
    }
    setCurrentUser({ id: userId });
    setNewExpense((prev) => ({ ...prev, payerId: userId }));
    fetchGroupData(userId);
  }, [groupId, router]);

  const fetchGroupData = async (userId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5002/api/groups/${groupId}`, {
        headers: { 'x-user-id': userId }
      });
      if (res.ok) {
        const data = await res.json();
        setGroup(data.group);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.description || !newExpense.amount) {
      setError('Description and Amount are required.');
      return;
    }

    const activeMemberIds = group.members
      .filter((m: any) => {
        const d = new Date(newExpense.expenseDate);
        const join = new Date(m.joinedAt);
        const left = m.leftAt ? new Date(m.leftAt) : new Date('2099-01-01');
        return d >= join && d <= left;
      })
      .map((m: any) => m.userId);

    if (activeMemberIds.length === 0) {
      setError('No active members on this date.');
      return;
    }

    let finalSplits: { userId: string; splitValue: number | null }[] = [];

    if (newExpense.splitType === 'EQUAL') {
      finalSplits = activeMemberIds.map((id: string) => ({ userId: id, splitValue: null }));
    } else {
      let sum = 0;
      finalSplits = Object.entries(splitParticipants).map(([id, val]) => {
        sum += val;
        return { userId: id, splitValue: val };
      });

      if (newExpense.splitType === 'PERCENTAGE' && Math.abs(sum - 100) > 0.1) {
        setError(`Percentages must sum to 100 (Current: ${sum})`);
        return;
      }
      if ((newExpense.splitType === 'FIXED' || newExpense.splitType === 'CUSTOM') && Math.abs(sum - parseFloat(newExpense.amount)) > 0.01) {
        setError(`Fixed amounts must sum to total amount ${newExpense.amount} (Current: ${sum})`);
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        ...newExpense,
        amount: parseFloat(newExpense.amount),
        participants: finalSplits,
      };

      const res = await fetch(`http://localhost:5002/api/groups/${groupId}/expenses`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || ''
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create expense');
      }

      router.push(`/groups/${groupId}/expenses`);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-500 bg-black">
        <Loader2 className="animate-spin mr-2" size={24} /> Loading Form...
      </div>
    );
  }

  const validMembers = group.members.filter((m: any) => {
    const d = new Date(newExpense.expenseDate);
    const join = new Date(m.joinedAt);
    const left = m.leftAt ? new Date(m.leftAt) : new Date('2099-01-01');
    return d >= join && d <= left;
  });

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-4xl mx-auto">
      {/* Header */}
      <nav className="flex items-center gap-4 mb-8 pb-4 border-b border-green-950">
        <button 
          onClick={() => router.push(`/groups/${groupId}/expenses`)}
          className="p-2 rounded-lg bg-zinc-950 border border-green-950 text-zinc-400 hover:text-green-400 transition-all cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Receipt className="text-green-500" /> Record Expense
          </h1>
          <p className="text-zinc-500 text-sm">Add a new shared expense to the ledger</p>
        </div>
      </nav>

      <form onSubmit={handleAddExpenseSubmit} className="glass-card p-8 bg-zinc-950/60 border border-green-900 rounded-2xl space-y-6">
        
        {error && (
          <div className="bg-red-950/50 border border-red-900 text-red-400 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
            <Info size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-zinc-300">Description</label>
            <input
              type="text"
              required
              value={newExpense.description}
              onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
              className="w-full bg-black border border-green-950 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-green-500 transition-colors"
              placeholder="e.g., Grocery, Rent"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-zinc-300">Amount</label>
            <div className="flex">
              <select
                value={newExpense.currency}
                onChange={(e) => setNewExpense({ ...newExpense, currency: e.target.value })}
                className="bg-zinc-900 border border-green-950 rounded-l-xl px-3 text-white focus:outline-none focus:border-green-500"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
              <input
                type="number"
                step="0.01"
                required
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                className="w-full bg-black border-y border-r border-green-950 rounded-r-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-green-500 transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-zinc-300">Paid By</label>
            <select
              value={newExpense.payerId}
              onChange={(e) => setNewExpense({ ...newExpense, payerId: e.target.value })}
              className="w-full bg-black border border-green-950 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
            >
              {group.members?.map((m: any) => (
                <option key={m.userId} value={m.userId}>{m.user.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-zinc-300">Date</label>
            <input
              type="date"
              required
              value={newExpense.expenseDate}
              onChange={(e) => setNewExpense({ ...newExpense, expenseDate: e.target.value })}
              className="w-full bg-black border border-green-950 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
            />
          </div>
        </div>

        <div className="space-y-4 pt-6 border-t border-green-950/50">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-zinc-300 flex items-center justify-between">
              Split Type
              <span className="text-xs text-zinc-500 font-normal">Active Members Only</span>
            </label>
            <select
              value={newExpense.splitType}
              onChange={(e) => setNewExpense({ ...newExpense, splitType: e.target.value as any })}
              className="w-full bg-black border border-green-950 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
            >
              <option value="EQUAL">EQUAL (Split equally among active members)</option>
              <option value="PERCENTAGE">PERCENTAGE (Specify % for each member)</option>
              <option value="FIXED">FIXED (Specify exact amount for each member)</option>
              <option value="CUSTOM">CUSTOM (Complex custom splits)</option>
            </select>
          </div>

          {newExpense.splitType !== 'EQUAL' && (
            <div className="bg-black/50 border border-green-950 p-4 rounded-xl space-y-3">
              {validMembers.map((m: any) => (
                <div key={m.userId} className="flex justify-between items-center gap-4">
                  <span className="text-sm text-zinc-300 font-medium w-32 truncate">{m.user.name}</span>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full bg-black border border-green-950 rounded-lg px-3 py-2 text-white focus:border-green-500 outline-none text-sm font-mono"
                    placeholder={newExpense.splitType === 'PERCENTAGE' ? '%' : 'Amount'}
                    value={splitParticipants[m.userId] || ''}
                    onChange={(e) => setSplitParticipants(prev => ({
                      ...prev,
                      [m.userId]: parseFloat(e.target.value) || 0
                    }))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-green-950/50">
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            {submitting ? 'Recording...' : 'Record Expense'}
          </button>
        </div>
      </form>
    </div>
  );
}
