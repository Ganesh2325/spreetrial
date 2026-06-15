'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  List, 
  Plus, 
  Receipt,
  Loader2,
  Calendar,
  ChevronRight
} from 'lucide-react';

export default function ExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: groupId } = use(params);

  const [expenses, setExpenses] = useState<any[]>([]);
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = localStorage.getItem('spreetrail_user_id');
    if (!userId) {
      router.push('/login');
      return;
    }
    fetchData(userId);
  }, [groupId, router]);

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
        setExpenses(expData.expenses || []);
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
        <Loader2 className="animate-spin mr-2" size={24} /> Loading Expenses...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-5xl mx-auto">
      {/* Header */}
      <nav className="flex justify-between items-center mb-8 pb-4 border-b border-green-950">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push(`/groups/${groupId}`)}
            className="p-2 rounded-lg bg-zinc-950 border border-green-950 text-zinc-400 hover:text-green-400 transition-all cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
              <List className="text-green-500" /> Expenses Ledger
            </h1>
            <p className="text-zinc-500 text-sm">All shared transactions for {group.name}</p>
          </div>
        </div>
        <button
          onClick={() => router.push(`/groups/${groupId}/expenses/create`)}
          className="bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Plus size={16} /> Add Expense
        </button>
      </nav>

      {/* Expenses List */}
      <div className="space-y-4">
        {expenses.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 glass-card bg-zinc-950/40 border-green-900 rounded-2xl">
            <Receipt className="mx-auto mb-4 text-zinc-700" size={48} />
            <p>No expenses recorded yet.</p>
          </div>
        ) : (
          expenses.map((exp: any) => (
            <div 
              key={exp.id} 
              onClick={() => router.push(`/groups/${groupId}/expenses/${exp.id}`)}
              className="p-6 bg-zinc-950/60 border border-green-900 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-green-500 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-950/40 flex items-center justify-center border border-green-900">
                  <Receipt className="text-green-500" size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-white group-hover:text-green-400 transition-colors">
                    {exp.description}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                    <span className="bg-zinc-900 px-2 py-0.5 rounded text-zinc-300 font-medium">
                      {exp.category}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(exp.expenseDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-lg font-bold text-white font-mono">
                    {exp.originalAmount.toFixed(2)} {exp.originalCurrency}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Paid by <span className="text-zinc-300 font-semibold">{exp.payer?.name || exp.payer?.user?.name || 'Unknown'}</span>
                    {' • '}
                    <span className="text-zinc-400 font-medium">{exp.participants?.[0]?.splitType || 'EQUAL'} split</span>
                  </div>
                </div>
                <ChevronRight className="text-zinc-700 group-hover:text-green-500 transition-colors" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
