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
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import type { CoatCreate, AnimalType } from '@/lib/types';

export default function AddCoatPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CoatCreate & { animal_type: AnimalType }>({
    name: '',
    slug: '',
    description: '',
    animal_type: 'dog',
    hex_color: '#000000',
    pattern_type: 'solid',
    rarity: 'common',
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

      const response = await fetch('/api/coats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData),
      });

      if (!response.ok) {
        throw new Error('Failed to create coat');
      }

      router.push('/admin/coats');
    } catch (error) {
      alert('Failed to create coat: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link href="/admin/coats" className="flex items-center hover:text-purple-600">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Coats
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Coat</h1>
          <p className="text-gray-600 mt-2">Create a new coat color for AI prompt generation</p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Coat Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Coat Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Golden, Black and Tan"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="animal_type">Animal Type *</Label>
                  <Select value={formData.animal_type} onValueChange={(value: AnimalType) => setFormData({ ...formData, animal_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select animal type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dog">🐕 Dog</SelectItem>
                      <SelectItem value="cat">🐱 Cat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="slug">URL Slug (optional)</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="e.g., golden, black-and-tan (auto-generated if empty)"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the coat color and characteristics..."
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hex_color">Color *</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="hex_color"
                        type="color"
                        value={formData.hex_color}
                        onChange={(e) => setFormData({ ...formData, hex_color: e.target.value })}
                        className="w-16 h-10"
                      />
                      <Input
                        value={formData.hex_color}
                        onChange={(e) => setFormData({ ...formData, hex_color: e.target.value })}
                        placeholder="#000000"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="pattern_type">Pattern Type *</Label>
                    <Select value={formData.pattern_type} onValueChange={(value) => setFormData({ ...formData, pattern_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solid">Solid</SelectItem>
                        <SelectItem value="bi-color">Bi-color</SelectItem>
                        <SelectItem value="tri-color">Tri-color</SelectItem>
                        <SelectItem value="merle">Merle</SelectItem>
                        <SelectItem value="brindle">Brindle</SelectItem>
                        <SelectItem value="sable">Sable</SelectItem>
                        <SelectItem value="spotted">Spotted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="rarity">Rarity *</Label>
                    <Select value={formData.rarity} onValueChange={(value) => setFormData({ ...formData, rarity: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="common">Common</SelectItem>
                        <SelectItem value="uncommon">Uncommon</SelectItem>
                        <SelectItem value="rare">Rare</SelectItem>
                      </SelectContent>
                    </Select>
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
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active (visible for prompt generation)</Label>
              </div>

              {/* Submit */}
              <div className="flex space-x-4 pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Create Coat
                    </>
                  )}
                </Button>
                <Link href="/admin/coats">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}