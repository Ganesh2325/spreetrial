'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  Loader2,
  ShieldCheck,
  Clock,
} from 'lucide-react';

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: string | null;
  newValue: string | null;
  timestamp: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  EXPENSE_CREATED:   { label: 'Expense Created',   color: 'text-green-400 bg-green-950/40 border-green-900' },
  EXPENSE_EDITED:    { label: 'Expense Edited',     color: 'text-yellow-400 bg-yellow-950/40 border-yellow-900' },
  EXPENSE_DELETED:   { label: 'Expense Deleted',    color: 'text-red-400 bg-red-950/40 border-red-900' },
  SETTLEMENT_ADDED:  { label: 'Settlement Added',   color: 'text-blue-400 bg-blue-950/40 border-blue-900' },
  IMPORT_APPROVED:   { label: 'Import Approved',    color: 'text-green-400 bg-green-950/40 border-green-900' },
  IMPORT_REJECTED:   { label: 'Import Rejected',    color: 'text-red-400 bg-red-950/40 border-red-900' },
  MEMBER_JOINED:     { label: 'Member Joined',      color: 'text-cyan-400 bg-cyan-950/40 border-cyan-900' },
  MEMBER_REJOINED:   { label: 'Member Rejoined',    color: 'text-cyan-400 bg-cyan-950/40 border-cyan-900' },
  MEMBER_LEFT:       { label: 'Member Left',        color: 'text-orange-400 bg-orange-950/40 border-orange-900' },
};

export default function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: groupId } = use(params);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      // Fetch group name
      const groupRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002')}/api/groups/${groupId}`, {
        headers: { 'x-user-id': userId },
      });
      if (!groupRes.ok) {
        router.push('/dashboard');
        return;
      }
      const groupData = await groupRes.json();
      setGroupName(groupData.group?.name || '');

      // Fetch audit logs
      const logsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002')}/api/groups/${groupId}/audit-logs`, {
        headers: { 'x-user-id': userId },
      });
      if (!logsRes.ok) throw new Error('Failed to fetch audit logs');
      const logsData = await logsRes.json();
      setLogs(logsData.auditLogs || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-500 bg-black">
        <Loader2 className="animate-spin mr-2" size={24} /> Loading Audit Trail...
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
              <FileText className="text-green-500" /> Audit Trail
            </h1>
            <p className="text-zinc-500 text-sm">{groupName} — immutable log of all actions</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-950 border border-green-950 px-3 py-2 rounded-lg">
          <ShieldCheck size={14} className="text-green-500" />
          Read-only
        </div>
      </nav>

      {error && (
        <div className="mb-6 p-4 bg-red-950/20 border border-red-900 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {logs.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <FileText size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-semibold">No activity yet</p>
          <p className="text-sm mt-1">Actions like creating expenses, settling debts, or adding members will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const meta = ACTION_LABELS[log.action] || {
              label: log.action,
              color: 'text-zinc-300 bg-zinc-950/40 border-zinc-800',
            };

            let detail = '';
            try {
              if (log.newValue) {
                const parsed = JSON.parse(log.newValue);
                if (parsed.expense?.description) detail = parsed.expense.description;
                else if (parsed.description) detail = parsed.description;
                else if (parsed.userId) detail = `User: ${parsed.userId}`;
              }
            } catch {}

            return (
              <div
                key={log.id}
                className="p-5 rounded-2xl bg-zinc-950/50 border border-green-950/40 hover:border-green-900 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${meta.color}`}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">
                      by <span className="text-white">{log.user?.name || 'System'}</span>
                    </span>
                    {detail && (
                      <span className="text-xs text-zinc-500 italic truncate max-w-xs">
                        "{detail}"
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 shrink-0">
                    <Clock size={12} />
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-4 text-[11px] text-zinc-600 font-mono">
                  <span>Type: {log.entityType}</span>
                  <span className="truncate">ID: {log.entityId.slice(0, 12)}…</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
