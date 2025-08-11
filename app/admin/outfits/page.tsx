'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Plus, Edit, Trash2, Shirt } from 'lucide-react';
import Link from 'next/link';
import type { Outfit } from '@/lib/types';

export default function OutfitsManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [animalFilter, setAnimalFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOutfits();
  }, []);

  const loadOutfits = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/outfits');
      if (!response.ok) {
        throw new Error('Failed to fetch outfits');
      }
      const data = await response.json();
      setOutfits(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load outfits');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      const response = await fetch(`/api/outfits/${id}`, { method: 'DELETE' });
      if (response.ok) {
        await loadOutfits();
      } else {
        alert('Failed to delete outfit');
      }
    } catch (error) {
      alert('Failed to delete outfit');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/outfits/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      
      if (response.ok) {
        await loadOutfits();
      } else {
        alert('Failed to update outfit status');
      }
    } catch (error) {
      alert('Failed to update outfit status');
    }
  };

  // Filter and sort outfits
  const filteredOutfits = outfits
    .filter(outfit => {
      const matchesSearch = outfit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           outfit.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           outfit.clothing_description.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || statusFilter === '' || 
                           (statusFilter === 'active' && outfit.is_active) ||
                           (statusFilter === 'inactive' && !outfit.is_active);
      
      const matchesAnimal = animalFilter === 'all' || animalFilter === '' || 
                           outfit.animal_compatibility.includes(animalFilter as any);
      
      return matchesSearch && matchesStatus && matchesAnimal;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'sort_order':
          comparison = a.sort_order - b.sort_order;
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shirt className="w-8 h-8 text-purple-600" />
            Pet Outfits
          </h1>
          <p className="text-gray-600 mt-2">
            Manage clothing options for pet portraits
          </p>
        </div>
        <Link href="/admin/outfits/new">
          <Button className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" />
            Add New Outfit
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search outfits..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={animalFilter} onValueChange={setAnimalFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by animal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Animals</SelectItem>
                <SelectItem value="dog">Dogs</SelectItem>
                <SelectItem value="cat">Cats</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="sort_order">Sort Order</SelectItem>
                <SelectItem value="created_at">Created Date</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'} {sortOrder.toUpperCase()}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Outfits Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredOutfits.map((outfit) => (
          <Card key={outfit.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{outfit.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={outfit.is_active ? "default" : "secondary"}>
                    {outfit.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Description */}
              {outfit.description && (
                <p className="text-sm text-gray-600">{outfit.description}</p>
              )}
              
              {/* Clothing Description */}
              <div className="bg-purple-50 p-3 rounded-md">
                <p className="text-xs font-medium text-purple-700 mb-1">Prompt Description:</p>
                <p className="text-sm text-purple-900 italic">
                  {outfit.clothing_description || 'No outfit (natural look)'}
                </p>
              </div>

              {/* Color Scheme */}
              {outfit.color_scheme && outfit.color_scheme.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">Colors:</p>
                  <div className="flex flex-wrap gap-1">
                    {outfit.color_scheme.map((color, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {color}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Style Keywords */}
              {outfit.style_keywords && outfit.style_keywords.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-2">Style Keywords:</p>
                  <div className="flex flex-wrap gap-1">
                    {outfit.style_keywords.map((keyword, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Animal Compatibility */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Compatible with:</p>
                <div className="flex gap-1">
                  {outfit.animal_compatibility.map((animal, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {animal === 'dog' ? '🐕 Dogs' : '🐱 Cats'}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t">
                <div className="flex gap-2">
                  <Link href={`/admin/outfits/${outfit.id}`}>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleStatus(outfit.id, outfit.is_active)}
                  >
                    {outfit.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(outfit.id, outfit.name)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredOutfits.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Shirt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No outfits found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || (statusFilter !== 'all' && statusFilter !== '') || (animalFilter !== 'all' && animalFilter !== '')
                ? 'Try adjusting your filters to see more results.'
                : 'Get started by creating your first pet outfit.'}
            </p>
            <Link href="/admin/outfits/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add New Outfit
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}