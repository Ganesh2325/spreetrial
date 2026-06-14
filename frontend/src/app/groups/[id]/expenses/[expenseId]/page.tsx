'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Receipt,
  Loader2,
  Calendar,
  Users
} from 'lucide-react';

export default function ExpenseDetailsPage({ params }: { params: Promise<{ id: string, expenseId: string }> }) {
  const router = useRouter();
  const { id: groupId, expenseId } = use(params);

  const [expense, setExpense] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem('spreetrail_user_id');
    if (!userId) {
      router.push('/login');
      return;
    }
    fetchData(userId);
  }, [groupId, expenseId, router]);

  const fetchData = async (userId: string) => {
    setLoading(true);
    try {
      const headers = { 'x-user-id': userId };
      const groupRes = await fetch(`http://localhost:5002/api/groups/${groupId}`, { headers });
      if (groupRes.ok) {
        const groupData = await groupRes.json();
        setGroup(groupData.group);
      }
      
      const expRes = await fetch(`http://localhost:5002/api/groups/${groupId}/expenses`, { headers });
      if (expRes.ok) {
        const expData = await expRes.json();
        const found = (expData.expenses || []).find((e: any) => e.id === expenseId);
        setExpense(found);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-500 bg-black">
        <Loader2 className="animate-spin mr-2" size={24} /> Loading Expense Details...
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-zinc-500 bg-black">
        <Receipt size={48} className="mb-4 text-zinc-700" />
        <p>Expense not found or you do not have permission to view it.</p>
        <button 
          onClick={() => router.push(`/groups/${groupId}/expenses`)}
          className="mt-4 text-green-500 hover:text-green-400 font-bold"
        >
          Return to Expenses
        </button>
      </div>
    );
  }

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
            <Receipt className="text-green-500" /> Expense Details
          </h1>
          <p className="text-zinc-500 text-sm">Full breakdown of this transaction</p>
        </div>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Details Card */}
        <div className="md:col-span-2 glass-card p-8 bg-zinc-950/60 border border-green-900 rounded-2xl space-y-6">
          <div>
            <h2 className="text-3xl font-extrabold text-white mb-2">{expense.description}</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
              <span className="bg-zinc-900 px-3 py-1 rounded-lg text-zinc-300 font-medium">
                {expense.category}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={14} /> {new Date(expense.expenseDate).toLocaleDateString()}
              </span>
              <span className="bg-green-950/30 text-green-400 border border-green-900 px-3 py-1 rounded-lg font-mono font-bold">
                {expense.splitType} SPLIT
              </span>
            </div>
          </div>

          <div className="py-6 border-y border-green-950/50">
            <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2">Total Amount</p>
            <div className="text-5xl font-mono font-bold text-white">
              {expense.originalAmount.toFixed(2)} <span className="text-2xl text-green-500">{expense.originalCurrency}</span>
            </div>
            {expense.originalCurrency !== group.currencyCode && (
              <p className="text-xs text-zinc-500 mt-2">
                Converted to Base ({group.currencyCode}): {expense.baseAmount.toFixed(2)}
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">Paid By</p>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-black border border-green-950">
              <div className="w-12 h-12 rounded-lg bg-green-900/40 border border-green-900 flex items-center justify-center font-bold text-green-400 text-lg">
                {expense.payer?.user?.name?.charAt(0) || '?'}
              </div>
              <div>
                <h4 className="font-bold text-white text-lg">{expense.payer?.user?.name || 'Unknown'}</h4>
                <p className="text-xs text-zinc-500">{expense.payer?.user?.email || ''}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Participants Sidebar */}
        <div className="glass-card p-6 bg-zinc-950/60 border border-green-900 rounded-2xl">
          <h3 className="font-bold text-lg text-white mb-6 flex items-center gap-2">
            <Users className="text-green-500" size={20} /> Split Between
          </h3>
          <div className="space-y-4">
            {expense.participants?.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-4 pb-4 border-b border-green-950/50 last:border-0 last:pb-0">
                <div className="flex items-center gap-3 truncate">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
                    {p.member?.user?.name?.charAt(0) || '?'}
                  </div>
                  <span className="text-sm text-zinc-300 font-medium truncate">
                    {p.member?.user?.name || 'Unknown'}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-white font-mono">
                    {p.splitValue ? `${p.splitValue.toFixed(2)}` : 'Equal'}
                  </div>
                  {expense.splitType === 'PERCENTAGE' && p.splitValue && (
                    <div className="text-xs text-zinc-500">{p.splitValue}%</div>
                  )}
                  {expense.splitType !== 'PERCENTAGE' && (
                    <div className="text-xs text-zinc-500">{expense.originalCurrency}</div>
                  )}
                </div>
              </div>
            ))}
            {(!expense.participants || expense.participants.length === 0) && (
              <div className="text-zinc-500 text-sm text-center">No participants specified.</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
