'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import type { Format, FormatUpdate } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EditFormatPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditFormatPage({ params }: EditFormatPageProps) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  return <EditFormatPageClient id={id} />;
}

function EditFormatPageClient({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [format, setFormat] = useState<Format | null>(null);
  const [formData, setFormData] = useState<FormatUpdate>({});
  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadFormat(id);
  }, [id]);

  const loadFormat = async (formatId: string) => {
    try {
      setLoading(true);
      const data = await supabaseService.getFormat(formatId);
      setFormat(data);
      setFormData({
        name: data.name,
        slug: data.slug,
        description: data.description,
        aspect_ratio: data.aspect_ratio,
        use_case: data.use_case,
        prompt_adjustments: data.prompt_adjustments,
        midjourney_parameters: data.midjourney_parameters,
        technical_specs: data.technical_specs || {},
        is_active: data.is_active,
        sort_order: data.sort_order
      });
    } catch (error) {
      alert('Failed to load format');
      router.push('/admin/formats');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/formats/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to update format');
      router.push('/admin/formats');
    } catch (error) {
      alert('Failed to update format: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!format || !confirm(`Delete "${format.name}"?`)) return;

    try {
      const response = await fetch(`/api/formats/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete format');
      router.push('/admin/formats');
    } catch (error) {
      alert('Failed to delete format');
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 p-8"><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div></div></div>;
  if (!format) return <div className="min-h-screen bg-gray-50 p-8"><div className="text-center text-red-600">Format not found</div></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/admin/formats" className="flex items-center hover:text-purple-600">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Formats
          </Link>
          <Button onClick={handleDelete} variant="outline" className="text-red-600">
            <Trash2 className="w-4 h-4 mr-2" />Delete
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Format: {format.name}</h1>
        </div>

        <Card>
          <CardHeader><CardTitle>Format Details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name">Format Name *</Label>
                <Input id="name" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="aspect_ratio">Aspect Ratio *</Label>
                <Input id="aspect_ratio" value={formData.aspect_ratio || ''} onChange={(e) => setFormData({ ...formData, aspect_ratio: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea id="description" value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} required />
              </div>
              <div>
                <Label htmlFor="use_case">Use Case</Label>
                <Input id="use_case" value={formData.use_case || ''} onChange={(e) => setFormData({ ...formData, use_case: e.target.value })} />
              </div>

              <div>
                <Label htmlFor="midjourney_parameters">Midjourney Parameters</Label>
                <Textarea id="midjourney_parameters" value={formData.midjourney_parameters || ''} onChange={(e) => setFormData({ ...formData, midjourney_parameters: e.target.value })} rows={2} />
              </div>
              <div>
                <Label htmlFor="sort_order">Sort Order</Label>
                <Input id="sort_order" type="number" value={formData.sort_order || 0} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex space-x-4 pt-4">
                <Button type="submit" disabled={saving} className="bg-gradient-to-r from-purple-600 to-blue-600">
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Link href="/admin/formats"><Button type="button" variant="outline">Cancel</Button></Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}