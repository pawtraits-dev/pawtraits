'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Plus, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { SupabaseService } from '@/lib/supabase';
import type { Breed, AnimalType } from '@/lib/types';

export default function BreedsManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [animalTypeFilter, setAnimalTypeFilter] = useState<AnimalType | ''>('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadBreeds();
  }, [animalTypeFilter]);

  const loadBreeds = async () => {
    try {
      setLoading(true);
      const data = await supabaseService.getBreeds(animalTypeFilter || undefined);
      setBreeds(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load breeds');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      await supabaseService.deleteBreed(id);
      await loadBreeds(); // Refresh the list
    } catch (err) {
      alert('Failed to delete breed');
    }
  };

  const filteredAndSortedBreeds = breeds
    .filter((breed) => {
      return (
        (searchTerm === '' || breed.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (statusFilter === '' || 
          (statusFilter === 'active' && breed.is_active) ||
          (statusFilter === 'inactive' && !breed.is_active)) &&
        (animalTypeFilter === '' || breed.animal_type === animalTypeFilter)
      );
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'popularity':
          aValue = a.popularity_rank || 999;
          bValue = b.popularity_rank || 999;
          break;
        case 'created':
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
          break;
        case 'updated':
          aValue = new Date(a.updated_at);
          bValue = new Date(b.updated_at);
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setAnimalTypeFilter('');
    setSortBy('name');
    setSortOrder('asc');
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
            <h1 className="text-3xl font-bold text-gray-900">🐕🐱 Breeds Management</h1>
            <p className="text-gray-600 mt-2">Manage dog and cat breeds for AI prompt generation</p>
          </div>
          <Link href="/admin/breeds/new">
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add New Breed
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
                  placeholder="Search breeds..."
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

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="popularity">Popularity Rank</SelectItem>
                      <SelectItem value="created">Date Created</SelectItem>
                      <SelectItem value="updated">Date Updated</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3"
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </Button>
                  
                  <Button variant="outline" onClick={clearFilters} size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Clear All
                  </Button>
                </div>

                <p className="text-sm text-gray-600">
                  Showing {filteredAndSortedBreeds.length} of {breeds.length} breeds
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Breeds Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedBreeds.map((breed) => (
            <Card key={breed.id} className="group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg group-hover:text-purple-600 transition-colors">
                      {breed.name}
                    </CardTitle>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge variant="outline">
                        {breed.animal_type === 'dog' ? '🐕 Dog' : '🐱 Cat'}
                      </Badge>
                      <Badge variant={breed.is_active ? 'default' : 'secondary'}>
                        {breed.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      {breed.popularity_rank && (
                        <Badge variant="outline">
                          Rank #{breed.popularity_rank}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Hero Image Display */}
                {breed.hero_image_url && (
                  <div className="rounded-lg overflow-hidden">
                    <img 
                      src={breed.hero_image_url}
                      alt={breed.hero_image_alt || `${breed.name} hero image`}
                      className="w-full h-32 object-contain bg-gray-50"
                    />
                  </div>
                )}
                <div className="text-sm text-gray-600 line-clamp-3 prose prose-gray prose-sm max-w-none">
                  <ReactMarkdown>{breed.description}</ReactMarkdown>
                </div>
                
                {breed.personality_traits && breed.personality_traits.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">PERSONALITY TRAITS</p>
                    <div className="flex flex-wrap gap-1">
                      {breed.personality_traits.slice(0, 3).map((trait) => (
                        <Badge key={trait} variant="outline" className="text-xs">
                          {trait}
                        </Badge>
                      ))}
                      {breed.personality_traits.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{breed.personality_traits.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex space-x-2 pt-2">
                  <Link href={`/admin/breeds/${breed.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDelete(breed.id, breed.name)}
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
        {filteredAndSortedBreeds.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No breeds found</h3>
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