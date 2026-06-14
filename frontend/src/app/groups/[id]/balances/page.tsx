'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Activity,
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Info,
  CheckCircle2,
  X
} from 'lucide-react';

export default function BalancesPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: groupId } = use(params);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [balances, setBalances] = useState<any[]>([]);
  const [suggestedSettlements, setSuggestedSettlements] = useState<any[]>([]);

  // Explain Balance modal states
  const [explainUser, setExplainUser] = useState<any>(null);
  const [explainTrace, setExplainTrace] = useState<any[]>([]);
  const [loadingExplain, setLoadingExplain] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem('spreetrail_user_id');
    if (!userId) {
      router.push('/login');
      return;
    }
    setCurrentUser({ id: userId });
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
      
      const balRes = await fetch(`http://localhost:5002/api/groups/${groupId}/balances`, { headers });
      if (balRes.ok) {
        const balData = await balRes.json();
        setBalances(balData.balances || []);
        setSuggestedSettlements(balData.suggestedSettlements || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExplainBalance = async (memberUserId: string, userObj: any) => {
    setExplainUser(userObj);
    setLoadingExplain(true);
    try {
      const res = await fetch(`http://localhost:5002/api/groups/${groupId}/explain-balance?userId=${memberUserId}`);
      const data = await res.json();
      setExplainTrace(data.trace || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingExplain(false);
    }
  };

  const handleSettleDebt = async (fromUserId: string, toUserId: string, amount: number) => {
    try {
      const res = await fetch(`http://localhost:5002/api/groups/${groupId}/settlements`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || ''
        },
        body: JSON.stringify({
          payerId: fromUserId,
          payeeId: toUserId,
          amount,
          currency: group?.currencyCode || 'INR',
          date: new Date().toISOString().split('T')[0]
        }),
      });
      if (res.ok) {
        alert('Debt successfully settled!');
        fetchData(currentUser?.id || '');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to settle debt.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-500 bg-black">
        <Loader2 className="animate-spin mr-2" size={24} /> Loading Balances...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-6xl mx-auto">
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
              <Activity className="text-green-500" /> Balances & Settlements
            </h1>
            <p className="text-zinc-500 text-sm">Who owes who in {group.name}</p>
          </div>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Net Balances Column */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white mb-4">Current Net Balances</h2>
          {balances.map((b: any) => {
            const bal = b.netBalance ?? b.balance ?? 0;
            const userName = b.name || b.user?.name || 'Unknown';
            return (
            <div key={b.userId} className="p-6 bg-zinc-950/60 border border-green-900 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold
                  ${bal > 0 ? 'bg-green-900/40 text-green-400 border border-green-900' : bal < 0 ? 'bg-red-950/40 text-red-400 border border-red-900' : 'bg-zinc-900 text-zinc-400'}
                `}>
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-lg text-white">{userName}</h4>
                  <p className="text-xs text-zinc-500">
                    {bal > 0 ? 'Owed' : bal < 0 ? 'Owes' : 'Settled Up'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xl font-bold font-mono ${bal > 0 ? 'text-green-400' : bal < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                  {(bal > 0 ? '+' : '') + bal.toFixed(2)}
                </div>
                <button
                  onClick={() => handleExplainBalance(b.userId, { name: userName, id: b.userId })}
                  className="text-xs text-green-500 hover:text-green-400 mt-1 underline cursor-pointer"
                >
                  Explain Trace
                </button>
              </div>
            </div>
            );
          })}
          {balances.length === 0 && (
            <p className="text-zinc-500 p-6 glass-card border-green-900 rounded-2xl text-center">No active balances to display.</p>
          )}
        </div>

        {/* Suggested Settlements Column */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white mb-4">Suggested Settlements</h2>
          <div className="glass-card p-6 bg-zinc-950 border border-green-900 rounded-2xl">
            <p className="text-sm text-zinc-400 mb-6">
              Our optimization engine calculated the minimum number of transactions needed to settle all debts.
            </p>
            
            {suggestedSettlements.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="mx-auto text-green-500 mb-2" size={32} />
                <p className="text-zinc-300 font-bold">Everyone is settled up!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {suggestedSettlements.map((s: any, idx: number) => (
                  <div key={idx} className="p-4 bg-black border border-green-950 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-red-400">{s.fromName}</span>
                      <ArrowRight size={16} className="text-zinc-600" />
                      <span className="font-bold text-green-400">{s.toName}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono font-bold text-white text-lg">
                        {s.amount.toFixed(2)} <span className="text-sm text-green-500">{group.currencyCode}</span>
                      </span>
                      <button
                        onClick={() => handleSettleDebt(s.fromUserId, s.toUserId, s.amount)}
                        className="bg-green-500 hover:bg-green-400 text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Settle Debt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Explain Trace Modal */}
      {explainUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-zinc-950 border border-green-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-green-950 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Info className="text-green-500" /> Explain Trace: {explainUser.name}
                </h3>
                <p className="text-xs text-zinc-500">Detailed breakdown of how the net balance was calculated</p>
              </div>
              <button 
                onClick={() => setExplainUser(null)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              {loadingExplain ? (
                <div className="py-12 flex justify-center text-green-500"><Loader2 className="animate-spin" /></div>
              ) : explainTrace.length === 0 ? (
                <p className="text-center text-zinc-500">No transactions affecting this user.</p>
              ) : (
                explainTrace.map((t, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-green-950 bg-black flex justify-between items-center">
                    <div>
                      <p className="text-sm text-white font-medium">{t.description}</p>
                      <p className="text-xs text-zinc-500 font-mono mt-1">{new Date(t.date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold font-mono ${t.effect > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {t.effect > 0 ? '+' : ''}{t.effect.toFixed(2)}
                      </p>
                      <p className="text-xs text-zinc-500 uppercase">{t.type}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
