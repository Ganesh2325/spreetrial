'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Upload,
  Loader2,
  FileText,
  AlertTriangle
} from 'lucide-react';

export default function ImportCSVPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: groupId } = use(params);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [csvFile, setCsvFile] = useState<string>('');
  const [csvFilename, setCsvFilename] = useState('expenses_export.csv');
  const [error, setError] = useState('');

  useEffect(() => {
    const userId = localStorage.getItem('spreetrail_user_id');
    if (!userId) {
      router.push('/login');
      return;
    }
    setCurrentUser({ id: userId });
  }, [router]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFilename(file.name);
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        // Validate CSV header columns (comma or tab separated)
        const lines = text.split(/\r?\n/);
        const headerLine = lines[0] ?? '';
        const headers = headerLine.split(/[\t,]/).map(h => h.trim().toLowerCase());
        const expectedHeaders = ['date','description','paid_by','amount','currency','split_type','split_with','split_details','notes'];
        const missing = expectedHeaders.filter(h => !headers.includes(h));
        if (missing.length) {
          setError(`Invalid CSV format. Missing columns: ${missing.join(', ')}`);
          setCsvFile('');
          setCsvFilename('');
          return;
        }
        setCsvFile(text);
      };
      reader.readAsText(file);
    }
  };

  const handleStartImport = async () => {
    if (!csvFile) {
      setError('Please upload a CSV file first.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001')}/api/groups/${groupId}/imports`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': currentUser?.id || ''
        },
        body: JSON.stringify({ csvContent: csvFile, filename: csvFilename }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Import validation failed.');
      }

      // Store in session storage so review page can pick it up
      sessionStorage.setItem('spreetrail_import_result', JSON.stringify(data));
      router.push(`/groups/${groupId}/import/review`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during import.');
    } finally {
      setLoading(false);
    }
  };

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
            <Upload className="text-green-500" /> Import Expenses CSV
          </h1>
          <p className="text-zinc-500 text-sm">Upload bulk expenses data for anomaly detection</p>
        </div>
      </nav>

      <div className="glass-card p-8 bg-zinc-950/60 border border-green-900 rounded-2xl">
        
        {error && (
          <div className="mb-6 bg-red-950/50 border border-red-900 text-red-400 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="border-2 border-dashed border-green-900 bg-black rounded-2xl p-12 text-center hover:border-green-500 transition-colors">
          <FileText className="mx-auto text-green-500 mb-4" size={48} />
          <h3 className="text-xl font-bold text-white mb-2">Upload your CSV</h3>
          <p className="text-sm text-zinc-500 mb-6">Must contain Date, Description, Amount, Currency, PayerEmail, SplitType, Participants columns</p>
          
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className="bg-zinc-900 hover:bg-zinc-800 border border-green-950 text-white px-6 py-3 rounded-xl cursor-pointer font-bold transition-colors inline-block"
          >
            Select File
          </label>
          
          {csvFile && (
            <p className="mt-4 text-green-400 font-mono text-sm">
              File selected: {csvFilename} ({(csvFile.length / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-green-950/50 flex justify-end">
            <button
            onClick={handleStartImport}
            disabled={!csvFile || loading}
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {loading ? 'Analyzing CSV...' : 'Analyze CSV File'}
          </button>
        </div>
      </div>
    </div>
  );
}
