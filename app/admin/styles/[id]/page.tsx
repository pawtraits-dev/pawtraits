'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import type { Style, StyleUpdate } from '@/lib/types';

interface EditStylePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditStylePage({ params }: EditStylePageProps) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  return <EditStylePageClient id={id} />;
}

function EditStylePageClient({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [style, setStyle] = useState<Style | null>(null);
  const [formData, setFormData] = useState<StyleUpdate>({});
  const [technicalParamsText, setTechnicalParamsText] = useState('');
  const [imageError, setImageError] = useState(false);
  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadStyle(id);
  }, [id]);

  const loadStyle = async (styleId: string) => {
    try {
      setLoading(true);
      const data = await supabaseService.getStyle(styleId);
      setStyle(data);
      setFormData({
        name: data.name,
        slug: data.slug,
        description: data.description,
        prompt_suffix: data.prompt_suffix,
        technical_parameters: data.technical_parameters || {},
        compatible_themes: data.compatible_themes || [],
        midjourney_sref: data.midjourney_sref || '',
        reference_image_url: data.reference_image_url || '',
        is_active: data.is_active,
        sort_order: data.sort_order
      });
      
      // Initialize technical parameters text
      setTechnicalParamsText(
        data.technical_parameters && Object.keys(data.technical_parameters).length > 0
          ? JSON.stringify(data.technical_parameters, null, 2)
          : ''
      );
    } catch (error) {
      alert('Failed to load style');
      router.push('/admin/styles');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Parse technical parameters from JSON string
      let parsedTechnicalParams = {};
      if (technicalParamsText.trim()) {
        try {
          parsedTechnicalParams = JSON.parse(technicalParamsText);
        } catch (parseError) {
          alert('Invalid JSON format for technical parameters');
          setSaving(false);
          return;
        }
      }

      const finalData = {
        ...formData,
        slug: formData.slug || formData.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        compatible_themes: formData.compatible_themes?.filter(theme => theme.trim() !== '') || [],
        technical_parameters: parsedTechnicalParams,
        midjourney_sref: formData.midjourney_sref?.trim() || null,
        reference_image_url: formData.reference_image_url?.trim() || null
      };

      const response = await fetch(`/api/styles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData),
      });

      if (!response.ok) throw new Error('Failed to update style');
      router.push('/admin/styles');
    } catch (error) {
      alert('Failed to update style: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!style || !confirm(`Delete "${style.name}"?`)) return;

    try {
      const response = await fetch(`/api/styles/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete style');
      router.push('/admin/styles');
    } catch (error) {
      alert('Failed to delete style');
    }
  };

  if (loading) return <div className="min-h-screen bg-gray-50 p-8"><div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div></div></div>;
  if (!style) return <div className="min-h-screen bg-gray-50 p-8"><div className="text-center text-red-600">Style not found</div></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/admin/styles" className="flex items-center hover:text-purple-600">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Styles
          </Link>
          <Button onClick={handleDelete} variant="outline" className="text-red-600">
            <Trash2 className="w-4 h-4 mr-2" />Delete
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Style: {style.name}</h1>
        </div>

        <Card>
          <CardHeader><CardTitle>Style Details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name">Style Name *</Label>
                <Input id="name" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea id="description" value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} required />
              </div>
              <div>
                <Label htmlFor="prompt_suffix">Prompt Suffix *</Label>
                <Textarea id="prompt_suffix" value={formData.prompt_suffix || ''} onChange={(e) => setFormData({ ...formData, prompt_suffix: e.target.value })} rows={2} required />
              </div>

              {/* Technical Parameters */}
              <div>
                <Label htmlFor="technical_parameters">Technical Parameters (JSON)</Label>
                <Textarea
                  id="technical_parameters"
                  value={technicalParamsText}
                  onChange={(e) => setTechnicalParamsText(e.target.value)}
                  placeholder='{"quality": "high", "style": "detailed", "lighting": "natural"}'
                  rows={4}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Enter valid JSON format for technical parameters (optional)
                </p>
              </div>

              {/* Midjourney Style Ref */}
              <div>
                <Label htmlFor="midjourney_sref">Midjourney Style Reference (--sref)</Label>
                <Input
                  id="midjourney_sref"
                  value={formData.midjourney_sref || ''}
                  onChange={(e) => setFormData({ ...formData, midjourney_sref: e.target.value })}
                  placeholder="https://example.com/style-ref-image.jpg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  URL for Midjourney style reference (optional)
                </p>
              </div>

              {/* Reference Image URL */}
              <div>
                <Label htmlFor="reference_image_url">Reference Image URL</Label>
                <Input
                  id="reference_image_url"
                  value={formData.reference_image_url || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, reference_image_url: e.target.value });
                    setImageError(false);
                  }}
                  placeholder="https://example.com/reference-image.jpg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  URL to reference image that will be displayed (optional)
                </p>
                
                {/* Image Preview */}
                {formData.reference_image_url && !imageError && (
                  <div className="mt-3">
                    <img
                      src={formData.reference_image_url}
                      alt="Reference preview"
                      className="max-w-full h-32 object-cover rounded border"
                      onError={() => setImageError(true)}
                    />
                  </div>
                )}
                
                {imageError && formData.reference_image_url && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                    Failed to load image from URL
                  </div>
                )}
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
                <Link href="/admin/styles"><Button type="button" variant="outline">Cancel</Button></Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}