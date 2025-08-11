'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Plus, Edit, Trash2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import type { Style } from '@/lib/types';

export default function StylesManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadStyles();
  }, []);

  const loadStyles = async () => {
    try {
      setLoading(true);
      const data = await supabaseService.getStyles();
      setStyles(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load styles');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      const response = await fetch(`/api/styles/${id}`, { method: 'DELETE' });
      if (response.ok) {
        await loadStyles();
      } else {
        alert('Failed to delete style');
      }
    } catch (err) {
      alert('Failed to delete style');
    }
  };

  const filteredStyles = styles.filter((style) => {
    return (
      (searchTerm === '' || style.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === '' || 
        (statusFilter === 'active' && style.is_active) ||
        (statusFilter === 'inactive' && !style.is_active))
    );
  });

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
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
            <h1 className="text-3xl font-bold text-gray-900">✨ Styles Management</h1>
            <p className="text-gray-600 mt-2">Manage art styles for AI prompt generation</p>
          </div>
          <Link href="/admin/styles/new">
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add New Style
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
                  placeholder="Search styles..."
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
                  
                  <Button variant="outline" onClick={clearFilters} size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>

                <p className="text-sm text-gray-600">
                  Showing {filteredStyles.length} of {styles.length} styles
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Styles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStyles.map((style) => (
            <Card key={style.id} className="group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg group-hover:text-purple-600 transition-colors flex items-center">
                      <Sparkles className="w-5 h-5 mr-2 text-yellow-500" />
                      {style.name}
                    </CardTitle>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge variant={style.is_active ? 'default' : 'secondary'}>
                        {style.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge variant="outline">
                        Order #{style.sort_order}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 line-clamp-2">
                  {style.description}
                </p>
                
                {style.compatible_themes && style.compatible_themes.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">COMPATIBLE THEMES</p>
                    <div className="flex flex-wrap gap-1">
                      {style.compatible_themes.slice(0, 3).map((theme) => (
                        <Badge key={theme} variant="outline" className="text-xs bg-green-50 text-green-700">
                          {theme}
                        </Badge>
                      ))}
                      {style.compatible_themes.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{style.compatible_themes.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 mb-1">PROMPT SUFFIX</p>
                  <p className="text-xs text-gray-700 font-mono line-clamp-2">
                    {style.prompt_suffix}
                  </p>
                </div>

                {style.technical_parameters && Object.keys(style.technical_parameters).length > 0 && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-blue-700 mb-1">TECHNICAL PARAMETERS</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(style.technical_parameters).slice(0, 3).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="text-xs bg-blue-100 text-blue-800">
                          {key}: {String(value)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex space-x-2 pt-2">
                  <Link href={`/admin/styles/${style.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDelete(style.id, style.name)}
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
        {filteredStyles.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No styles found</h3>
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