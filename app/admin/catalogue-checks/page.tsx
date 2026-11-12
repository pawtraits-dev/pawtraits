'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ListChecks } from 'lucide-react';

type Issue = { id: string; title: string; breedName: string | null; problems: string[] };
type Dupe = { title: string; ids: string[] };
type Report = { total: number; issues: Issue[]; duplicates: Dupe[] };

/** Admin > Catalogue checks: design titles with markdown, naming a different breed, or repeated */
export default function CatalogueChecksPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/catalogue-checks', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setReport(j); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const markdown = (report?.issues ?? []).filter(i => i.problems.includes('markdown') || i.problems.includes('empty'));
  const mismatch = (report?.issues ?? []).filter(i => i.problems.includes('breed_mismatch'));
  const label = (i: Issue) => i.breedName || 'no breed';

  // There is no per-design edit page: designs are edited from the Image Catalog, so the id is shown to find it there
  const Id = ({ id }: { id: string }) => <code className="text-xs text-gray-500">{id}</code>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><ListChecks className="w-8 h-8 text-purple-600" />Catalogue checks</h1>
          <p className="text-gray-600 mt-2">Design titles with stray markdown, that name a different breed from the design&apos;s own, or that are used more than once.{report ? ` ${report.total} designs checked.` : ''}</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border bg-white hover:bg-gray-50" aria-label="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>
      {error && <p className="text-red-700">{error}</p>}

      <section className="bg-white rounded-lg border p-4">
        <h2 className="font-semibold text-gray-900 mb-2">Markdown in title ({markdown.length})</h2>
        <Table rows={markdown.map(i => ({ key: i.id, title: i.title || '(empty)', breed: label(i), id: i.id }))} Id={Id} />
      </section>

      <section className="bg-white rounded-lg border p-4">
        <h2 className="font-semibold text-gray-900 mb-2">Title names a different breed ({mismatch.length})</h2>
        <Table rows={mismatch.map(i => ({ key: i.id, title: i.title, breed: label(i), id: i.id }))} Id={Id} />
      </section>

      <section className="bg-white rounded-lg border p-4">
        <h2 className="font-semibold text-gray-900 mb-2">Duplicate titles ({report?.duplicates.length ?? 0})</h2>
        <Table rows={(report?.duplicates ?? []).flatMap(d => d.ids.map(id => ({ key: `${d.title}-${id}`, title: d.title, breed: '', id })))} Id={Id} hideBreed />
      </section>
    </div>
  );
}

function Table({ rows, Id, hideBreed }: { rows: { key: string; title: string; breed: string; id: string }[]; Id: (p: { id: string }) => JSX.Element; hideBreed?: boolean }) {
  if (!rows.length) return <p className="text-sm text-gray-500">None found.</p>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-gray-500"><th className="py-1 pr-4">Title</th>{!hideBreed && <th className="py-1 pr-4">Breed</th>}<th className="py-1">Design</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.key} className="border-t">
            <td className="py-1 pr-4">{r.title}</td>
            {!hideBreed && <td className="py-1 pr-4">{r.breed}</td>}
            <td className="py-1"><Id id={r.id} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
