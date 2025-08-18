'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Edit, 
  Eye, 
  EyeOff, 
  Trash2, 
  Images,
  Settings,
  Monitor,
  Dog,
  Cat,
  Palette
} from 'lucide-react';
import Link from 'next/link';
import { SupabaseService } from '@/lib/supabase';
import { CarouselManagementView, PageType } from '@/lib/carousel-types';

export default function CarouselManagementPage() {
  const [carousels, setCarousels] = useState<CarouselManagementView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadCarousels();
  }, []);

  const loadCarousels = async () => {
    try {
      setLoading(true);
      // This will be implemented in the API
      const response = await fetch('/api/admin/carousels');
      if (!response.ok) throw new Error('Failed to load carousels');
      
      const data = await response.json();
      setCarousels(data.carousels || []);
    } catch (err) {
      console.error('Error loading carousels:', err);
      setError(err instanceof Error ? err.message : 'Failed to load carousels');
    } finally {
      setLoading(false);
    }
  };

  const toggleCarouselStatus = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/carousels/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (!response.ok) throw new Error('Failed to update carousel');
      
      await loadCarousels(); // Refresh the list
    } catch (err) {
      console.error('Error updating carousel:', err);
      setError(err instanceof Error ? err.message : 'Failed to update carousel');
    }
  };

  const getPageIcon = (pageType: PageType) => {
    switch (pageType) {
      case 'home': return <Monitor className="w-4 h-4" />;
      case 'dogs': return <Dog className="w-4 h-4" />;
      case 'cats': return <Cat className="w-4 h-4" />;
      case 'themes': return <Palette className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  const getPageTypeColor = (pageType: PageType) => {
    switch (pageType) {
      case 'home': return 'bg-blue-100 text-blue-800';
      case 'dogs': return 'bg-orange-100 text-orange-800';
      case 'cats': return 'bg-purple-100 text-purple-800';
      case 'themes': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Carousel Management</h1>
            <p className="text-gray-600 mt-2">
              Manage carousels for home, dogs, cats, and themes pages
            </p>
          </div>
          <Link href="/admin/carousels/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Carousel
            </Button>
          </Link>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {carousels.map((carousel) => (
          <Card key={carousel.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge 
                  className={`${getPageTypeColor(carousel.page_type)} flex items-center gap-1`}
                >
                  {getPageIcon(carousel.page_type)}
                  {carousel.page_type?.charAt(0).toUpperCase() + carousel.page_type?.slice(1) || 'Unknown'}
                </Badge>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCarouselStatus(carousel.id, carousel.is_active)}
                    className={`p-1 rounded ${
                      carousel.is_active 
                        ? 'text-green-600 hover:bg-green-50' 
                        : 'text-gray-400 hover:bg-gray-50'
                    }`}
                    title={carousel.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {carousel.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <CardTitle className="text-xl">{carousel.name}</CardTitle>
              {carousel.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{carousel.description}</p>
              )}
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Total Slides:</span>
                  <span className="ml-2">{carousel.slide_count}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Active:</span>
                  <span className="ml-2">{carousel.active_slide_count}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Auto Play:</span>
                  <span className="ml-2">{carousel.auto_play_interval / 1000}s</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Thumbnails:</span>
                  <span className="ml-2">{carousel.show_thumbnails ? 'Yes' : 'No'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Link href={`/admin/carousels/${carousel.id}`}>
                    <Button size="sm" variant="outline">
                      <Images className="w-4 h-4 mr-1" />
                      Slides
                    </Button>
                  </Link>
                  <Button size="sm" variant="outline" disabled>
                    <Settings className="w-4 h-4 mr-1" />
                    Settings
                  </Button>
                </div>
                
                <div className={`text-xs px-2 py-1 rounded ${
                  carousel.is_active 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {carousel.is_active ? 'Active' : 'Inactive'}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {carousels.length === 0 && !loading && (
          <div className="col-span-full text-center py-12">
            <Images className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No carousels found</h3>
            <p className="text-gray-600 mb-4">Get started by creating your first carousel</p>
            <Link href="/admin/carousels/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create First Carousel
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {carousels.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {carousels.length}
                </div>
                <div className="text-sm text-gray-600">Total Carousels</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {carousels.filter(c => c.is_active).length}
                </div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {carousels.reduce((sum, c) => sum + c.slide_count, 0)}
                </div>
                <div className="text-sm text-gray-600">Total Slides</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {carousels.reduce((sum, c) => sum + c.active_slide_count, 0)}
                </div>
                <div className="text-sm text-gray-600">Active Slides</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}