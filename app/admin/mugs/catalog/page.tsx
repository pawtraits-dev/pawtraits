'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2, Save, X, Coffee, Eye, EyeOff, Upload, ImageIcon } from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import type { MugCatalogEntry, MugCatalogCreate, MugCatalogUpdate } from '@/lib/product-types';

interface FormData {
  type: 'zodiac' | 'breed';
  slug: string;
  name: string;
  sub_heading: string;
  description: string;
  description_short: string;
  catalog_image_url: string;
  catalog_image_public_id: string;
  animal_type: 'dog' | 'cat' | 'both' | '';
  is_active: boolean;
  sort_order: string;
}

const emptyForm: FormData = {
  type: 'zodiac',
  slug: '',
  name: '',
  sub_heading: '',
  description: '',
  description_short: '',
  catalog_image_url: '',
  catalog_image_public_id: '',
  animal_type: 'both',
  is_active: true,
  sort_order: '0',
};

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export default function MugCatalogAdminPage() {
  const [entries, setEntries] = useState<MugCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<MugCatalogEntry | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adminService = new AdminSupabaseService();

  useEffect(() => { loadEntries(); }, []);

  async function loadEntries() {
    setLoading(true);
    try {
      const data = await adminService.getMugCatalog(false);
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(entry: MugCatalogEntry) {
    setFormData({
      type: entry.type,
      slug: entry.slug,
      name: entry.name,
      sub_heading: entry.sub_heading,
      description: entry.description,
      description_short: entry.description_short || '',
      catalog_image_url: entry.catalog_image_url,
      catalog_image_public_id: entry.catalog_image_public_id,
      animal_type: entry.animal_type || 'both',
      is_active: entry.is_active,
      sort_order: entry.sort_order.toString(),
    });
    setImagePreview(entry.catalog_image_url || null);
    setEditingId(entry.id);
    setShowForm(true);
  }

  function handleNew() {
    setFormData(emptyForm);
    setImagePreview(null);
    setEditingId(null);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
    setImagePreview(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.catalog_image_url || !formData.catalog_image_public_id) {
      alert('Please upload a catalog image before saving.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type: formData.type,
        slug: formData.slug,
        name: formData.name,
        sub_heading: formData.sub_heading,
        description: formData.description,
        description_short: formData.description_short || undefined,
        catalog_image_url: formData.catalog_image_url,
        catalog_image_public_id: formData.catalog_image_public_id,
        animal_type: (formData.animal_type || undefined) as 'dog' | 'cat' | 'both' | undefined,
        is_active: formData.is_active,
        sort_order: parseInt(formData.sort_order) || 0,
      };

      if (editingId) {
        await adminService.updateMugCatalogEntry({ ...payload, id: editingId } as MugCatalogUpdate);
      } else {
        await adminService.createMugCatalogEntry(payload as MugCatalogCreate);
      }
      await loadEntries();
      cancelForm();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this catalog entry? This cannot be undone.')) return;
    await adminService.deleteMugCatalogEntry(id);
    await loadEntries();
  }

  async function toggleActive(entry: MugCatalogEntry) {
    await adminService.updateMugCatalogEntry({ id: entry.id, is_active: !entry.is_active });
    await loadEntries();
  }

  async function compressImageIfNeeded(file: File): Promise<File> {
    const MAX_BYTES = 4 * 1024 * 1024; // 4MB — Vercel limit is 4.5MB
    if (file.size <= MAX_BYTES) return file;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        const scale = Math.sqrt(MAX_BYTES / file.size);
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('Compression failed')); return; }
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.8
        );
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    setUploadingImage(true);
    try {
      const compressed = await compressImageIfNeeded(file);
      const fd = new FormData();
      fd.append('file', compressed);

      const res = await fetch('/api/admin/mugs/catalog/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }
      const { url, public_id } = await res.json();
      setFormData(p => ({ ...p, catalog_image_url: url, catalog_image_public_id: public_id }));
    } catch (err) {
      alert(`Image upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setImagePreview(null);
    } finally {
      setUploadingImage(false);
      // Reset file input so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Coffee className="w-7 h-7" /> Mug Catalog
          </h1>
          <p className="text-gray-600 mt-1">Manage zodiac and breed mug catalog entries ({entries.length} total)</p>
        </div>
        <Button onClick={handleNew} className="bg-gradient-to-r from-purple-600 to-blue-600">
          <Plus className="w-4 h-4 mr-2" /> Add Entry
        </Button>
      </div>

      {/* Right-panel preview modal */}
      {previewEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewEntry(null)}>
          <Card className="max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Right Panel Preview
                <Button variant="ghost" size="sm" onClick={() => setPreviewEntry(null)}><X className="w-4 h-4" /></Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="bg-white p-6 space-y-3">
              <div className="border-l-4 border-purple-600 pl-4">
                <p className="text-2xl font-bold text-purple-600 uppercase tracking-wide">{previewEntry.name}</p>
                <p className="text-sm font-bold text-gray-800 mt-1">{previewEntry.sub_heading}</p>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                {previewEntry.description_short || previewEntry.description}
              </p>
              {previewEntry.description_short && (
                <details className="text-xs text-gray-400">
                  <summary className="cursor-pointer">Full description</summary>
                  <p className="mt-2 text-gray-600">{previewEntry.description}</p>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <Card className="mb-8 border-2 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coffee className="w-5 h-5" />
              {editingId ? 'Edit Catalog Entry' : 'Add Catalog Entry'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Basic Info</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                    <Select value={formData.type} onValueChange={(v: 'zodiac' | 'breed') => setFormData(p => ({ ...p, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zodiac">Zodiac</SelectItem>
                        <SelectItem value="breed">Breed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <Input
                      value={formData.name}
                      onChange={e => setFormData(p => ({
                        ...p,
                        name: e.target.value,
                        slug: p.slug === generateSlug(p.name) || p.slug === '' ? generateSlug(e.target.value) : p.slug,
                      }))}
                      placeholder="Aries"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                    <Input
                      value={formData.slug}
                      onChange={e => setFormData(p => ({ ...p, slug: e.target.value }))}
                      placeholder="aries"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sub-heading *</label>
                    <Input
                      value={formData.sub_heading}
                      onChange={e => setFormData(p => ({ ...p, sub_heading: e.target.value }))}
                      placeholder="The Fearless Adventurer"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Animal Type</label>
                    <Select
                      value={formData.animal_type || 'both'}
                      onValueChange={(v: 'dog' | 'cat' | 'both') => setFormData(p => ({ ...p, animal_type: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Both</SelectItem>
                        <SelectItem value="dog">Dog only</SelectItem>
                        <SelectItem value="cat">Cat only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Content & Image</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description * <span className="text-gray-400 font-normal">(right panel full text)</span>
                    </label>
                    <Textarea
                      value={formData.description}
                      onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                      placeholder="Bold, brave and always first..."
                      rows={4}
                      required
                    />
                    <p className="text-xs text-gray-400 mt-1">{formData.description.length} chars</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description Short <span className="text-gray-400 font-normal">(≤250 chars, shown on catalog tile)</span>
                    </label>
                    <Textarea
                      value={formData.description_short}
                      onChange={e => setFormData(p => ({ ...p, description_short: e.target.value }))}
                      placeholder="Optional shorter version for catalog tile..."
                      rows={2}
                    />
                    <p className="text-xs text-gray-400 mt-1">{formData.description_short.length}/250</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Catalog Image * <span className="text-gray-400 font-normal">(reference scene for Gemini)</span>
                    </label>

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleImageUpload}
                    />

                    <div className="flex items-start gap-3">
                      {/* Thumbnail preview */}
                      <div className="w-20 h-20 rounded border-2 border-dashed border-gray-300 flex-shrink-0 overflow-hidden flex items-center justify-center bg-gray-50">
                        {imagePreview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-300" />
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingImage}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="w-3 h-3 mr-2" />
                          {uploadingImage ? 'Uploading…' : imagePreview ? 'Replace image' : 'Upload image'}
                        </Button>

                        {/* Read-only display of set values */}
                        {formData.catalog_image_url && (
                          <p className="text-xs text-gray-500 font-mono truncate max-w-xs" title={formData.catalog_image_public_id}>
                            {formData.catalog_image_public_id}
                          </p>
                        )}

                        {/* Hidden required inputs so form validation works */}
                        <input type="hidden" name="catalog_image_url" value={formData.catalog_image_url} required />
                        <input type="hidden" name="catalog_image_public_id" value={formData.catalog_image_public_id} required />
                        {!formData.catalog_image_url && (
                          <p className="text-xs text-amber-600">Image required — upload one above</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                      <Input
                        type="number"
                        value={formData.sort_order}
                        onChange={e => setFormData(p => ({ ...p, sort_order: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={e => setFormData(p => ({ ...p, is_active: e.target.checked }))}
                          className="w-4 h-4"
                        />
                        <span className="text-sm font-medium text-gray-700">Active</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={cancelForm}><X className="w-4 h-4 mr-2" />Cancel</Button>
                <Button type="submit" disabled={saving} className="bg-gradient-to-r from-purple-600 to-blue-600">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Entries table */}
      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Coffee className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No catalog entries yet</p>
              <p className="text-sm mt-1">Add your first mug catalog entry to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-4 font-medium text-gray-700">Entry</th>
                    <th className="text-left p-4 font-medium text-gray-700">Type</th>
                    <th className="text-left p-4 font-medium text-gray-700">Animal</th>
                    <th className="text-left p-4 font-medium text-gray-700">Status</th>
                    <th className="text-left p-4 font-medium text-gray-700">Sort</th>
                    <th className="text-right p-4 font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {entry.catalog_image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={entry.catalog_image_url}
                              alt={entry.name}
                              className="w-10 h-10 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{entry.name}</p>
                            <p className="text-xs text-gray-500">{entry.sub_heading}</p>
                            <p className="text-xs text-gray-400 font-mono">{entry.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant={entry.type === 'zodiac' ? 'default' : 'secondary'}>
                          {entry.type}
                        </Badge>
                      </td>
                      <td className="p-4 text-gray-600 capitalize">{entry.animal_type || '—'}</td>
                      <td className="p-4">
                        <button onClick={() => toggleActive(entry)} className="hover:opacity-70 transition-opacity">
                          <Badge variant={entry.is_active ? 'default' : 'secondary'}>
                            {entry.is_active ? <><Eye className="w-3 h-3 mr-1" />Active</> : <><EyeOff className="w-3 h-3 mr-1" />Inactive</>}
                          </Badge>
                        </button>
                      </td>
                      <td className="p-4 text-gray-600">{entry.sort_order}</td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setPreviewEntry(entry)} title="Preview right panel">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleEdit(entry)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDelete(entry.id)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </Button>
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
