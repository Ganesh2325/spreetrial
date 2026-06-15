'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  ArrowLeft, 
  UserPlus, 
  UserMinus, 
  Calendar,
  Loader2,
  CheckCircle2
} from 'lucide-react';

interface GroupMember {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  leftAt: string | null;
  active: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export default function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: groupId } = use(params);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showAddMember, setShowAddMember] = useState(false);
  const [timelineUserId, setTimelineUserId] = useState('');
  const [timelineJoinDate, setTimelineJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [allAppUsers, setAllAppUsers] = useState<any[]>([]);

  useEffect(() => {
    const userId = localStorage.getItem('spreetrail_user_id');
    if (!userId) {
      router.push('/login');
      return;
    }
    setCurrentUser({ id: userId });
    fetchGroupData(userId);

    // Load real users from the database
    fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002')}/api/users`)
      .then(r => r.json())
      .then(data => setAllAppUsers(data.users || []))
      .catch(console.error);
  }, [groupId, router]);

  const fetchGroupData = async (userId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002')}/api/groups/${groupId}`, {
        headers: { 'x-user-id': userId }
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setGroup(data.group);
    } catch (err) {
      console.error(err);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberAction = async (userId: string, action: 'JOIN' | 'LEAVE', date: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002')}/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || ''
        },
        body: JSON.stringify({ action, userId, date }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Operation failed');
      } else {
        alert(`Successfully logged ${action} timeline event!`);
        setShowAddMember(false);
        fetchGroupData(currentUser?.id);
      }
    } catch (err) {
      console.error(err);
      alert('Connection error');
    }
  };

  if (loading || !group) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-500 bg-black">
        <Loader2 className="animate-spin mr-2" size={24} /> Loading Members...
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
              <Users className="text-green-500" /> Members Timeline
            </h1>
            <p className="text-zinc-500 text-sm">Manage who is in the group and when they joined/left</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddMember(!showAddMember)}
          className="bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
        >
          <UserPlus size={16} /> Add Member
        </button>
      </nav>

      {showAddMember && (
        <div className="mb-8 p-6 bg-zinc-950/60 border border-green-900 rounded-2xl">
          <h3 className="font-bold text-lg mb-4 text-white">Log a Join Event</h3>
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full">
              <label className="text-xs text-zinc-500 font-semibold mb-1 block">Select User</label>
              <select
                value={timelineUserId}
                onChange={(e) => setTimelineUserId(e.target.value)}
                className="w-full bg-black border border-green-950 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
              >
                <option value="">-- Choose User --</option>
                {allAppUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
            <div className="w-full">
              <label className="text-xs text-zinc-500 font-semibold mb-1 block">Join Date</label>
              <input
                type="date"
                value={timelineJoinDate}
                onChange={(e) => setTimelineJoinDate(e.target.value)}
                className="w-full bg-black border border-green-950 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
            <button
              onClick={() => handleMemberAction(timelineUserId, 'JOIN', timelineJoinDate)}
              className="bg-green-500 hover:bg-green-400 text-black px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors w-full md:w-auto shrink-0 cursor-pointer"
            >
              <CheckCircle2 size={18} /> Confirm Join
            </button>
          </div>
        </div>
      )}

      {/* Members List */}
      <div className="space-y-4">
        {group.members?.map((m: GroupMember) => (
          <div key={m.id} className={`p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border ${m.active ? 'bg-zinc-950/40 border-green-900/50 hover:border-green-500/50' : 'bg-black border-red-950/30'}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${m.active ? 'bg-green-900/40 text-green-400 border border-green-900' : 'bg-red-950/20 text-red-400 border border-red-950/50'}`}>
                {m.user.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-bold text-lg text-white flex items-center gap-2">
                  {m.user.name}
                  {!m.active && <span className="text-[10px] uppercase bg-red-950/50 text-red-500 px-2 py-0.5 rounded-full font-bold">Left</span>}
                </h4>
                <p className="text-xs text-zinc-500">{m.user.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs text-zinc-500 flex items-center gap-1.5 justify-end">
                  <Calendar size={12} /> Joined: <span className="text-zinc-300 font-mono">{new Date(m.joinedAt).toLocaleDateString()}</span>
                </div>
                {m.leftAt && (
                  <div className="text-xs text-red-400 flex items-center gap-1.5 justify-end mt-1">
                    <UserMinus size={12} /> Left: <span className="font-mono">{new Date(m.leftAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              
              {m.active && (
                <button
                  onClick={() => {
                    const leaveDate = prompt('Enter leave date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
                    if (leaveDate) handleMemberAction(m.userId, 'LEAVE', leaveDate);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-red-950 text-red-400 hover:bg-red-950/30 transition-colors text-xs font-bold cursor-pointer"
                >
                  Mark as Left
                </button>
              )}
            </div>
          </div>
        ))}
        {(!group.members || group.members.length === 0) && (
          <div className="text-center py-12 text-zinc-500">
            No members in this group yet.
          </div>
        )}
      </div>
    </div>
  );
}
