'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CspRow {
  id: number;
  effective_directive: string;
  blocked: string;
  document_path: string;
  disposition: string;
  count: number;
  first_seen: string;
  last_seen: string;
  sample: string | null;
  source_file: string | null;
  line_number: number | null;
  user_agent_family: string | null;
}

const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
const clean = (s: string | number | null | undefined) => String(s ?? '').replace(/[\t\r\n]+/g, ' ');

/** Tab-separated text of the whole table, header row first. */
function toTsv(rows: CspRow[]): string {
  const header = ['directive', 'blocked', 'page', 'disposition', 'count', 'first seen', 'last seen', 'sample', 'source', 'browser'];
  const lines = rows.map((r) => [
    r.effective_directive, r.blocked, r.document_path, r.disposition, r.count, r.first_seen, r.last_seen,
    r.sample, r.source_file ? `${r.source_file}${r.line_number ? ':' + r.line_number : ''}` : '', r.user_agent_family,
  ].map(clean).join('\t'));
  return [header.join('\t'), ...lines].join('\n');
}

export default function CspReportsPage() {
  const [rows, setRows] = useState<CspRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [missingTable, setMissingTable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/csp-reports', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could not load reports');
      setMissingTable(!!json.missingTable);
      setRows(json.reports || []);
    } catch (e: any) {
      setError(e.message || 'Could not load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toTsv(rows));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to the clipboard');
    }
  };

  const clearAll = async () => {
    setConfirmOpen(false);
    try {
      const res = await fetch('/api/admin/csp-reports', { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not clear reports');
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>CSP report-only violations</CardTitle>
          <CardDescription>
            What the strict nonce-based policy would block if it were enforced. Nothing here is blocked today. Most frequent first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>Refresh</Button>
            <Button variant="outline" onClick={copy} disabled={rows.length === 0}>{copied ? 'Copied' : 'Copy as text'}</Button>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={rows.length === 0}>Clear all</Button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {loading && <p className="text-sm text-gray-500">Loading…</p>}
          {!loading && missingTable && (
            <p className="text-sm text-gray-700">Run db/migrations/2026-11-15-csp-reports.sql to start collecting reports.</p>
          )}
          {!loading && !missingTable && !error && rows.length === 0 && (
            <p className="text-sm text-gray-700">No reports yet. They arrive as visitors browse the site.</p>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-gray-500">
                    <th className="p-2">Directive</th>
                    <th className="p-2">Blocked</th>
                    <th className="p-2">Page</th>
                    <th className="p-2 text-right">Count</th>
                    <th className="p-2">First seen</th>
                    <th className="p-2">Last seen</th>
                    <th className="p-2">Sample</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b align-top">
                      <td className="p-2 font-mono">{r.effective_directive}{r.disposition === 'enforce' ? ' (enforced)' : ''}</td>
                      <td className="p-2 font-mono">{r.blocked}</td>
                      <td className="p-2 font-mono">{r.document_path}</td>
                      <td className="p-2 text-right tabular-nums">{r.count}</td>
                      <td className="p-2 whitespace-nowrap">{fmt(r.first_seen)}</td>
                      <td className="p-2 whitespace-nowrap">{fmt(r.last_seen)}</td>
                      <td className="max-w-xs break-words p-2 font-mono text-xs">
                        {r.sample}
                        {r.source_file && <div className="text-gray-500">{r.source_file}{r.line_number ? `:${r.line_number}` : ''}</div>}
                        {r.user_agent_family && <div className="text-gray-400">{r.user_agent_family}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all CSP reports?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes every collected report. New ones start counting from zero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={clearAll}>Clear all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
