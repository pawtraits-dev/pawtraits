'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { groupOutfits, matchesOutfitSearch, type OutfitLike } from '@/lib/catalog/outfit-groups';

/**
 * Outfit choice for the variation pickers. Everyday outfits are a flat list; team kits are
 * grouped by league (Premier League, NFL…) in rows that expand to show the teams, each with
 * All/None, the same way coats sit under a breed.
 */
export default function OutfitPicker<T extends OutfitLike>({
  outfits,
  selected,
  onChange,
  idPrefix = 'outfit',
}: {
  outfits: T[];
  selected: string[];
  onChange: (ids: string[]) => void;
  idPrefix?: string;
}) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);

  const visible = useMemo(() => outfits.filter((o) => matchesOutfitSearch(o, search)), [outfits, search]);
  const { everyday, leagues } = useMemo(() => groupOutfits(visible), [visible]);
  const searching = search.trim().length > 0;

  const isOn = (id: string) => selected.includes(id);
  const toggle = (id: string) => onChange(isOn(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const setMany = (ids: string[], on: boolean) =>
    onChange(on ? Array.from(new Set([...selected, ...ids])) : selected.filter((x) => !ids.includes(x)));

  const everydayIds = everyday.map((o) => o.id);
  const allEveryday = everydayIds.length > 0 && everydayIds.every(isOn);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-700">
          Outfit Variations
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">{selected.length} selected</Badge>
          )}
        </h3>
        {selected.length > 0 && (
          <Button variant="outline" size="sm" className="text-xs" onClick={() => onChange([])}>
            Clear All
          </Button>
        )}
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Search outfits or teams (e.g. pyjamas, Arsenal, NFL)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 text-sm"
        />
      </div>

      <div className="max-h-80 overflow-y-auto space-y-3">
        {everyday.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Outfits</p>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setMany(everydayIds, !allEveryday)}>
                {allEveryday ? 'None' : 'All'}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {everyday.map((o) => (
                <div key={o.id} className="flex items-start space-x-2 p-2 border rounded-lg">
                  <Checkbox id={`${idPrefix}-${o.id}`} checked={isOn(o.id)} onCheckedChange={() => toggle(o.id)} />
                  <div className="flex-1">
                    <label htmlFor={`${idPrefix}-${o.id}`} className="text-sm cursor-pointer font-medium">{o.name}</label>
                    {o.clothing_description && <p className="text-xs text-gray-500 mt-1">{o.clothing_description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {leagues.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Sports teams</p>
            <div className="space-y-2">
              {leagues.map((g) => {
                const open = searching || expanded.includes(g.league);
                const ids = g.teams.map((t) => t.outfit.id);
                const chosen = ids.filter(isOn).length;
                const all = chosen === ids.length;
                return (
                  <div key={g.league} className="border rounded-lg">
                    <div
                      role="button"
                      aria-expanded={open}
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpanded((e) => (e.includes(g.league) ? e.filter((x) => x !== g.league) : [...e, g.league]))}
                    >
                      <div className="flex items-center space-x-3">
                        <span className={`transform transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
                        <span className="font-medium text-sm">{g.name}</span>
                        <span className="text-xs text-gray-400">{ids.length} team{ids.length === 1 ? '' : 's'}</span>
                        {chosen > 0 && (
                          <Badge variant="secondary" className="text-xs">{chosen} selected</Badge>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={(e) => { e.stopPropagation(); setMany(ids, !all); }}
                      >
                        {all ? 'None' : 'All'}
                      </Button>
                    </div>
                    {open && (
                      <div className="px-3 pb-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-1 ml-6">
                          {g.teams.map((t) => (
                            <div key={t.outfit.id} className="flex items-center space-x-2 p-2 border rounded">
                              <Checkbox
                                id={`${idPrefix}-${t.outfit.id}`}
                                checked={isOn(t.outfit.id)}
                                onCheckedChange={() => toggle(t.outfit.id)}
                              />
                              <span className="flex -space-x-1 flex-shrink-0" aria-hidden>
                                {t.colours.slice(0, 2).map((c) => (
                                  <span key={c.hex} className="w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: c.hex }} />
                                ))}
                              </span>
                              <label
                                htmlFor={`${idPrefix}-${t.outfit.id}`}
                                className="text-xs cursor-pointer leading-tight"
                                title={t.outfit.clothing_description || undefined}
                              >
                                {t.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {everyday.length === 0 && leagues.length === 0 && (
          <p className="text-xs text-gray-500 italic">No outfits match “{search}”.</p>
        )}
      </div>
    </div>
  );
}
