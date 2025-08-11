'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { FormatCreate } from '@/lib/types';

export default function AddFormatPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormatCreate>({
    name: '',
    slug: '',
    description: '',
    aspect_ratio: '',
    use_case: '',
    prompt_adjustments: '',
    midjourney_parameters: '',
    technical_specs: {},
    is_active: true,
    sort_order: 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const finalData = {
        ...formData,
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      };

      const response = await fetch('/api/formats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData),
      });

      if (!response.ok) throw new Error('Failed to create format');
      router.push('/admin/formats');
    } catch (error) {
      alert('Failed to create format: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center space-x-4">
          <Link href="/admin/formats" className="flex items-center hover:text-purple-600">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Formats
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Format</h1>
          <p className="text-gray-600 mt-2">Create a new format for AI prompt generation</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Format Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="name">Format Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Square Portrait"
                  required
                />
              </div>

              <div>
                <Label htmlFor="aspect_ratio">Aspect Ratio *</Label>
                <Input
                  id="aspect_ratio"
                  value={formData.aspect_ratio}
                  onChange={(e) => setFormData({ ...formData, aspect_ratio: e.target.value })}
                  placeholder="e.g., 1:1, 16:9, 4:3"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the format and its best use cases..."
                  rows={3}
                  required
                />
              </div>

              <div>
                <Label htmlFor="use_case">Use Case</Label>
                <Input
                  id="use_case"
                  value={formData.use_case}
                  onChange={(e) => setFormData({ ...formData, use_case: e.target.value })}
                  placeholder="e.g., Social media, Print, Web"
                />
              </div>


              <div>
                <Label htmlFor="midjourney_parameters">Midjourney Parameters</Label>
                <Textarea
                  id="midjourney_parameters"
                  value={formData.midjourney_parameters}
                  onChange={(e) => setFormData({ ...formData, midjourney_parameters: e.target.value })}
                  placeholder="e.g., --ar 1:1 --s 250"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="sort_order">Sort Order</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <div className="flex space-x-4 pt-4">
                <Button type="submit" disabled={loading} className="bg-gradient-to-r from-purple-600 to-blue-600">
                  {loading ? 'Creating...' : 'Create Format'}
                </Button>
                <Link href="/admin/formats">
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}