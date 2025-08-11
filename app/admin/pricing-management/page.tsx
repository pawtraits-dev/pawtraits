'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  DollarSign, 
  Plus, 
  Edit, 
  History, 
  TrendingUp, 
  Package, 
  Truck, 
  Zap,
  Calculator,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { SupabaseService } from '@/lib/supabase';

interface ProductPricing {
  id: string;
  product_id: string;
  product_name: string;
  country_code: string;
  country_name: string;
  currency_symbol: string;
  product_cost: number;
  shipping_cost: number;
  ai_generation_cost: number;
  sale_price: number;
  processing_fee_percent: number;
  total_cost_with_fees: number;
  profit_amount: number;
  profit_margin_percent: number;
  effective_date: string;
  end_date?: string;
  is_current: boolean;
  price_type: string;
  notes?: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
}

interface Country {
  code: string;
  name: string;
  currency_symbol: string;
}

export default function PricingManagementPage() {
  const [pricingRecords, setPricingRecords] = useState<ProductPricing[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPricing, setShowAddPricing] = useState(false);
  const [editingPricing, setEditingPricing] = useState<ProductPricing | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');

  const [newPricing, setNewPricing] = useState({
    product_id: '',
    country_code: 'US',
    product_cost: 0,
    shipping_cost: 0,
    ai_generation_cost: 250, // 2.50 in cents
    sale_price: 0,
    processing_fee_percent: 0.029, // 2.9%
    price_type: 'standard',
    effective_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const supabaseService = new SupabaseService();

  useEffect(() => {
    loadPricingData();
  }, [selectedProduct, selectedCountry]);

  const loadPricingData = async () => {
    try {
      setLoading(true);

      // Load current pricing with product and country details
      let pricingQuery = supabaseService.getClient()
        .from('product_pricing')
        .select(`
          *,
          products!inner(name, description),
          countries!inner(name, currency_symbol)
        `)
        .order('effective_date', { ascending: false });

      // Apply filters
      if (selectedProduct !== 'all') {
        pricingQuery = pricingQuery.eq('product_id', selectedProduct);
      }
      if (selectedCountry !== 'all') {
        pricingQuery = pricingQuery.eq('country_code', selectedCountry);
      }

      const { data: pricingData, error: pricingError } = await pricingQuery;

      if (pricingError) throw pricingError;

      // Transform data
      const transformedPricing = pricingData?.map((record: any) => ({
        ...record,
        product_name: record.products.name,
        country_name: record.countries.name,
        currency_symbol: record.countries.currency_symbol
      })) || [];

      setPricingRecords(transformedPricing);

      // Load products and countries for filters
      const [productsResult, countriesResult] = await Promise.all([
        supabaseService.getClient().from('products').select('id, name, description'),
        supabaseService.getClient().from('countries').select('code, name, currency_symbol')
      ]);

      setProducts(productsResult.data || []);
      setCountries(countriesResult.data || []);

    } catch (error) {
      console.error('Error loading pricing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateProfitMetrics = (pricing: typeof newPricing) => {
    const totalCosts = pricing.product_cost + pricing.shipping_cost + pricing.ai_generation_cost;
    const processingFee = pricing.sale_price * pricing.processing_fee_percent;
    const totalCostWithFees = totalCosts + processingFee;
    const profitAmount = pricing.sale_price - totalCostWithFees;
    const profitMargin = pricing.sale_price > 0 ? (profitAmount / pricing.sale_price) * 100 : 0;

    return {
      totalCosts,
      processingFee,
      totalCostWithFees,
      profitAmount,
      profitMargin
    };
  };

  const handleAddPricing = async () => {
    if (!newPricing.product_id || !newPricing.country_code || newPricing.sale_price <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const metrics = calculateProfitMetrics(newPricing);
      
      const pricingData = {
        product_id: newPricing.product_id,
        country_code: newPricing.country_code,
        product_cost: newPricing.product_cost,
        shipping_cost: newPricing.shipping_cost,
        ai_generation_cost: newPricing.ai_generation_cost,
        sale_price: newPricing.sale_price,
        processing_fee_percent: newPricing.processing_fee_percent,
        total_cost_with_fees: Math.round(metrics.totalCostWithFees),
        profit_amount: Math.round(metrics.profitAmount),
        profit_margin_percent: metrics.profitMargin,
        price_type: newPricing.price_type,
        effective_date: newPricing.effective_date,
        is_current: true,
        notes: newPricing.notes || null
      };

      const { error } = await supabaseService.getClient()
        .from('product_pricing')
        .insert(pricingData);

      if (error) throw error;

      setShowAddPricing(false);
      setNewPricing({
        product_id: '',
        country_code: 'US',
        product_cost: 0,
        shipping_cost: 0,
        ai_generation_cost: 250,
        sale_price: 0,
        processing_fee_percent: 0.029,
        price_type: 'standard',
        effective_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      
      await loadPricingData();

    } catch (error) {
      console.error('Error adding pricing:', error);
      alert('Failed to add pricing. Please try again.');
    }
  };

  const formatCurrency = (amount: number, currencySymbol: string = '$') => {
    return `${currencySymbol}${(amount / 100).toFixed(2)}`;
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(1)}%`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (pricing: ProductPricing) => {
    if (pricing.is_current) {
      return <Badge className="bg-green-100 text-green-800">Current</Badge>;
    } else if (pricing.end_date) {
      return <Badge className="bg-gray-100 text-gray-800">Expired</Badge>;
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800">Scheduled</Badge>;
    }
  };

  const currentMetrics = calculateProfitMetrics(newPricing);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pricing Management</h1>
          <p className="text-gray-600 mt-2">
            Manage product pricing and cost structures with historical tracking
          </p>
        </div>
        
        <Dialog open={showAddPricing} onOpenChange={setShowAddPricing}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Pricing
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Pricing</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Product and Country Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product</Label>
                  <Select value={newPricing.product_id} onValueChange={(value) => setNewPricing({ ...newPricing, product_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select value={newPricing.country_code} onValueChange={(value) => setNewPricing({ ...newPricing, country_code: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map(country => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name} ({country.currency_symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Cost Structure */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center">
                  <Calculator className="w-4 h-4 mr-2" />
                  Cost Structure (in cents)
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center">
                      <Package className="w-3 h-3 mr-1" />
                      Product Cost
                    </Label>
                    <Input
                      type="number"
                      value={newPricing.product_cost}
                      onChange={(e) => setNewPricing({ ...newPricing, product_cost: parseInt(e.target.value) || 0 })}
                      placeholder="1500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center">
                      <Truck className="w-3 h-3 mr-1" />
                      Shipping Cost
                    </Label>
                    <Input
                      type="number"
                      value={newPricing.shipping_cost}
                      onChange={(e) => setNewPricing({ ...newPricing, shipping_cost: parseInt(e.target.value) || 0 })}
                      placeholder="800"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center">
                      <Zap className="w-3 h-3 mr-1" />
                      AI Generation Cost
                    </Label>
                    <Input
                      type="number"
                      value={newPricing.ai_generation_cost}
                      onChange={(e) => setNewPricing({ ...newPricing, ai_generation_cost: parseInt(e.target.value) || 0 })}
                      placeholder="250"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Processing Fee %</Label>
                    <Input
                      type="number"
                      step="0.001"
                      value={newPricing.processing_fee_percent}
                      onChange={(e) => setNewPricing({ ...newPricing, processing_fee_percent: parseFloat(e.target.value) || 0 })}
                      placeholder="0.029"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 flex items-center">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Pricing & Dates
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sale Price (cents)</Label>
                    <Input
                      type="number"
                      value={newPricing.sale_price}
                      onChange={(e) => setNewPricing({ ...newPricing, sale_price: parseInt(e.target.value) || 0 })}
                      placeholder="4999"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Price Type</Label>
                    <Select value={newPricing.price_type} onValueChange={(value) => setNewPricing({ ...newPricing, price_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="promotional">Promotional</SelectItem>
                        <SelectItem value="bulk">Bulk Discount</SelectItem>
                        <SelectItem value="seasonal">Seasonal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Effective Date</Label>
                    <Input
                      type="date"
                      value={newPricing.effective_date}
                      onChange={(e) => setNewPricing({ ...newPricing, effective_date: e.target.value })}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={newPricing.notes}
                    onChange={(e) => setNewPricing({ ...newPricing, notes: e.target.value })}
                    placeholder="Reason for pricing change..."
                    rows={2}
                  />
                </div>
              </div>

              {/* Profit Calculation Preview */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-gray-900">Profit Analysis</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Costs:</span>
                    <span className="font-medium ml-2">{formatCurrency(currentMetrics.totalCostWithFees)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Processing Fee:</span>
                    <span className="font-medium ml-2">{formatCurrency(currentMetrics.processingFee)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Profit Amount:</span>
                    <span className={`font-medium ml-2 ${currentMetrics.profitAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(currentMetrics.profitAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Profit Margin:</span>
                    <span className={`font-medium ml-2 ${currentMetrics.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPercentage(currentMetrics.profitMargin)}
                    </span>
                  </div>
                </div>
                
                {currentMetrics.profitMargin < 10 && (
                  <div className="flex items-center text-amber-600 text-sm mt-2">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    Low profit margin - consider adjusting pricing
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowAddPricing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddPricing}>
                  Add Pricing
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {countries.map(country => (
                    <SelectItem key={country.code} value={country.code}>
                      {country.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Results</Label>
              <div className="text-sm text-gray-600 py-2">
                {pricingRecords.length} pricing record{pricingRecords.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Records */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing History</CardTitle>
          <CardDescription>Current and historical pricing for products</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pricingRecords.map((pricing) => (
              <div key={pricing.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-900">{pricing.product_name}</span>
                      <Badge variant="outline">{pricing.country_name}</Badge>
                      {getStatusBadge(pricing)}
                      <Badge variant="outline">{pricing.price_type}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="block font-medium">Sale Price</span>
                        <span>{formatCurrency(pricing.sale_price, pricing.currency_symbol)}</span>
                      </div>
                      <div>
                        <span className="block font-medium">Total Cost</span>
                        <span>{formatCurrency(pricing.total_cost_with_fees || 0, pricing.currency_symbol)}</span>
                      </div>
                      <div>
                        <span className="block font-medium">Profit</span>
                        <span className={pricing.profit_amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(pricing.profit_amount || 0, pricing.currency_symbol)}
                        </span>
                      </div>
                      <div>
                        <span className="block font-medium">Margin</span>
                        <span className={pricing.profit_margin_percent >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatPercentage(pricing.profit_margin_percent || 0)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      Effective: {formatDate(pricing.effective_date)}
                      {pricing.end_date && (
                        <span className="ml-4">
                          Expired: {formatDate(pricing.end_date)}
                        </span>
                      )}
                    </div>
                    
                    {pricing.notes && (
                      <div className="text-xs text-gray-600 italic">
                        {pricing.notes}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <History className="w-4 h-4 mr-1" />
                      History
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            
            {pricingRecords.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No pricing records match your current filters</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}