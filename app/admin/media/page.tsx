'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Package,
  Star,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import type { Media, MediaCreate, MediaUpdate } from '@/lib/product-types';

interface MediaFormData {
  name: string;
  slug: string;
  description: string;
  category: string;
  material_type: string;
  finish_type: string;
  thickness_mm: string;
  indoor_outdoor: 'indoor' | 'outdoor' | 'both';
  uv_resistant: boolean;
  water_resistant: boolean;
  care_instructions: string;
  is_active: boolean;
  is_featured: boolean;
  gelato_category: string;
  base_cost_multiplier: string;
  meta_title: string;
  meta_description: string;
  preview_image_url: string;
  display_order: string;
}

export default function MediaManagementPage() {
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  const [formData, setFormData] = useState<MediaFormData>({
    name: '',
    slug: '',
    description: '',
    category: '',
    material_type: '',
    finish_type: '',
    thickness_mm: '',
    indoor_outdoor: 'indoor',
    uv_resistant: false,
    water_resistant: false,
    care_instructions: '',
    is_active: true,
    is_featured: false,
    gelato_category: '',
    base_cost_multiplier: '1.0',
    meta_title: '',
    meta_description: '',
    preview_image_url: '',
    display_order: '0'
  });

  const supabaseService = new AdminSupabaseService();

  const categories = [
    'canvas',
    'framed',
    'acrylic', 
    'metal',
    'paper',
    'wood',
    'ceramic',
    'fabric',
    'foam'
  ];

  const materialTypes = [
    'canvas',
    'paper',
    'acrylic',
    'aluminum',
    'metal',
    'wood',
    'ceramic',
    'fabric',
    'glass',
    'foam'
  ];

  const finishTypes = [
    'matte',
    'gloss',
    'satin',
    'textured',
    'brushed',
    'polished'
  ];

  useEffect(() => {
    loadMedia();
  }, []);

  const loadMedia = async () => {
    try {
      setLoading(true);
      const mediaList = await supabaseService.getMedia(false); // Show all media, not just active
      setMedia(mediaList || []);
    } catch (error) {
      console.error('Error loading media:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      name: value,
      slug: prev.slug === generateSlug(prev.name) || prev.slug === '' ? generateSlug(value) : prev.slug
    }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      category: '',
      material_type: '',
      finish_type: '',
      thickness_mm: '',
      indoor_outdoor: 'indoor',
      uv_resistant: false,
      water_resistant: false,
      care_instructions: '',
      is_active: true,
      is_featured: false,
      gelato_category: '',
      base_cost_multiplier: '1.0',
      meta_title: '',
      meta_description: '',
      preview_image_url: '',
      display_order: '0'
    });
  };

  const handleEdit = (medium: Media) => {
    setFormData({
      name: medium.name,
      slug: medium.slug,
      description: medium.description || '',
      category: medium.category,
      material_type: medium.material_type || '',
      finish_type: medium.finish_type || '',
      thickness_mm: medium.thickness_mm?.toString() || '',
      indoor_outdoor: medium.indoor_outdoor || 'indoor',
      uv_resistant: medium.uv_resistant,
      water_resistant: medium.water_resistant,
      care_instructions: medium.care_instructions || '',
      is_active: medium.is_active,
      is_featured: medium.is_featured,
      gelato_category: medium.gelato_category || '',
      base_cost_multiplier: medium.base_cost_multiplier.toString(),
      meta_title: medium.meta_title || '',
      meta_description: medium.meta_description || '',
      preview_image_url: medium.preview_image_url || '',
      display_order: medium.display_order.toString()
    });
    setEditingId(medium.id);
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const mediaData: MediaCreate | MediaUpdate = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description || undefined,
        category: formData.category,
        material_type: formData.material_type || undefined,
        finish_type: formData.finish_type || undefined,
        thickness_mm: formData.thickness_mm ? parseFloat(formData.thickness_mm) : undefined,
        indoor_outdoor: formData.indoor_outdoor,
        uv_resistant: formData.uv_resistant,
        water_resistant: formData.water_resistant,
        care_instructions: formData.care_instructions || undefined,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        gelato_category: formData.gelato_category || undefined,
        base_cost_multiplier: parseFloat(formData.base_cost_multiplier),
        meta_title: formData.meta_title || undefined,
        meta_description: formData.meta_description || undefined,
        preview_image_url: formData.preview_image_url || undefined,
        display_order: parseInt(formData.display_order)
      };

      if (editingId) {
        await supabaseService.updateMedia({ ...mediaData, id: editingId } as MediaUpdate);
      } else {
        await supabaseService.createMedia(mediaData as MediaCreate);
      }

      await loadMedia();
      resetForm();
      setEditingId(null);
      setShowAddForm(false);
    } catch (error) {
      console.error('Error saving media:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this media type? This will also delete all associated products.')) {
      return;
    }

    try {
      await supabaseService.deleteMedia(id);
      await loadMedia();
    } catch (error) {
      console.error('Error deleting media:', error);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowAddForm(false);
    resetForm();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Media Management</h1>
          <p className="text-gray-600 mt-2">
            Manage print media types (canvas, framed, acrylic, etc.)
          </p>
        </div>
        
        <Button
          onClick={() => {
            setShowAddForm(true);
            setEditingId(null);
            resetForm();
          }}
          className="bg-gradient-to-r from-purple-600 to-blue-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Media Type
        </Button>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingId) && (
        <Card className="mb-8 border-2 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="w-5 h-5 mr-2" />
              {editingId ? 'Edit Media Type' : 'Add New Media Type'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Basic Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name *
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Canvas Print"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Slug *
                    </label>
                    <Input
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="canvas-print"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Premium canvas print with gallery wrap finish"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category *
                    </label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category} value={category}>
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Material Properties */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Material Properties</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Material Type
                    </label>
                    <Select 
                      value={formData.material_type} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, material_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select material" />
                      </SelectTrigger>
                      <SelectContent>
                        {materialTypes.map(material => (
                          <SelectItem key={material} value={material}>
                            {material.charAt(0).toUpperCase() + material.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Finish Type
                    </label>
                    <Select 
                      value={formData.finish_type} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, finish_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select finish" />
                      </SelectTrigger>
                      <SelectContent>
                        {finishTypes.map(finish => (
                          <SelectItem key={finish} value={finish}>
                            {finish.charAt(0).toUpperCase() + finish.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Thickness (mm)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.thickness_mm}
                      onChange={(e) => setFormData(prev => ({ ...prev, thickness_mm: e.target.value }))}
                      placeholder="2.0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Indoor/Outdoor Use
                    </label>
                    <Select 
                      value={formData.indoor_outdoor} 
                      onValueChange={(value: 'indoor' | 'outdoor' | 'both') => 
                        setFormData(prev => ({ ...prev, indoor_outdoor: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indoor">Indoor Only</SelectItem>
                        <SelectItem value="outdoor">Outdoor Only</SelectItem>
                        <SelectItem value="both">Both Indoor & Outdoor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Durability & Features */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Durability & Features</h3>
                  
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.uv_resistant}
                        onChange={(e) => setFormData(prev => ({ ...prev, uv_resistant: e.target.checked }))}
                        className="mr-2"
                      />
                      UV Resistant
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.water_resistant}
                        onChange={(e) => setFormData(prev => ({ ...prev, water_resistant: e.target.checked }))}
                        className="mr-2"
                      />
                      Water Resistant
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Care Instructions
                    </label>
                    <Textarea
                      value={formData.care_instructions}
                      onChange={(e) => setFormData(prev => ({ ...prev, care_instructions: e.target.value }))}
                      placeholder="Clean with microfiber cloth and glass cleaner"
                      rows={2}
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                        className="mr-2"
                      />
                      Active
                    </label>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_featured}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_featured: e.target.checked }))}
                        className="mr-2"
                      />
                      Featured
                    </label>
                  </div>
                </div>

                {/* Business & SEO */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Business & SEO</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gelato Category
                    </label>
                    <Input
                      value={formData.gelato_category}
                      onChange={(e) => setFormData(prev => ({ ...prev, gelato_category: e.target.value }))}
                      placeholder="canvas"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Base Cost Multiplier
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.base_cost_multiplier}
                      onChange={(e) => setFormData(prev => ({ ...prev, base_cost_multiplier: e.target.value }))}
                      placeholder="1.0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Order
                    </label>
                    <Input
                      type="number"
                      value={formData.display_order}
                      onChange={(e) => setFormData(prev => ({ ...prev, display_order: e.target.value }))}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meta Title
                    </label>
                    <Input
                      value={formData.meta_title}
                      onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                      placeholder="Premium Canvas Prints - Custom Pet Pawtraits"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meta Description
                    </label>
                    <Textarea
                      value={formData.meta_description}
                      onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                      placeholder="High-quality canvas prints perfect for custom pet portraits..."
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t">
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-purple-600 to-blue-600">
                  <Save className="w-4 h-4 mr-2" />
                  {editingId ? 'Update' : 'Create'} Media Type
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Media List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {media.map((medium) => (
          <Card key={medium.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{medium.name}</h3>
                    <div className="flex space-x-1">
                      {medium.is_featured && (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          <Star className="w-3 h-3 mr-1" />
                          Featured
                        </Badge>
                      )}
                      <Badge variant={medium.is_active ? "default" : "secondary"}>
                        {medium.is_active ? (
                          <>
                            <Eye className="w-3 h-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3 mr-1" />
                            Inactive
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-2">{medium.description}</p>
                  <div className="text-sm text-gray-500">
                    Category: <span className="font-medium">{medium.category}</span>
                    {medium.material_type && (
                      <> • Material: <span className="font-medium">{medium.material_type}</span></>
                    )}
                    {medium.finish_type && (
                      <> • Finish: <span className="font-medium">{medium.finish_type}</span></>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(medium)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(medium.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Properties Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {medium.thickness_mm && (
                  <div>
                    <span className="text-gray-500">Thickness:</span>
                    <span className="ml-1 font-medium">{medium.thickness_mm}mm</span>
                  </div>
                )}
                
                {medium.indoor_outdoor && (
                  <div>
                    <span className="text-gray-500">Use:</span>
                    <span className="ml-1 font-medium capitalize">{medium.indoor_outdoor}</span>
                  </div>
                )}
                
                <div>
                  <span className="text-gray-500">Cost Multiplier:</span>
                  <span className="ml-1 font-medium">{medium.base_cost_multiplier}x</span>
                </div>
                
                <div>
                  <span className="text-gray-500">Display Order:</span>
                  <span className="ml-1 font-medium">{medium.display_order}</span>
                </div>
              </div>

              {/* Features */}
              <div className="flex flex-wrap gap-2 mt-4">
                {medium.uv_resistant && (
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    UV Resistant
                  </Badge>
                )}
                {medium.water_resistant && (
                  <Badge variant="secondary" className="text-xs">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Water Resistant
                  </Badge>
                )}
                {medium.gelato_category && (
                  <Badge variant="outline" className="text-xs">
                    Gelato: {medium.gelato_category}
                  </Badge>
                )}
              </div>

              {medium.care_instructions && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1">Care Instructions:</p>
                      <p className="text-xs text-gray-600">{medium.care_instructions}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {media.length === 0 && (
        <Card className="p-8 text-center">
          <CardContent>
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Media Types</h3>
            <p className="text-gray-600 mb-4">
              Get started by adding your first print media type (Canvas, Framed, Acrylic, etc.)
            </p>
            <Button 
              onClick={() => {
                setShowAddForm(true);
                resetForm();
              }}
              className="bg-gradient-to-r from-purple-600 to-blue-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Media Type
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}