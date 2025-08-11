'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InteractiveImageCard, { SimpleInteractiveImage } from '@/components/InteractiveImageCard';
import { RefreshCw, Heart, Eye, Share2, Users } from 'lucide-react';

interface SampleImage {
  id: string;
  filename: string;
  original_filename: string;
  public_url: string;
  description?: string;
  breed_name?: string;
  like_count: number;
  view_count: number;
  share_count: number;
}

interface Analytics {
  detailed_total_likes: number;
  detailed_total_views: number;
  detailed_total_shares: number;
  detailed_unique_users: number;
  detailed_unique_likers: number;
  detailed_unique_viewers: number;
  detailed_unique_sharers: number;
}

export default function InteractionsDemoPage() {
  const [images, setImages] = useState<SampleImage[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, Analytics>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load sample images from the API
  const loadImages = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/interactions/simple-test');
      const data = await response.json();
      
      if (data.success && data.results.images.sampleImages) {
        const imageData = data.results.images.sampleImages.map((img: any) => ({
          id: img.id,
          filename: img.filename,
          original_filename: img.filename,
          public_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/pet-images/images/${img.filename}`,
          description: `A beautiful AI-generated pet portrait`,
          breed_name: 'Yorkshire Terrier', // This would come from the database
          like_count: img.counts.likes || 0,
          view_count: img.counts.views || 0,
          share_count: img.counts.shares || 0
        }));
        
        setImages(imageData);
        
        // Load detailed analytics for each image
        for (const image of imageData) {
          try {
            const analyticsResponse = await fetch(`/api/interactions/record?imageId=${image.id}`);
            const analyticsData = await analyticsResponse.json();
            
            if (analyticsData.success && analyticsData.analytics) {
              setAnalytics(prev => ({
                ...prev,
                [image.id]: analyticsData.analytics
              }));
            }
          } catch (err) {
            console.warn(`Failed to load analytics for image ${image.id}:`, err);
          }
        }
      } else {
        setError(data.error || 'Failed to load images');
      }
    } catch (err) {
      console.error('Error loading images:', err);
      setError('Failed to connect to API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, []);

  const totalStats = images.reduce(
    (acc, img) => ({
      likes: acc.likes + (img.like_count || 0),
      views: acc.views + (img.view_count || 0),
      shares: acc.shares + (img.share_count || 0)
    }),
    { likes: 0, views: 0, shares: 0 }
  );

  const uniqueUsers = Object.values(analytics).reduce(
    (acc, data) => acc + (data.detailed_unique_users || 0),
    0
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading interactive images...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Demo</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadImages} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🐾 Interactive Images Demo
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Test the new user interactions tracking system with likes, shares, and views.
            All interactions are tracked in real-time with detailed analytics.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="flex items-center p-4">
              <Heart className="w-8 h-8 text-red-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{totalStats.likes}</p>
                <p className="text-sm text-gray-600">Total Likes</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-4">
              <Eye className="w-8 h-8 text-blue-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{totalStats.views}</p>
                <p className="text-sm text-gray-600">Total Views</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-4">
              <Share2 className="w-8 h-8 text-green-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{totalStats.shares}</p>
                <p className="text-sm text-gray-600">Total Shares</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center p-4">
              <Users className="w-8 h-8 text-purple-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">{uniqueUsers}</p>
                <p className="text-sm text-gray-600">Unique Users</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Demo Tabs */}
        <Tabs defaultValue="gallery" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="gallery">Interactive Gallery</TabsTrigger>
            <TabsTrigger value="simple">Simple Examples</TabsTrigger>
            <TabsTrigger value="analytics">Analytics View</TabsTrigger>
          </TabsList>

          <TabsContent value="gallery" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Full-Featured Interactive Cards</CardTitle>
                <CardDescription>
                  These cards include like buttons, share functionality, view tracking, and real-time updates.
                  Try interacting with them to see the system in action!
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {images.map((image) => (
                    <InteractiveImageCard
                      key={image.id}
                      imageId={image.id}
                      imageUrl={image.public_url}
                      filename={image.original_filename}
                      description={image.description}
                      breedName={image.breed_name}
                      className="w-full"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="simple" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Simple Interactive Images</CardTitle>
                <CardDescription>
                  Minimal implementation with just like functionality and view tracking.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {images.slice(0, 3).map((image) => (
                    <SimpleInteractiveImage
                      key={image.id}
                      imageId={image.id}
                      imageUrl={image.public_url}
                      alt={image.original_filename}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Analytics</CardTitle>
                <CardDescription>
                  Real-time analytics showing detailed engagement metrics for each image.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {images.map((image) => {
                    const imageAnalytics = analytics[image.id];
                    return (
                      <div key={image.id} className="border rounded-lg p-4">
                        <div className="flex items-center gap-4 mb-3">
                          <img
                            src={image.public_url}
                            alt={image.original_filename}
                            className="w-16 h-16 object-cover rounded"
                          />
                          <div>
                            <h4 className="font-semibold">{image.original_filename}</h4>
                            <p className="text-sm text-gray-600">{image.breed_name}</p>
                          </div>
                        </div>
                        
                        {imageAnalytics ? (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <Badge variant="outline" className="mb-1">Likes</Badge>
                              <p>Total: {imageAnalytics.detailed_total_likes}</p>
                              <p>Unique: {imageAnalytics.detailed_unique_likers}</p>
                            </div>
                            <div>
                              <Badge variant="outline" className="mb-1">Views</Badge>
                              <p>Total: {imageAnalytics.detailed_total_views}</p>
                              <p>Unique: {imageAnalytics.detailed_unique_viewers}</p>
                            </div>
                            <div>
                              <Badge variant="outline" className="mb-1">Shares</Badge>
                              <p>Total: {imageAnalytics.detailed_total_shares}</p>
                              <p>Unique: {imageAnalytics.detailed_unique_sharers}</p>
                            </div>
                            <div>
                              <Badge variant="outline" className="mb-1">Engagement</Badge>
                              <p>Users: {imageAnalytics.detailed_unique_users}</p>
                              <p>Rate: {imageAnalytics.detailed_total_likes > 0 ? 
                                ((imageAnalytics.detailed_unique_likers / imageAnalytics.detailed_unique_users) * 100).toFixed(1) : 0}%</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">Loading analytics...</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Refresh Button */}
        <div className="text-center mt-8">
          <Button onClick={loadImages} variant="outline" size="lg">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Data
          </Button>
        </div>

        {/* Technical Info */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">🎯 Features</h4>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• Real-time interaction tracking (likes, views, shares)</li>
                  <li>• Anonymous user support via session IDs</li>
                  <li>• Comprehensive analytics with unique user counting</li>
                  <li>• Platform-specific sharing analytics</li>
                  <li>• Automatic view tracking via intersection observer</li>
                  <li>• Optimistic UI updates for better UX</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">🛠️ Technical Stack</h4>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• Database: PostgreSQL with Row Level Security</li>
                  <li>• Backend: Next.js API routes with Supabase</li>
                  <li>• Frontend: React hooks with TypeScript</li>
                  <li>• Real-time: Automatic triggers and cached analytics</li>
                  <li>• Storage: Efficient indexing for high performance</li>
                  <li>• Security: Anonymous tracking with user privacy</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}