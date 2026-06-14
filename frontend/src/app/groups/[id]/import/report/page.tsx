'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  CheckCircle2,
  FileCheck,
  Receipt,
  Activity
} from 'lucide-react';

export default function ImportReportPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: groupId } = use(params);

  const [report, setReport] = useState<any>(null);

  useEffect(() => {
    const userId = localStorage.getItem('spreetrail_user_id');
    if (!userId) {
      router.push('/login');
      return;
    }

    const storedReport = sessionStorage.getItem('spreetrail_import_report');
    if (storedReport) {
      setReport(JSON.parse(storedReport));
    } else {
      router.push(`/groups/${groupId}/import`);
    }
  }, [groupId, router]);

  if (!report) return null;

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-4xl mx-auto">
      {/* Header */}
      <nav className="flex items-center gap-4 mb-8 pb-4 border-b border-green-950">
        <button 
          onClick={() => router.push(`/groups/${groupId}`)}
          className="p-2 rounded-lg bg-zinc-950 border border-green-950 text-zinc-400 hover:text-green-400 transition-all cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <FileCheck className="text-green-500" /> Import Complete
          </h1>
          <p className="text-zinc-500 text-sm">Summary of your CSV data import</p>
        </div>
      </nav>

      <div className="glass-card p-12 bg-zinc-950/60 border border-green-900 rounded-2xl text-center mb-8">
        <CheckCircle2 className="mx-auto text-green-500 mb-6" size={64} />
        <h2 className="text-3xl font-extrabold text-white mb-2">Import Successful!</h2>
        <p className="text-zinc-400 text-lg">Your group's ledger and balances have been securely updated.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="p-6 bg-black border border-green-950 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Expenses Imported</p>
            <h3 className="text-4xl font-bold text-white">{report.stats?.importedExpenses || 0}</h3>
          </div>
          <Receipt className="text-green-900" size={48} />
        </div>

        <div className="p-6 bg-black border border-green-950 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-1">Settlements Processed</p>
            <h3 className="text-4xl font-bold text-white">{report.stats?.importedSettlements || 0}</h3>
          </div>
          <Activity className="text-green-900" size={48} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-green-950/50 justify-center">
        <button
          onClick={() => router.push(`/groups/${groupId}/expenses`)}
          className="bg-zinc-900 hover:bg-zinc-800 border border-green-950 text-white font-bold px-8 py-3 rounded-xl transition-all cursor-pointer"
        >
          View Ledger
        </button>
        <button
          onClick={() => router.push(`/groups/${groupId}/balances`)}
          className="bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          Check Updated Balances <ArrowLeft className="rotate-180" size={18} />
        </button>
      </div>
    </div>
  );
}
