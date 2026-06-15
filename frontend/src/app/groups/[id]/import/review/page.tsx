'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  FileText,
  ArrowLeft,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Check,
} from 'lucide-react';

export default function ImportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: groupId } = use(params);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [resolvedImportRows, setResolvedImportRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const userId = localStorage.getItem('spreetrail_user_id');
    if (!userId) {
      router.push('/login');
      return;
    }
    setCurrentUser({ id: userId });

    const storedResult = sessionStorage.getItem('spreetrail_import_result');
    if (storedResult) {
      const data = JSON.parse(storedResult);
      setImportResult(data);
      // Automatically resolve rows without errors
      const initialResolved = data.rows.map((row: any, idx: number) => {
        const hasError = data.issues.some((iss: any) => iss.rowIndex === idx + 1 && iss.severity === 'ERROR');
        return hasError ? null : row;
      });
      setResolvedImportRows(initialResolved);
    } else {
      router.push(`/groups/${groupId}/import`);
    }
  }, [groupId, router]);

  const handleResolveIssue = (rowIndex: number, action: 'AUTO' | 'SKIP' | 'MANUAL') => {
    const updatedResolved = [...resolvedImportRows];
    
    if (action === 'SKIP') {
      updatedResolved[rowIndex - 1] = null; // Mark skipped
    } else if (action === 'AUTO') {
      updatedResolved[rowIndex - 1] = importResult.rows[rowIndex - 1]; // Assume accepted for now
    }
    
    setResolvedImportRows(updatedResolved);
  };

  const handleConfirmImport = async () => {
    const finalRowsToImport = resolvedImportRows.filter(r => r !== null);
    if (finalRowsToImport.length === 0) {
      setError('No valid rows to import.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002')}/api/groups/${groupId}/imports/confirm`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || ''
        },
        body: JSON.stringify({ rows: finalRowsToImport }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to confirm import');
      }

      sessionStorage.removeItem('spreetrail_import_result');
      sessionStorage.setItem('spreetrail_import_report', JSON.stringify(data));
      router.push(`/groups/${groupId}/import/report`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error saving imported records.');
    } finally {
      setLoading(false);
    }
  };

  if (!importResult) return null;

  const totalErrors = importResult.issues.filter((i: any) => i.severity === 'ERROR').length;
  const totalWarnings = importResult.issues.filter((i: any) => i.severity === 'WARNING').length;

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-5xl mx-auto">
      {/* Header */}
      <nav className="flex justify-between items-center mb-8 pb-4 border-b border-green-950">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push(`/groups/${groupId}/import`)}
            className="p-2 rounded-lg bg-zinc-950 border border-green-950 text-zinc-400 hover:text-green-400 transition-all cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
              <ShieldAlert className="text-orange-500" /> Review Anomalies
            </h1>
            <p className="text-zinc-500 text-sm">We detected issues in your CSV upload</p>
          </div>
        </div>
      </nav>

      {error && (
        <div className="mb-6 bg-red-950/50 border border-red-900 text-red-400 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="glass-card p-6 bg-zinc-950/60 border border-green-900 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 uppercase font-bold">Total Rows</p>
            <h2 className="text-3xl font-bold text-white">{importResult.rows.length}</h2>
          </div>
          <FileText className="text-zinc-600" size={32} />
        </div>
        <div className="glass-card p-6 bg-red-950/20 border border-red-900/50 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-red-500/70 uppercase font-bold">Errors (Blocking)</p>
            <h2 className="text-3xl font-bold text-red-400">{totalErrors}</h2>
          </div>
          <AlertTriangle className="text-red-500" size={32} />
        </div>
        <div className="glass-card p-6 bg-orange-950/20 border border-orange-900/50 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs text-orange-500/70 uppercase font-bold">Warnings</p>
            <h2 className="text-3xl font-bold text-orange-400">{totalWarnings}</h2>
          </div>
          <ShieldAlert className="text-orange-500" size={32} />
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <h3 className="font-bold text-xl text-white">Detected Issues</h3>
        {importResult.issues.length === 0 ? (
          <div className="p-12 text-center border border-green-900 rounded-2xl bg-green-950/20">
            <CheckCircle2 className="mx-auto text-green-500 mb-4" size={48} />
            <p className="text-lg font-bold text-green-400">Perfect Schema!</p>
            <p className="text-sm text-zinc-400">No anomalies detected in your CSV file.</p>
          </div>
        ) : (
          importResult.issues.map((iss: any, idx: number) => {
            const isResolved = resolvedImportRows[iss.rowIndex - 1] !== undefined && resolvedImportRows[iss.rowIndex - 1] !== null;
            const isSkipped = resolvedImportRows[iss.rowIndex - 1] === null;

            return (
              <div 
                key={idx} 
                className={`p-6 rounded-2xl border ${iss.severity === 'ERROR' ? 'bg-red-950/10 border-red-900/30' : 'bg-orange-950/10 border-orange-900/30'}`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${iss.severity === 'ERROR' ? 'bg-red-500 text-black' : 'bg-orange-500 text-black'}`}>
                        {iss.severity}
                      </span>
                      <span className="text-sm font-bold text-white">Row {iss.rowIndex}: {iss.issueType}</span>
                    </div>
                    <p className="text-sm text-zinc-300 mb-1">{iss.explanation}</p>
                    <p className="text-xs text-zinc-500 italic">Suggestion: {iss.suggestedFix}</p>
                    
                    <div className="mt-4 p-3 bg-black border border-zinc-800 rounded-xl overflow-x-auto text-xs font-mono text-zinc-400">
                      {JSON.stringify(importResult.rows[iss.rowIndex - 1])}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0 w-full md:w-48">
                    {!isResolved && !isSkipped ? (
                      <>
                        {iss.autoAction && (
                          <button
                            onClick={() => handleResolveIssue(iss.rowIndex, 'AUTO')}
                            className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Auto: {iss.autoAction}
                          </button>
                        )}
                        <button
                          onClick={() => handleResolveIssue(iss.rowIndex, 'SKIP')}
                          className="border border-red-900/50 hover:bg-red-950/30 text-red-400 px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          Skip Row
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center justify-end gap-2 text-green-500 font-bold text-sm">
                        <Check size={16} /> {isSkipped ? 'Row Skipped' : 'Resolved'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="pt-6 border-t border-green-950/50 flex justify-end">
        <button
          onClick={handleConfirmImport}
          disabled={loading}
          className="bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          {loading ? 'Processing...' : `Confirm Import (${resolvedImportRows.filter(r => r !== null).length} rows)`}
        </button>
      </div>

    </div>
  );
}
