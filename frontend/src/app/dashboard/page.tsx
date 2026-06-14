'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, ArrowRight, DollarSign, TrendingUp, LogOut, Loader2, Layers, FileText, Plus } from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [groupBalances, setGroupBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string>('');

  useEffect(() => {
    const userId = localStorage.getItem('spreetrail_user_id');
    const name = localStorage.getItem('spreetrail_user_name');
    const email = localStorage.getItem('spreetrail_user_email');

    if (!userId || !name || !email) {
      router.push('/login');
      return;
    }

    setCurrentUser({ id: userId, name, email });

    const fetchGroups = async () => {
      try {
        const res = await fetch('http://localhost:5002/api/groups', {
          headers: {
            'x-user-id': userId
          }
        });
        const data = await res.json();
        if (res.ok) {
          setGroups(data.groups || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, [router]);

  // Fetch group balances for current user
  useEffect(() => {
    if (groups.length && currentUser?.id) {
      const fetchBalances = async () => {
        const balMap: Record<string, number> = {};
        await Promise.all(
          groups.map(async (g: any) => {
            try {
              const res = await fetch(`http://localhost:5002/api/groups/${g.id}/balances`, {
                headers: { 'x-user-id': currentUser.id },
              });
              if (res.ok) {
                const data = await res.json();
                const myBal = data.balances?.find((b: any) => b.userId === currentUser.id);
                balMap[g.id] = myBal?.netBalance ?? myBal?.balance ?? 0;
              }
            } catch (e) {
              console.error(e);
            }
          })
        );
        setGroupBalances(balMap);
      };
      fetchBalances();
    }
  }, [groups, currentUser]);

  const handleLogout = () => {
    localStorage.removeItem('spreetrail_user_id');
    localStorage.removeItem('spreetrail_user_name');
    localStorage.removeItem('spreetrail_user_email');
    router.push('/login');
  };



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-500 bg-black">
        <Loader2 className="animate-spin mr-2" size={24} /> Loading Spreetrail session...
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-7xl mx-auto px-6 py-8 flex flex-col justify-between bg-black">
      {/* Top Navbar */}
      <nav className="flex justify-between items-center mb-10 pb-6 border-b border-green-950">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/login')}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-green-700 to-green-400 flex items-center justify-center font-bold text-sm text-black">
            S
          </div>
          <span className="font-bold text-lg text-white">Spreetrail</span>
        </div>

        <div className="flex items-center gap-4">


          <button
            onClick={handleLogout}
            className="bg-green-500 hover:bg-green-400 text-black px-3 py-1 rounded-lg"
            title="Log Out"
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main Grid */}
      <main className="flex-1 space-y-8 mb-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white">Welcome back, {currentUser?.name}!</h1>
            <p className="text-zinc-500 text-sm mt-1">Here is a summary of your roommate balance sheets.</p>
          </div>

        </div>



        {/* Quick Action Cards */}
        <section className="space-y-6 mt-8">
          <h2 className="text-xl font-bold text-white">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-6 bg-zinc-950/60 border border-green-900 rounded-2xl flex flex-col justify-between">
              {actionError && (
                <div className="mb-3 text-red-400 text-sm bg-red-950/30 p-2 rounded">
                  {actionError}
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-white">Create & Manage Groups</h3>
                <p className="text-xs text-zinc-500">Add members, edit details, view balances.</p>
              </div>
              <button
                onClick={() => router.push('/groups/create')}
                className="mt-4 self-start bg-green-500 hover:bg-green-400 text-black px-3 py-1 rounded-lg text-xs font-bold"
              >
                <Plus size={14} className="inline-block mr-1" /> Create Group
              </button>
            </div>
            <div className="p-6 bg-zinc-950/60 border border-green-900 rounded-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Create & Manage Expenses</h3>
                <p className="text-xs text-zinc-500">Add new expenses, view ledger, handle splits.</p>
              </div>
              <button
                onClick={() => router.push('/groups')}
                className="mt-4 self-start bg-green-500 hover:bg-green-400 text-black px-3 py-1 rounded-lg text-xs font-bold"
              >
                <Plus size={14} className="inline-block mr-1" /> Manage Expenses
              </button>
            </div>
            <div className="p-6 bg-zinc-950/60 border border-green-900 rounded-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Import Expenses CSV</h3>
                <p className="text-xs text-zinc-500">Upload a CSV file to bulk import expenses.</p>
              </div>
              <button
                onClick={() => {
                  if (groups.length) {
                    router.push(`/groups/${groups[0].id}/import`);
                  } else {
                    setActionError('No groups available. Please create a group first.');
                  }
                }}
                className="mt-4 self-start bg-green-500 hover:bg-green-400 text-black px-3 py-1 rounded-lg text-xs font-bold"
              >
                <FileText size={14} className="inline-block mr-1" /> Import CSV
              </button>
            </div>
          </div>
        </section>
        {/* Group Selector Cards */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-bold text-xl text-white flex items-center gap-2">
              <Layers className="text-green-500" size={20} />
              Your Shared Expense Groups
            </h3>
            <button
              onClick={() => router.push('/groups/create')}
              className="bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              + Create Group
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.length === 0 ? (
              <div className="col-span-full py-12 text-center text-zinc-500">
                No groups found. Please seed the backend database or check logs.
              </div>
            ) : (
              groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => router.push(`/groups/${group.id}`)}
                  className="glass-card p-6 cursor-pointer border-green-900 bg-zinc-950/40 hover:border-green-500 relative group overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-green-500/5 to-transparent rounded-full"></div>

                  <div className="space-y-4">
                    <div>
                      <h4 className="font-bold text-lg text-white group-hover:text-green-400 transition-colors">
                        {group.name}
                      </h4>
                      <p className="text-zinc-500 text-xs mt-1 line-clamp-2 font-sans">
                        {group.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="border-t border-green-950/80 pt-4 flex justify-between items-center">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-555 font-medium">
                        <Users size={14} className="text-green-400" />
                        <span>{group.members?.length || 0} active roommates</span>
                      </div>
                      <div className="text-sm font-mono mt-2">
                        My Balance: {groupBalances[group.id] !== undefined ? (groupBalances[group.id] > 0 ? '+' : '') + groupBalances[group.id].toFixed(2) : '0.00'} {group.currencyCode}
                      </div>

                      <span className="text-xs text-zinc-500 group-hover:text-white flex items-center gap-1 font-semibold transition-colors">
                        Open Ledger <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <footer className="text-center text-xs text-zinc-600 font-mono py-4 border-t border-green-950 mt-12">
        Spreetrail Ledger Platform • Production Sandbox
      </footer>
    </div>
  );
}
