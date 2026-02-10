'use client';

/**
 * Admin: Create Digital Download Product
 *
 * Creates a digital-only product (entry-level purchase option).
 * Digital downloads are also automatically bundled with physical products.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, AlertCircle, CheckCircle2, Image as ImageIcon } from 'lucide-react';

export default function NewDigitalProductPage() {
  const router = useRouter();
  const adminService = new AdminSupabaseService();

  // Form state
  const [selectedImageId, setSelectedImageId] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [price, setPrice] = useState<string>('9.99');
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['jpg', 'png', 'pdf']);
  const [resolution, setResolution] = useState<string>('high');
  const [licenseType, setLicenseType] = useState<string>('personal');
  const [expiryDays, setExpiryDays] = useState<string>('30');

  // Data
  const [catalogImages, setCatalogImages] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<any>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadCatalogImages();
  }, []);

  async function loadCatalogImages() {
    try {
      const images = await adminService.getCatalogImages();
      setCatalogImages(images || []);
    } catch (error: any) {
      console.error('Failed to load catalog images:', error);
      setError('Failed to load catalog images');
    }
  }

  function handleImageSelect(image: any) {
    setSelectedImageId(image.id);
    setSelectedImage(image);

    // Auto-fill product name from image if empty
    if (!productName && image.filename) {
      setProductName(`${image.filename} - Digital Download`);
    }

    // Auto-fill description from image description if empty
    if (!description && image.description) {
      setDescription(image.description);
    }
  }

  function toggleFormat(format: string) {
    setSelectedFormats(prev =>
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validation
      if (!selectedImageId) {
        throw new Error('Please select an image from the catalog');
      }
      if (!productName.trim()) {
        throw new Error('Product name is required');
      }
      if (!description.trim()) {
        throw new Error('Description is required');
      }
      if (parseFloat(price) <= 0) {
        throw new Error('Price must be greater than 0');
      }
      if (selectedFormats.length === 0) {
        throw new Error('At least one file format must be selected');
      }

      // Create digital product
      const productData = {
        name: productName.trim(),
        description: description.trim(),
        image_id: selectedImageId,

        // Digital product fields
        product_type: 'digital_download',
        fulfillment_method: 'download',
        requires_shipping: false,

        // Digital configuration
        digital_file_type: selectedFormats.length === 1 ? selectedFormats[0] : 'all',
        digital_resolution: resolution,
        license_type: licenseType,

        // Pricing (store in smallest currency unit - pence/cents)
        base_price: Math.round(parseFloat(price) * 100),
        currency: 'GBP',

        // Metadata
        is_active: true,
        is_public: true,
        metadata: {
          download_expiry_days: parseInt(expiryDays),
          available_formats: selectedFormats
        }
      };

      console.log('Creating digital product:', productData);

      // Insert product via admin service
      const { data: product, error: insertError } = await adminService.getClient()
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create product: ${insertError.message}`);
      }

      console.log('✅ Digital product created:', product);
      setSuccess(true);

      // Redirect after success
      setTimeout(() => {
        router.push('/admin/products');
      }, 2000);

    } catch (error: any) {
      console.error('Failed to create digital product:', error);
      setError(error.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin/products')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Products
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <Download className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Create Digital Download Product</h1>
        </div>
        <p className="text-gray-600">
          Create an entry-level digital-only product. Customers receive instant download access after purchase.
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Digital product created successfully! Redirecting...
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image Selection */}
        <Card>
          <CardHeader>
            <CardTitle>1. Select Image</CardTitle>
            <CardDescription>
              Choose an image from your catalog to offer as a digital download
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedImage ? (
              <div className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50">
                <img
                  src={selectedImage.public_url}
                  alt={selectedImage.filename}
                  className="w-24 h-24 object-cover rounded"
                />
                <div className="flex-1">
                  <p className="font-medium">{selectedImage.filename}</p>
                  <p className="text-sm text-gray-600">{selectedImage.description}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedImage(null);
                    setSelectedImageId('');
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Select an image from your catalog (showing first 20):
                </p>
                <div className="grid grid-cols-4 gap-4 max-h-96 overflow-y-auto">
                  {catalogImages.slice(0, 20).map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => handleImageSelect(image)}
                      className="border-2 border-transparent hover:border-blue-500 rounded-lg overflow-hidden transition-all"
                    >
                      <img
                        src={image.public_url}
                        alt={image.filename}
                        className="w-full h-32 object-cover"
                      />
                    </button>
                  ))}
                </div>
                {catalogImages.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No catalog images found</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Details */}
        <Card>
          <CardHeader>
            <CardTitle>2. Product Details</CardTitle>
            <CardDescription>
              Basic information for the product listing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g., Golden Retriever Portrait - Digital Download"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what the customer will receive..."
                rows={4}
                required
              />
            </div>

            <div>
              <Label htmlFor="price">Price (£) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
              <p className="text-sm text-gray-600 mt-1">
                Entry-level pricing for digital-only (suggested: £9.99)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Digital Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>3. Digital Download Configuration</CardTitle>
            <CardDescription>
              Choose file formats and quality options
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Formats */}
            <div>
              <Label className="mb-3 block">File Formats Available *</Label>
              <div className="flex gap-3">
                {['jpg', 'png', 'pdf'].map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => toggleFormat(format)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      selectedFormats.includes(format)
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Customer can choose which format to download
              </p>
            </div>

            {/* Resolution */}
            <div>
              <Label htmlFor="resolution">Resolution Quality</Label>
              <select
                id="resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="high">High (Print Quality - 300 DPI)</option>
                <option value="medium">Medium (Screen Quality - 150 DPI)</option>
                <option value="web">Web Optimized (72 DPI)</option>
              </select>
            </div>

            {/* License Type */}
            <div>
              <Label htmlFor="license">License Type</Label>
              <select
                id="license"
                value={licenseType}
                onChange={(e) => setLicenseType(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="personal">Personal Use Only</option>
                <option value="commercial">Commercial Use Allowed</option>
                <option value="extended">Extended License</option>
              </select>
            </div>

            {/* Download Expiry */}
            <div>
              <Label htmlFor="expiry">Download Link Expires After (days)</Label>
              <Input
                id="expiry"
                type="number"
                min="1"
                max="365"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
              />
              <p className="text-sm text-gray-600 mt-1">
                Recommended: 30 days (standard industry practice)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Product Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Digital Download</Badge>
                <Badge variant="outline">Entry Level</Badge>
              </div>
              <p><strong>Type:</strong> Digital-only product</p>
              <p><strong>Fulfillment:</strong> Instant download after purchase</p>
              <p><strong>Shipping:</strong> None required</p>
              <p><strong>Formats:</strong> {selectedFormats.join(', ').toUpperCase()}</p>
              <p><strong>Price:</strong> £{price}</p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={loading || !selectedImageId}
            className="flex-1"
          >
            {loading ? 'Creating...' : 'Create Digital Product'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/products')}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
