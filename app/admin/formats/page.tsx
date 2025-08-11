'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Plus, Edit, Trash2, Layout } from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import type { Format } from '@/lib/types';

export default function FormatsManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [aspectRatioFilter, setAspectRatioFilter] = useState('');
  const [formats, setFormats] = useState<Format[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadFormats();
  }, []);

  const loadFormats = async () => {
    try {
      setLoading(true);
      const data = await supabaseService.getFormats();
      setFormats(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load formats');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      const response = await fetch(`/api/formats/${id}`, { method: 'DELETE' });
      if (response.ok) {
        await loadFormats();
      } else {
        alert('Failed to delete format');
      }
    } catch (err) {
      alert('Failed to delete format');
    }
  };

  // Get unique aspect ratios for filter
  const aspectRatios = Array.from(new Set(formats.map(f => f.aspect_ratio)));

  const filteredFormats = formats.filter((format) => {
    return (
      (searchTerm === '' || format.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === '' || 
        (statusFilter === 'active' && format.is_active) ||
        (statusFilter === 'inactive' && !format.is_active)) &&
      (aspectRatioFilter === '' || format.aspect_ratio === aspectRatioFilter)
    );
  });

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setAspectRatioFilter('');
  };

  const getAspectRatioColor = (ratio: string) => {
    switch (ratio) {
      case '1:1': return 'bg-blue-100 text-blue-800';
      case '4:5': return 'bg-green-100 text-green-800';
      case '16:9': return 'bg-purple-100 text-purple-800';
      case '9:16': return 'bg-orange-100 text-orange-800';
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
            <h1 className="text-3xl font-bold text-gray-900">📐 Formats Management</h1>
            <p className="text-gray-600 mt-2">Manage output formats for AI portrait generation</p>
          </div>
          <Link href="/admin/formats/new">
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add New Format
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
                  placeholder="Search formats..."
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

                  <Select value={aspectRatioFilter} onValueChange={setAspectRatioFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Aspect Ratio" />
                    </SelectTrigger>
                    <SelectContent>
                      {aspectRatios.map((ratio) => (
                        <SelectItem key={ratio} value={ratio}>
                          {ratio}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Button variant="outline" onClick={clearFilters} size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>

                <p className="text-sm text-gray-600">
                  Showing {filteredFormats.length} of {formats.length} formats
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Formats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFormats.map((format) => (
            <Card key={format.id} className="group hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg group-hover:text-purple-600 transition-colors flex items-center">
                      <Layout className="w-5 h-5 mr-2 text-blue-500" />
                      {format.name}
                    </CardTitle>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge variant={format.is_active ? 'default' : 'secondary'}>
                        {format.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge className={getAspectRatioColor(format.aspect_ratio)}>
                        {format.aspect_ratio}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 line-clamp-2">
                  {format.description || 'No description available'}
                </p>
                
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-xs font-medium text-green-700 mb-1">USE CASE</p>
                  <p className="text-sm text-green-800 font-medium">
                    {format.use_case}
                  </p>
                </div>


                {format.prompt_adjustments && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-gray-500 mb-1">PROMPT ADJUSTMENTS</p>
                    <p className="text-xs text-gray-700 font-mono line-clamp-2">
                      {format.prompt_adjustments}
                    </p>
                  </div>
                )}

                {format.midjourney_parameters && (
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-purple-700 mb-1">MIDJOURNEY PARAMETERS</p>
                    <p className="text-xs text-purple-800 font-mono line-clamp-1">
                      {format.midjourney_parameters}
                    </p>
                  </div>
                )}

                {format.technical_specs && Object.keys(format.technical_specs).length > 0 && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-blue-700 mb-1">TECHNICAL SPECS</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(format.technical_specs).slice(0, 2).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="text-xs bg-blue-100 text-blue-800">
                          {key}: {String(value)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex space-x-2 pt-2">
                  <Link href={`/admin/formats/${format.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </Link>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDelete(format.id, format.name)}
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
        {filteredFormats.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No formats found</h3>
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