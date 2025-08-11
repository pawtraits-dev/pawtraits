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
import type { Theme } from '@/lib/types';

export default function ThemesManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    try {
      setLoading(true);
      const data = await supabaseService.getThemes();
      setThemes(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      const response = await fetch(`/api/themes/${id}`, { method: 'DELETE' });
      if (response.ok) {
        await loadThemes();
      } else {
        alert('Failed to delete theme');
      }
    } catch (err) {
      alert('Failed to delete theme');
    }
  };

  const filteredThemes = themes.filter((theme) => {
    return (
      (searchTerm === '' || theme.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === '' || 
        (statusFilter === 'active' && theme.is_active) ||
        (statusFilter === 'inactive' && !theme.is_active)) &&
      (difficultyFilter === '' || theme.difficulty_level.toString() === difficultyFilter)
    );
  });

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setDifficultyFilter('');
  };

  const getDifficultyColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-green-100 text-green-800';
      case 2: return 'bg-yellow-100 text-yellow-800';
      case 3: return 'bg-orange-100 text-orange-800';
      case 4: return 'bg-red-100 text-red-800';
      case 5: return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDifficultyLabel = (level: number) => {
    switch (level) {
      case 1: return 'Very Easy';
      case 2: return 'Easy';
      case 3: return 'Medium';
      case 4: return 'Hard';
      case 5: return 'Very Hard';
      default: return 'Unknown';
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
            <h1 className="text-3xl font-bold text-gray-900">🎨 Themes Management</h1>
            <p className="text-gray-600 mt-2">Manage portrait themes for AI prompt generation</p>
          </div>
          <Link href="/admin/themes/new">
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add New Theme
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
                  placeholder="Search themes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter Row */}
              <div className="flex justify-between items-center">
                <div className="flex space-x-4">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Very Easy</SelectItem>
                      <SelectItem value="2">Easy</SelectItem>
                      <SelectItem value="3">Medium</SelectItem>
                      <SelectItem value="4">Hard</SelectItem>
                      <SelectItem value="5">Very Hard</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Button variant="outline" onClick={clearFilters} size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>

                <p className="text-sm text-gray-600">
                  Showing {filteredThemes.length} of {themes.length} themes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Themes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredThemes.map((theme) => (
            <Card key={theme.id} className="group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg group-hover:text-purple-600 transition-colors flex items-center">
                      <Palette className="w-5 h-5 mr-2 text-purple-500" />
                      {theme.name}
                    </CardTitle>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge variant={theme.is_active ? 'default' : 'secondary'}>
                        {theme.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge className={getDifficultyColor(theme.difficulty_level)}>
                        {getDifficultyLabel(theme.difficulty_level)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Hero Image Display */}
                {theme.hero_image_url && (
                  <div className="rounded-lg overflow-hidden">
                    <img 
                      src={theme.hero_image_url}
                      alt={theme.hero_image_alt || `${theme.name} hero image`}
                      className="w-full h-32 object-cover"
                    />
                  </div>
                )}
                <p className="text-sm text-gray-600 line-clamp-2">
                  {theme.description}
                </p>
                
                {theme.style_keywords && theme.style_keywords.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">STYLE KEYWORDS</p>
                    <div className="flex flex-wrap gap-1">
                      {theme.style_keywords.slice(0, 4).map((keyword) => (
                        <Badge key={keyword} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                      {theme.style_keywords.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{theme.style_keywords.length - 4} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 mb-1">PROMPT TEMPLATE</p>
                  <p className="text-xs text-gray-700 font-mono line-clamp-2">
                    {theme.base_prompt_template}
                  </p>
                </div>

                <div className="flex space-x-2 pt-2">
                  <Link href={`/admin/themes/${theme.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDelete(theme.id, theme.name)}
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
        {filteredThemes.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No themes found</h3>
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