'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { ChevronUp, ChevronDown, Plus, Edit, Trash2, Search, Filter } from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  medium: { id: string; name: string; slug: string };
  format: { id: string; name: string };
  size_name: string;
  size_code: string;
  width_cm: string;
  height_cm: string;
  width_inches: string;
  height_inches: string;
  gelato_sku: string;
  is_active: boolean;
  is_featured: boolean;
  stock_status: string;
  created_at: string;
  updated_at: string;
  pricing?: Array<{
    country_code: string;
    sale_price: number;
    currency_symbol: string;
    profit_margin_percent: number;
  }>;
}

interface Medium {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface Format {
  id: string;
  name: string;
  is_active: boolean;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [media, setMedia] = useState<Medium[]>([]);
  const [formats, setFormats] = useState<Format[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtering and sorting state
  const [searchTerm, setSearchTerm] = useState('');
  const [mediumFilter, setMediumFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('');
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const supabaseService = new AdminSupabaseService();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productsResult, mediaResult, formatsResult] = await Promise.all([
        supabaseService.getProducts(),
        supabaseService.getMedia(),
        supabaseService.getFormats()
      ]);
      
      setProducts(productsResult || []);
      setMedia(mediaResult || []);
      setFormats(formatsResult || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4 inline ml-1" /> : 
      <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      await supabaseService.deleteProduct(productId);
      await loadData(); // Reload data
    } catch (err) {
      console.error('Error deleting product:', err);
      alert('Failed to delete product');
    }
  };

  // Filter and sort products
  const filteredAndSortedProducts = products
    .filter(product => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (!product.name.toLowerCase().includes(searchLower) &&
            !product.sku.toLowerCase().includes(searchLower) &&
            !product.gelato_sku?.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      
      // Medium filter
      if (mediumFilter && product.medium.id !== mediumFilter) return false;
      
      // Format filter  
      if (formatFilter && product.format.id !== formatFilter) return false;
      
      // Stock status filter
      if (stockStatusFilter && product.stock_status !== stockStatusFilter) return false;
      
      return true;
    })
    .sort((a, b) => {
      if (!sortField) return 0;
      
      let aVal: any, bVal: any;
      
      switch (sortField) {
        case 'medium':
          aVal = a.medium.name;
          bVal = b.medium.name;
          break;
        case 'format':
          aVal = a.format.name;
          bVal = b.format.name;
          break;
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'sku':
          aVal = a.sku;
          bVal = b.sku;
          break;
        case 'size':
          aVal = a.size_name;
          bVal = b.size_name;
          break;
        case 'price':
          aVal = a.pricing?.[0]?.sale_price || 0;
          bVal = b.pricing?.[0]?.sale_price || 0;
          break;
        case 'margin':
          aVal = a.pricing?.[0]?.profit_margin_percent || 0;
          bVal = b.pricing?.[0]?.profit_margin_percent || 0;
          break;
        case 'stock':
          aVal = a.stock_status;
          bVal = b.stock_status;
          break;
        default:
          return 0;
      }
      
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

  if (loading) return <div className="p-8">Loading products...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600">Manage your product catalog</p>
        </div>
        <Link href="/admin/products/new">
          <Button className="bg-gradient-to-r from-purple-600 to-blue-600">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Medium Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Medium Type</label>
              <Select value={mediumFilter} onValueChange={setMediumFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All mediums" />
                </SelectTrigger>
                <SelectContent>
                  {media.filter(m => m.is_active).map(medium => (
                    <SelectItem key={medium.id} value={medium.id}>
                      {medium.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Format Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Format</label>
              <Select value={formatFilter} onValueChange={setFormatFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All formats" />
                </SelectTrigger>
                <SelectContent>
                  {formats.filter(f => f.is_active).map(format => (
                    <SelectItem key={format.id} value={format.id}>
                      {format.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stock Status Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Stock Status</label>
              <Select value={stockStatusFilter} onValueChange={setStockStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_stock">In Stock</SelectItem>
                  <SelectItem value="low_stock">Low Stock</SelectItem>
                  <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setMediumFilter('');
                  setFormatFilter('');
                  setStockStatusFilter('');
                  setSortField('');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Products ({filteredAndSortedProducts.length})</CardTitle>
          <CardDescription>Click column headers to sort</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th 
                    className="text-left p-4 font-medium cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('medium')}
                  >
                    Medium Type {getSortIcon('medium')}
                  </th>
                  <th 
                    className="text-left p-4 font-medium cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('format')}
                  >
                    Format {getSortIcon('format')}
                  </th>
                  <th 
                    className="text-left p-4 font-medium cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('name')}
                  >
                    Product Name {getSortIcon('name')}
                  </th>
                  <th 
                    className="text-left p-4 font-medium cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('sku')}
                  >
                    SKU {getSortIcon('sku')}
                  </th>
                  <th 
                    className="text-left p-4 font-medium cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('size')}
                  >
                    Size {getSortIcon('size')}
                  </th>
                  <th 
                    className="text-right p-4 font-medium cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('price')}
                  >
                    Price {getSortIcon('price')}
                  </th>
                  <th 
                    className="text-center p-4 font-medium cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('stock')}
                  >
                    Status {getSortIcon('stock')}
                  </th>
                  <th className="text-right p-4 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedProducts.map((product) => (
                  <tr key={product.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <span className="font-medium">{product.medium.name}</span>
                    </td>
                    <td className="p-4">
                      {product.format.name}
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium">{product.name || 'Unnamed Product'}</div>
                        {product.description && (
                          <div className="text-sm text-gray-600">{product.description.slice(0, 50)}...</div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-mono text-sm">{product.sku}</div>
                      {product.gelato_sku && (
                        <div className="font-mono text-xs text-gray-500">Gelato: {product.gelato_sku.slice(0, 20)}...</div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div>{product.size_name}</div>
                        <div className="text-gray-600">
                          {product.width_cm}×{product.height_cm}cm
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      {product.pricing?.[0] && (
                        <div>
                          <div className="font-medium">
                            {product.pricing[0].currency_symbol}{product.pricing[0].sale_price}
                          </div>
                          <div className="text-sm text-green-600">
                            {product.pricing[0].profit_margin_percent}% margin
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.stock_status === 'in_stock' ? 'bg-green-100 text-green-800' :
                        product.stock_status === 'low_stock' ? 'bg-yellow-100 text-yellow-800' :
                        product.stock_status === 'out_of_stock' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {product.stock_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end space-x-2">
                        <Link href={`/admin/products/${product.id}/edit`}>
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredAndSortedProducts.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {searchTerm || mediumFilter || formatFilter || stockStatusFilter ? 
                  'No products match your filters' : 
                  'No products found'
                }
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}