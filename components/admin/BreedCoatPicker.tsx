'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

export interface BreedCoat { breedId: string; coatId: string }

interface Row { breedId: string; breedName: string; animal: string; breedRank: number; coatId: string; coatName: string; hex: string; coatRank: number; common: boolean }

/**
 * Breed × coat choice for saved batches: breeds expand to their coats (All / None per breed),
 * with search, dogs/cats, and "add the top N" by popularity.
 */
export default function BreedCoatPicker({ selected, onChange }: { selected: BreedCoat[]; onChange: (v: BreedCoat[]) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [animal, setAnimal] = useState<'all' | 'dog' | 'cat'>('all');
  const [open, setOpen] = useState<string[]>([]);
  const [topN, setTopN] = useState(100);

  useEffect(() => {
    (async () => {
      try {
        const [bcRes, breedsRes] = await Promise.all([fetch('/api/breed-coats'), fetch('/api/breeds')]);
        const bc = await bcRes.json();
        const breeds = await breedsRes.json();
        const breedBy = new Map((Array.isArray(breeds) ? breeds : []).filter((b: any) => b.is_active !== false).map((b: any) => [b.id, b]));
        setRows((Array.isArray(bc) ? bc : []).filter((r: any) => breedBy.has(r.breed_id) && r.coats).map((r: any) => {
          const b: any = breedBy.get(r.breed_id);
          return {
            breedId: r.breed_id, breedName: b.name, animal: b.animal_type || 'dog', breedRank: b.popularity_rank ?? 9999,
            coatId: r.coat_id, coatName: r.coats.name, hex: r.coats.hex_color || '#ccc', coatRank: r.popularity_rank ?? 9999, common: r.is_common !== false,
          };
        }));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const key = (b: string, c: string) => `${b}:${c}`;
  const chosen = useMemo(() => new Set(selected.map((s) => key(s.breedId, s.coatId))), [selected]);
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const m = new Map<string, { breedId: string; name: string; animal: string; rank: number; coats: Row[] }>();
    for (const r of rows) {
      if (animal !== 'all' && r.animal !== animal) continue;
      if (q && !r.breedName.toLowerCase().includes(q) && !r.coatName.toLowerCase().includes(q)) continue;
      const g = m.get(r.breedId) ?? { breedId: r.breedId, name: r.breedName, animal: r.animal, rank: r.breedRank, coats: [] };
      g.coats.push(r);
      m.set(r.breedId, g);
    }
    return Array.from(m.values()).sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).map((g) => ({ ...g, coats: g.coats.sort((a: Row, b: Row) => a.coatRank - b.coatRank || a.coatName.localeCompare(b.coatName)) }));
  }, [rows, search, animal]);

  const setMany = (pairs: BreedCoat[], on: boolean) => {
    const ks = new Set(pairs.map((p) => key(p.breedId, p.coatId)));
    if (on) onChange([...selected, ...pairs.filter((p) => !chosen.has(key(p.breedId, p.coatId)))]);
    else onChange(selected.filter((s) => !ks.has(key(s.breedId, s.coatId))));
  };
  const addTop = () => {
    const pool = rows
      .filter((r) => (animal === 'all' || r.animal === animal) && r.common)
      .sort((a, b) => a.breedRank - b.breedRank || a.coatRank - b.coatRank)
      .slice(0, topN)
      .map((r) => ({ breedId: r.breedId, coatId: r.coatId }));
    setMany(pool, true);
  };
  const searching = search.trim().length > 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-medium text-gray-700">
          Breeds and coats
          {selected.length > 0 && <Badge variant="secondary" className="ml-2 text-xs">{selected.length} selected</Badge>}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Add the top</span>
          <Input type="number" min={1} max={1000} value={topN} onChange={(e) => setTopN(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} className="w-20 h-8 text-sm" aria-label="How many popular combinations to add" />
          <Button variant="outline" size="sm" className="text-xs" onClick={addTop} disabled={loading}>
            popular combinations
          </Button>
          {selected.length > 0 && <Button variant="outline" size="sm" className="text-xs" onClick={() => onChange([])}>Clear</Button>}
        </div>
      </div>
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input placeholder="Search breeds or coats…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 text-sm" />
        </div>
        <div className="inline-flex rounded-lg border bg-white p-1" role="group" aria-label="Animal">
          {(['all', 'dog', 'cat'] as const).map((a) => (
            <button key={a} type="button" aria-pressed={animal === a} onClick={() => setAnimal(a)}
              className={`px-3 py-1 text-sm rounded-md ${animal === a ? 'bg-purple-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
              {a === 'all' ? 'All' : a === 'dog' ? 'Dogs' : 'Cats'}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto space-y-2">
        {loading && <p className="text-sm text-gray-500 italic">Loading breeds and coats…</p>}
        {!loading && groups.length === 0 && <p className="text-sm text-gray-500 italic">Nothing matches.</p>}
        {groups.map((g) => {
          const isOpen = searching || open.includes(g.breedId);
          const pairs = g.coats.map((c) => ({ breedId: c.breedId, coatId: c.coatId }));
          const n = pairs.filter((p) => chosen.has(key(p.breedId, p.coatId))).length;
          const all = n === pairs.length;
          return (
            <div key={g.breedId} className="border rounded-lg">
              <div role="button" aria-expanded={isOpen} className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setOpen((o) => (o.includes(g.breedId) ? o.filter((x) => x !== g.breedId) : [...o, g.breedId]))}>
                <div className="flex items-center gap-3">
                  <span className={`transform transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                  <span className="font-medium text-sm">{g.animal === 'cat' ? '🐱' : '🐕'} {g.name}</span>
                  <span className="text-xs text-gray-400">{pairs.length} coats</span>
                  {n > 0 && <Badge variant="secondary" className="text-xs">{n} selected</Badge>}
                </div>
                <Button variant="outline" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); setMany(pairs, !all); }}>{all ? 'None' : 'All'}</Button>
              </div>
              {isOpen && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1 px-3 pb-3 ml-6">
                  {g.coats.map((c) => {
                    const id = `bcp-${c.breedId}-${c.coatId}`;
                    return (
                      <div key={c.coatId} className="flex items-center gap-2 p-2 border rounded">
                        <Checkbox id={id} checked={chosen.has(key(c.breedId, c.coatId))} onCheckedChange={() => setMany([{ breedId: c.breedId, coatId: c.coatId }], !chosen.has(key(c.breedId, c.coatId)))} />
                        <span className="w-3 h-3 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: c.hex }} aria-hidden />
                        <label htmlFor={id} className="text-xs cursor-pointer leading-tight">{c.coatName}</label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
