'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Wand2,
  CreditCard,
  Image as ImageIcon,
  Users,
  TrendingUp,
  Search,
  Plus,
  Minus,
  Eye,
  Check,
  X,
  RefreshCw
} from 'lucide-react';

interface CustomerCredit {
  id: string;
  customer_id: string;
  credits_remaining: number;
  credits_purchased: number;
  credits_used: number;
  free_trial_credits_granted: number;
  total_generations: number;
  last_generation_date: string | null;
  created_at: string;
  customer_email?: string;
  customer_name?: string;
}

interface GeneratedImage {
  id: string;
  customer_id: string;
  original_image_id: string | null;
  cloudinary_public_id: string;
  public_url: string;
  prompt_text: string;
  is_multi_animal: boolean;
  generation_cost_credits: number;
  is_purchased: boolean;
  purchased_at: string | null;
  created_at: string;
  customer_email?: string;
  customer_name?: string;
}

interface Stats {
  totalCustomers: number;
  totalCreditsIssued: number;
  totalCreditsUsed: number;
  totalGenerations: number;
  totalRevenue: number;
}

export default function CustomerCustomizationsAdmin() {
  const [stats, setStats] = useState<Stats>({
    totalCustomers: 0,
    totalCreditsIssued: 0,
    totalCreditsUsed: 0,
    totalGenerations: 0,
    totalRevenue: 0
  });
  const [customerCredits, setCustomerCredits] = useState<CustomerCredit[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [adjustingCredits, setAdjustingCredits] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadStats(),
        loadCustomerCredits(),
        loadGeneratedImages()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/admin/customers/credits-summary');

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadCustomerCredits = async () => {
    try {
      const response = await fetch('/api/admin/customer-customization-credits');

      if (!response.ok) {
        throw new Error('Failed to load customer credits');
      }

      const credits = await response.json();

      if (credits) {
        const enrichedCredits = credits.map((c: any) => ({
          ...c,
          customer_email: c.user_profiles?.email,
          customer_name: c.user_profiles?.full_name ||
            `${c.user_profiles?.first_name || ''} ${c.user_profiles?.last_name || ''}`.trim()
        }));
        setCustomerCredits(enrichedCredits);
      }
    } catch (error) {
      console.error('Error loading customer credits:', error);
    }
  };

  const loadGeneratedImages = async () => {
    try {
      const response = await fetch('/api/admin/customer-generated-images?limit=50');

      if (!response.ok) {
        throw new Error('Failed to load generated images');
      }

      const images = await response.json();

      if (images) {
        const enrichedImages = images.map((img: any) => ({
          ...img,
          customer_email: img.user_profiles?.email,
          customer_name: img.user_profiles?.full_name ||
            `${img.user_profiles?.first_name || ''} ${img.user_profiles?.last_name || ''}`.trim()
        }));
        setGeneratedImages(enrichedImages);
      }
    } catch (error) {
      console.error('Error loading generated images:', error);
    }
  };

  const adjustCredits = async (customerId: string, amount: number) => {
    try {
      setAdjustingCredits(customerId);

      const response = await fetch(`/api/admin/customers/${customerId}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          reason: 'Admin manual adjustment'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to adjust credits');
      }

      // Reload data
      await loadCustomerCredits();
      await loadStats();

      alert(`Successfully ${amount > 0 ? 'added' : 'removed'} ${Math.abs(amount)} credits\nNew balance: ${data.newBalance} credits`);
    } catch (error) {
      console.error('Error adjusting credits:', error);
      alert(error instanceof Error ? error.message : 'Failed to adjust credits');
    } finally {
      setAdjustingCredits(null);
    }
  };

  const filteredCustomers = customerCredits.filter(c =>
    c.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading customization data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Wand2 className="w-8 h-8 mr-3 text-purple-600" />
                Customer Customizations
              </h1>
              <p className="text-gray-600 mt-1">Monitor and manage customer image customization activity</p>
            </div>
            <Button onClick={loadData} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Customers</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalCustomers}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Credits Issued</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalCreditsIssued}</p>
                </div>
                <CreditCard className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Credits Used</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalCreditsUsed}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Generations</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalGenerations}</p>
                </div>
                <ImageIcon className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    £{(stats.totalRevenue / 100).toFixed(2)}
                  </p>
                </div>
                <CreditCard className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Customer Credits Table */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Customer Credit Balances</CardTitle>
                  <CardDescription>Manage customer credits for testing</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search customers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Customer</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Remaining</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Purchased</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Used</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Generations</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{customer.customer_name || 'Unknown'}</p>
                            <p className="text-sm text-gray-500">{customer.customer_email}</p>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4">
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                            {customer.credits_remaining}
                          </Badge>
                        </td>
                        <td className="text-center py-3 px-4 text-gray-600">
                          {customer.credits_purchased}
                        </td>
                        <td className="text-center py-3 px-4 text-gray-600">
                          {customer.credits_used}
                        </td>
                        <td className="text-center py-3 px-4 text-gray-600">
                          {customer.total_generations}
                        </td>
                        <td className="text-center py-3 px-4">
                          <div className="flex items-center justify-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => adjustCredits(customer.customer_id, 5)}
                              disabled={adjustingCredits === customer.customer_id}
                              title="Add 5 credits"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => adjustCredits(customer.customer_id, -5)}
                              disabled={adjustingCredits === customer.customer_id || customer.credits_remaining < 5}
                              title="Remove 5 credits"
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredCustomers.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No customers found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Generated Images Gallery */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recently Generated Images</CardTitle>
              <CardDescription>Latest customer customizations ({generatedImages.length})</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {generatedImages.map((image) => (
                  <div
                    key={image.id}
                    className="relative group cursor-pointer"
                    onClick={() => setSelectedImage(image)}
                  >
                    <div className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                      <img
                        src={image.public_url}
                        alt="Generated"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 rounded-lg flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    {image.is_purchased && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-green-600 text-xs">
                          <Check className="w-3 h-3" />
                        </Badge>
                      </div>
                    )}
                    {image.is_multi_animal && (
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-blue-600 text-xs">
                          2 Pets
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {generatedImages.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No generated images yet
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Image Detail Modal */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedImage(null)}
          >
            <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Generated Image Details</CardTitle>
                  <Button variant="ghost" onClick={() => setSelectedImage(null)}>
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <img
                      src={selectedImage.public_url}
                      alt="Generated"
                      className="w-full rounded-lg"
                    />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Customer</p>
                      <p className="font-medium">{selectedImage.customer_name || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">{selectedImage.customer_email}</p>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Prompt</p>
                      <p className="text-sm">{selectedImage.prompt_text}</p>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Credits Used</p>
                        <Badge variant="secondary">{selectedImage.generation_cost_credits}</Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Multi-Animal</p>
                        <Badge variant={selectedImage.is_multi_animal ? "default" : "secondary"}>
                          {selectedImage.is_multi_animal ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Purchased</p>
                        <Badge variant={selectedImage.is_purchased ? "default" : "secondary"}  className={selectedImage.is_purchased ? "bg-green-600" : ""}>
                          {selectedImage.is_purchased ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Created</p>
                        <p className="text-sm">{new Date(selectedImage.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Cloudinary ID</p>
                      <p className="text-xs font-mono bg-gray-100 p-2 rounded">
                        {selectedImage.cloudinary_public_id}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
