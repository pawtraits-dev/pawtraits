'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Palette } from 'lucide-react';
import type { MugColour } from '@/lib/product-types';

export default function MugColoursAdminPage() {
  const [colours, setColours] = useState<MugColour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadColours(); }, []);

  async function loadColours() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/mugs/colours?activeOnly=false');
      if (res.ok) {
        setColours(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(colour: MugColour) {
    await fetch('/api/admin/mugs/colours', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: colour.id, is_active: !colour.is_active }),
    });
    await loadColours();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Palette className="w-7 h-7" /> Mug Colours
        </h1>
        <p className="text-gray-600 mt-1">
          Six Gelato mug colour variants. Hex values are fixed (tied to physical product variants).
          Only the <strong>active</strong> toggle is editable.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-700">Colour</th>
                  <th className="text-left p-4 font-medium text-gray-700">Slug</th>
                  <th className="text-left p-4 font-medium text-gray-700">Mug Hex</th>
                  <th className="text-left p-4 font-medium text-gray-700">Text Hex</th>
                  <th className="text-left p-4 font-medium text-gray-700">Overlay Hex</th>
                  <th className="text-left p-4 font-medium text-gray-700">Sort</th>
                  <th className="text-left p-4 font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {colours.map(colour => (
                  <tr key={colour.id} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {/* Mug colour swatch */}
                        <div
                          className="w-10 h-10 rounded-full border-2 border-gray-200 shadow-sm flex-shrink-0"
                          style={{ backgroundColor: `#${colour.hex}` }}
                        />
                        {/* Text colour preview */}
                        <div
                          className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: `#${colour.hex}`, color: `#${colour.text_hex}` }}
                          title={`Text: #${colour.text_hex}`}
                        >
                          Aa
                        </div>
                        <span className="font-medium text-gray-900">{colour.name}</span>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-gray-600">{colour.slug}</td>
                    <td className="p-4">
                      <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">#{colour.hex}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">#{colour.text_hex}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-xs">#{colour.overlay_hex}</span>
                    </td>
                    <td className="p-4 text-gray-600">{colour.sort_order}</td>
                    <td className="p-4">
                      <button
                        onClick={() => toggleActive(colour)}
                        className="hover:opacity-70 transition-opacity"
                        title={colour.is_active ? 'Click to deactivate' : 'Click to activate'}
                      >
                        <Badge variant={colour.is_active ? 'default' : 'secondary'}>
                          {colour.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {colours.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <Palette className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No colours found</p>
              <p className="text-sm mt-1">Run the mug migration SQL to seed the six Gelato colours.</p>
              <p className="text-xs mt-2 font-mono text-gray-400">tsx scripts/run-mug-migration.ts</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <strong>Note:</strong> Hex values match the six Gelato ceramic mug colour variants. They cannot be
        changed without updating the physical product SKUs. To add or remove colours, update the migration
        script and re-seed.
      </div>
    </div>
  );
}
