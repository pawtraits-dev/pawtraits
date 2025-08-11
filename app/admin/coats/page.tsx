'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Plus, Edit, Trash2, Palette } from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import type { Coat, AnimalType } from '@/lib/types';

export default function CoatsManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [animalTypeFilter, setAnimalTypeFilter] = useState<AnimalType | ''>('');
  const [patternFilter, setPatternFilter] = useState('');
  const [rarityFilter, setRarityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [coats, setCoats] = useState<Coat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadCoats();
  }, [animalTypeFilter]);

  const loadCoats = async () => {
    try {
      setLoading(true);
      const data = await supabaseService.getCoats(animalTypeFilter || undefined);
      setCoats(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load coats');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      const response = await fetch(`/api/coats/${id}`, { method: 'DELETE' });
      if (response.ok) {
        await loadCoats();
      } else {
        alert('Failed to delete coat');
      }
    } catch (err) {
      alert('Failed to delete coat');
    }
  };

  const filteredCoats = coats.filter((coat) => {
    return (
      (searchTerm === '' || coat.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (patternFilter === '' || coat.pattern_type === patternFilter) &&
      (rarityFilter === '' || coat.rarity === rarityFilter) &&
      (statusFilter === '' || 
        (statusFilter === 'active' && coat.is_active) ||
        (statusFilter === 'inactive' && !coat.is_active))
    );
  });

  const clearFilters = () => {
    setSearchTerm('');
    setPatternFilter('');
    setRarityFilter('');
    setStatusFilter('');
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'bg-green-100 text-green-800';
      case 'uncommon': return 'bg-yellow-100 text-yellow-800';
      case 'rare': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPatternColor = (pattern: string) => {
    switch (pattern) {
      case 'solid': return 'bg-blue-100 text-blue-800';
      case 'bi-color': return 'bg-purple-100 text-purple-800';
      case 'tri-color': return 'bg-indigo-100 text-indigo-800';
      case 'merle': return 'bg-pink-100 text-pink-800';
      case 'brindle': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="text-center text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🎨 Coat Colors Management</h1>
            <p className="text-gray-600 mt-2">Manage dog and cat coat colors and patterns for AI prompt generation</p>
          </div>
          <Link href="/admin/coats/new">
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add New Coat
            </Button>
          </Link>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search coats..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter Row */}
              <div className="flex justify-between items-center">
                <div className="flex space-x-4">
                  <Select value={animalTypeFilter} onValueChange={(value) => setAnimalTypeFilter(value as AnimalType | '')}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Animal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dog">🐕 Dogs</SelectItem>
                      <SelectItem value="cat">🐱 Cats</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={patternFilter} onValueChange={setPatternFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Pattern" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solid">Solid</SelectItem>
                      <SelectItem value="bi-color">Bi-color</SelectItem>
                      <SelectItem value="tri-color">Tri-color</SelectItem>
                      <SelectItem value="merle">Merle</SelectItem>
                      <SelectItem value="brindle">Brindle</SelectItem>
                      <SelectItem value="sable">Sable</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={rarityFilter} onValueChange={setRarityFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Rarity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="common">Common</SelectItem>
                      <SelectItem value="uncommon">Uncommon</SelectItem>
                      <SelectItem value="rare">Rare</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button variant="outline" onClick={clearFilters} size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>

                <p className="text-sm text-gray-600">
                  Showing {filteredCoats.length} of {coats.length} coats
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Coats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCoats.map((coat) => (
            <Card key={coat.id} className="group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-6 h-6 rounded-full border border-gray-300"
                      style={{ backgroundColor: coat.hex_color }}
                    ></div>
                    <div>
                      <CardTitle className="text-lg group-hover:text-purple-600 transition-colors">
                        {coat.name}
                      </CardTitle>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant="outline">
                          {coat.animal_type === 'dog' ? '🐕 Dog' : '🐱 Cat'}
                        </Badge>
                        <Badge variant={coat.is_active ? 'default' : 'secondary'}>
                          {coat.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge className={getRarityColor(coat.rarity)}>
                          {coat.rarity}
                        </Badge>
                        <Badge className={getPatternColor(coat.pattern_type)}>
                          {coat.pattern_type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Hero Image Display */}
                {coat.hero_image_url && (
                  <div className="rounded-lg overflow-hidden">
                    <img 
                      src={coat.hero_image_url}
                      alt={coat.hero_image_alt || `${coat.name} hero image`}
                      className="w-full h-32 object-cover"
                    />
                  </div>
                )}
                <p className="text-sm text-gray-600 line-clamp-3">
                  {coat.description}
                </p>
                
                <div className="text-xs text-gray-500">
                  <p>Hex: {coat.hex_color}</p>
                  <p>Sort: {coat.sort_order}</p>
                </div>

                <div className="flex space-x-2 pt-2">
                  <Link href={`/admin/coats/${coat.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDelete(coat.id, coat.name)}
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
        {filteredCoats.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Palette className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No coats found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
            <Button onClick={clearFilters} variant="outline">
              Clear all filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}