'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, ExternalLink, RefreshCw } from 'lucide-react';
import type { MugGeneration } from '@/lib/product-types';
import { AdminSupabaseService } from '@/lib/admin-supabase';

const STATUS_COLOURS: Record<string, string> = {
  pending:    'bg-gray-100 text-gray-700',
  generating: 'bg-blue-100 text-blue-700',
  complete:   'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-700',
  purchased:  'bg-purple-100 text-purple-700',
};

export default function MugGenerationsAdminPage() {
  const [generations, setGenerations] = useState<MugGeneration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', type: '', startDate: '', endDate: '' });

  const adminService = new AdminSupabaseService();

  useEffect(() => { loadGenerations(); }, []);

  async function loadGenerations() {
    setLoading(true);
    try {
      const data = await adminService.getMugGenerations({
        status: filters.status || undefined,
        type: filters.type || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      setGenerations(data);
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() { loadGenerations(); }
  function clearFilters() {
    setFilters({ status: '', type: '', startDate: '', endDate: '' });
    setTimeout(loadGenerations, 0);
  }

  const stats = {
    total: generations.length,
    complete: generations.filter(g => g.status === 'complete').length,
    failed: generations.filter(g => g.status === 'failed').length,
    purchased: generations.filter(g => g.status === 'purchased').length,
    avgMs: generations.filter(g => g.generation_time_ms).length > 0
      ? Math.round(generations.filter(g => g.generation_time_ms).reduce((s, g) => s + (g.generation_time_ms || 0), 0) / generations.filter(g => g.generation_time_ms).length)
      : 0,
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-7 h-7" /> Mug Generations
          </h1>
          <p className="text-gray-600 mt-1">Monitor Gemini generation activity and costs</p>
        </div>
        <Button variant="outline" onClick={loadGenerations} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, colour: 'text-gray-900' },
          { label: 'Complete', value: stats.complete, colour: 'text-green-600' },
          { label: 'Failed', value: stats.failed, colour: 'text-red-600' },
          { label: 'Purchased', value: stats.purchased, colour: 'text-purple-600' },
          { label: 'Avg time', value: stats.avgMs ? `${(stats.avgMs / 1000).toFixed(1)}s` : '—', colour: 'text-blue-600' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.colour}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <Select value={filters.status || 'all'} onValueChange={v => setFilters(p => ({ ...p, status: v === 'all' ? '' : v }))}>
                <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="generating">Generating</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="purchased">Purchased</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Catalog Type</label>
              <Select value={filters.type || 'all'} onValueChange={v => setFilters(p => ({ ...p, type: v === 'all' ? '' : v }))}>
                <SelectTrigger className="w-32"><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="zodiac">Zodiac</SelectItem>
                  <SelectItem value="breed">Breed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <Input type="date" value={filters.startDate} onChange={e => setFilters(p => ({ ...p, startDate: e.target.value }))} className="w-36" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <Input type="date" value={filters.endDate} onChange={e => setFilters(p => ({ ...p, endDate: e.target.value }))} className="w-36" />
            </div>

            <Button onClick={applyFilters} className="bg-purple-600 hover:bg-purple-700">Apply</Button>
            <Button variant="outline" onClick={clearFilters}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
            </div>
          ) : generations.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No generations found</p>
              <p className="text-sm mt-1">Mug generations will appear here once customers start personalising mugs.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-4 font-medium text-gray-700">Pet</th>
                    <th className="text-left p-4 font-medium text-gray-700">Catalog</th>
                    <th className="text-left p-4 font-medium text-gray-700">Colour</th>
                    <th className="text-left p-4 font-medium text-gray-700">Customer</th>
                    <th className="text-left p-4 font-medium text-gray-700">Status</th>
                    <th className="text-left p-4 font-medium text-gray-700">Time</th>
                    <th className="text-left p-4 font-medium text-gray-700">Created</th>
                    <th className="text-right p-4 font-medium text-gray-700">Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {generations.map((g: any) => (
                    <tr key={g.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <p className="font-medium text-gray-900">{g.pet_name}</p>
                        {g.session_id && <p className="text-xs text-gray-400">Guest</p>}
                      </td>
                      <td className="p-4">
                        {g.mug_catalog ? (
                          <div>
                            <p className="font-medium text-gray-800">{g.mug_catalog.name}</p>
                            <Badge variant="secondary" className="text-xs">{g.mug_catalog.type}</Badge>
                          </div>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="p-4">
                        {g.mug_colour ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full border border-gray-200"
                              style={{ backgroundColor: `#${g.mug_colour.hex}` }}
                            />
                            <span className="text-gray-700">{g.mug_colour.name}</span>
                          </div>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="p-4 text-gray-600 text-xs">
                        {g.user_profile?.email || g.session_id?.substring(0, 12) + '…' || '—'}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOURS[g.status] || 'bg-gray-100 text-gray-600'}`}>
                          {g.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600">
                        {g.generation_time_ms ? `${(g.generation_time_ms / 1000).toFixed(1)}s` : '—'}
                      </td>
                      <td className="p-4 text-gray-500 text-xs">
                        {new Date(g.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-1">
                          {g.composite_preview_url && (
                            <a href={g.composite_preview_url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" title="Preview">
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </a>
                          )}
                          {g.composite_print_url && (
                            <a href={g.composite_print_url} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" title="Full print" className="text-purple-600">
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
