'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  ArrowLeft, 
  DollarSign, 
  Upload, 
  FileText, 
  Activity, 
  LogOut,
  Layers,
  Loader2,
  TrendingUp,
  Receipt,
  List
} from 'lucide-react';

export default function GroupDetails({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: groupId } = use(params);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<any[]>([]);
  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [expenseCount, setExpenseCount] = useState<number>(0);

  useEffect(() => {
    const userId = localStorage.getItem('spreetrail_user_id');
    const name = localStorage.getItem('spreetrail_user_name');
    const email = localStorage.getItem('spreetrail_user_email');

    if (!userId || !name || !email) {
      router.push('/login');
      return;
    }
    setCurrentUser({ id: userId, name, email });
    fetchGroupData(userId);
  }, [groupId, router]);

  const fetchGroupData = async (userId: string) => {
    setLoading(true);
    try {
      const headers = { 'x-user-id': userId };
      const groupRes = await fetch(`http://localhost:5002/api/groups/${groupId}`, { headers });
      if (!groupRes.ok) {
        router.push('/dashboard');
        return;
      }
      const groupData = await groupRes.json();
      setGroup(groupData.group);

      const balRes = await fetch(`http://localhost:5002/api/groups/${groupId}/balances`, { headers });
      const balData = await balRes.json();
      setBalances(balData.balances || []);

      const expRes = await fetch(`http://localhost:5002/api/groups/${groupId}/expenses`, { headers });
      if (expRes.ok) {
        const expData = await expRes.json();
        const exps = expData.expenses || [];
        setExpenseCount(exps.length);
        const total = exps.reduce((acc: number, curr: any) => acc + (curr.convertedAmount || curr.originalAmount || 0), 0);
        setTotalSpent(total);
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
        <Loader2 className="animate-spin mr-2" size={24} /> Loading Group Details...
      </div>
    );
  }

  const activeMembers = group.members?.filter((m: any) => m.active) || [];

  // Calculate my balance
  let myBalance = 0;
  if (currentUser) {
    const balEntry = balances.find((b) => b.userId === currentUser.id);
    if (balEntry) {
      myBalance = balEntry.netBalance ?? balEntry.balance ?? 0;
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-7xl mx-auto">
      {/* Header */}
      <nav className="flex justify-between items-center mb-8 pb-4 border-b border-green-950">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/dashboard')}
            className="p-2 rounded-lg bg-zinc-950 border border-green-950 text-zinc-400 hover:text-green-400 transition-all cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
              <Layers className="text-green-500" /> {group.name}
            </h1>
            <p className="text-zinc-500 text-sm">
              {group.description || 'No description'} • Base Currency: {group.currencyCode}
            </p>
          </div>
        </div>
      </nav>

      {/* Main Content Hub */}
      <main className="space-y-8">
        
        {/* Highlight Stats Row */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 flex items-center justify-between border-green-900 bg-zinc-950/60 rounded-2xl">
            <div className="space-y-1">
              <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Active Members</span>
              <h2 className="text-2xl font-bold text-white">{activeMembers.length}</h2>
              <p className="text-xs text-zinc-500">Total participants</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-950/40 border border-green-900 flex items-center justify-center text-green-400">
              <Users size={22} />
            </div>
          </div>

          <div className="glass-card p-6 flex items-center justify-between border-green-900 bg-zinc-950/60 rounded-2xl">
            <div className="space-y-1">
              <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Your Balance</span>
              <h2 className={`text-2xl font-bold ${myBalance > 0 ? 'text-green-400' : myBalance < 0 ? 'text-red-400' : 'text-zinc-300'}`}>
                  {myBalance > 0 ? '+' : ''}{(typeof myBalance === 'number' ? myBalance.toFixed(2) : '0.00')} {group.currencyCode}
                </h2>
              <p className="text-xs text-zinc-500">
                {myBalance > 0 ? 'You are owed' : myBalance < 0 ? 'You owe' : 'Settled up'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-950/40 border border-green-900 flex items-center justify-center text-green-400">
              <TrendingUp size={22} />
            </div>
          </div>

          <div className="glass-card p-6 flex items-center justify-between border-green-900 bg-zinc-950/60 rounded-2xl">
            <div className="space-y-1">
              <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Total Expenses</span>
              <h2 className="text-2xl font-bold text-white">{totalSpent.toFixed(2)} <span className="text-sm text-green-500">{group.currencyCode}</span></h2>
              <p className="text-xs text-zinc-500">{expenseCount} Recorded transactions</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-950/40 border border-green-900 flex items-center justify-center text-green-400">
              <Receipt size={22} />
            </div>
          </div>
        </section>

        <h3 className="font-bold text-xl text-white mt-12 mb-4">Group Management</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Members */}
          <div 
            onClick={() => router.push(`/groups/${group.id}/members`)}
            className="p-6 bg-zinc-950 border border-green-950 rounded-2xl cursor-pointer hover:border-green-500 transition-colors group"
          >
            <Users className="text-green-500 mb-4" size={28} />
            <h4 className="text-lg font-bold text-white mb-2">Members</h4>
            <p className="text-sm text-zinc-500">Manage roommates, invite new users, and track member timelines.</p>
          </div>

          {/* Expenses */}
          <div 
            onClick={() => router.push(`/groups/${group.id}/expenses`)}
            className="p-6 bg-zinc-950 border border-green-950 rounded-2xl cursor-pointer hover:border-green-500 transition-colors group"
          >
            <List className="text-green-500 mb-4" size={28} />
            <h4 className="text-lg font-bold text-white mb-2">Expenses List</h4>
            <p className="text-sm text-zinc-500">View the ledger of all shared expenses and exact split details.</p>
          </div>

          {/* Create Expense */}
          <div 
            onClick={() => router.push(`/groups/${group.id}/expenses/create`)}
            className="p-6 bg-zinc-950 border border-green-950 rounded-2xl cursor-pointer hover:border-green-500 transition-colors group"
          >
            <Receipt className="text-green-500 mb-4" size={28} />
            <h4 className="text-lg font-bold text-white mb-2">Add Expense</h4>
            <p className="text-sm text-zinc-500">Record a new transaction and split equally, by percentage, or exact amounts.</p>
          </div>

          {/* Balances */}
          <div 
            onClick={() => router.push(`/groups/${group.id}/balances`)}
            className="p-6 bg-zinc-950 border border-green-950 rounded-2xl cursor-pointer hover:border-green-500 transition-colors group"
          >
            <Activity className="text-green-500 mb-4" size={28} />
            <h4 className="text-lg font-bold text-white mb-2">Balances & Settlements</h4>
            <p className="text-sm text-zinc-500">View individual net balances, explain calculation traces, and resolve debts.</p>
          </div>

          {/* Import CSV */}
          <div 
            onClick={() => router.push(`/groups/${group.id}/import`)}
            className="p-6 bg-zinc-950 border border-green-950 rounded-2xl cursor-pointer hover:border-green-500 transition-colors group"
          >
            <Upload className="text-green-500 mb-4" size={28} />
            <h4 className="text-lg font-bold text-white mb-2">Import CSV</h4>
            <p className="text-sm text-zinc-500">Upload bulk expense data and utilize anomaly detection.</p>
          </div>

          {/* Audit Trail */}
          <div 
            onClick={() => router.push(`/groups/${group.id}/audit`)}
            className="p-6 bg-zinc-950 border border-green-950 rounded-2xl cursor-pointer hover:border-green-500 transition-colors group"
          >
            <FileText className="text-green-500 mb-4" size={28} />
            <h4 className="text-lg font-bold text-white mb-2">Audit Trail</h4>
            <p className="text-sm text-zinc-500">Read-only immutable logs of all actions performed in this group.</p>
          </div>

        </div>
      </main>
    </div>
  );
}
