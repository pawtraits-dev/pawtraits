'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { TrendingUp, TrendingDown, DollarSign, Plus, Edit, Trash2, Server, Zap, Users, Package } from 'lucide-react';
import { SupabaseService } from '@/lib/supabase';

interface CostItem {
  id: string;
  name: string;
  category: 'infrastructure' | 'ai_generation' | 'fulfillment' | 'marketing' | 'personnel' | 'other';
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'one_time';
  date: string;
  description?: string;
  is_variable: boolean;
}

interface CostSummary {
  total_monthly_costs: number;
  total_yearly_costs: number;
  cost_by_category: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  variable_costs: number;
  fixed_costs: number;
  cost_per_order?: number;
  cost_trend: Array<{
    month: string;
    total_costs: number;
    variable_costs: number;
    fixed_costs: number;
  }>;
}

type TimePeriod = 'month' | 'quarter' | 'year';

export default function CostManagementPage() {
  const [costs, setCosts] = useState<CostItem[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddCost, setShowAddCost] = useState(false);
  const [editingCost, setEditingCost] = useState<CostItem | null>(null);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('month');

  const [newCost, setNewCost] = useState<Partial<CostItem>>({
    name: '',
    category: 'other',
    amount: 0,
    frequency: 'monthly',
    date: new Date().toISOString().split('T')[0],
    description: '',
    is_variable: false
  });

  const supabaseService = new SupabaseService();

  const categories = [
    { value: 'infrastructure', label: 'Infrastructure', icon: Server },
    { value: 'ai_generation', label: 'AI Generation', icon: Zap },
    { value: 'fulfillment', label: 'Fulfillment', icon: Package },
    { value: 'marketing', label: 'Marketing', icon: TrendingUp },
    { value: 'personnel', label: 'Personnel', icon: Users },
    { value: 'other', label: 'Other', icon: DollarSign },
  ];

  useEffect(() => {
    loadCostData();
  }, [timePeriod]);

  const loadCostData = async () => {
    try {
      setLoading(true);
      
      // Load costs from database (you might need to create this table)
      const { data: costsData, error: costsError } = await supabaseService.getClient()
        .from('business_costs')
        .select('*')
        .order('date', { ascending: false });

      if (costsError) {
        // If table doesn't exist, use sample data
        console.warn('business_costs table not found, using sample data');
        const sampleCosts = generateSampleCosts();
        setCosts(sampleCosts);
        setCostSummary(calculateCostSummary(sampleCosts));
      } else {
        setCosts(costsData || []);
        setCostSummary(calculateCostSummary(costsData || []));
      }

    } catch (error) {
      console.error('Error loading cost data:', error);
      // Use sample data as fallback
      const sampleCosts = generateSampleCosts();
      setCosts(sampleCosts);
      setCostSummary(calculateCostSummary(sampleCosts));
    } finally {
      setLoading(false);
    }
  };

  const generateSampleCosts = (): CostItem[] => {
    return [
      {
        id: '1',
        name: 'AWS Infrastructure',
        category: 'infrastructure',
        amount: 2500,
        frequency: 'monthly',
        date: '2024-01-01',
        description: 'Cloud hosting and compute resources',
        is_variable: true
      },
      {
        id: '2',
        name: 'OpenAI API Credits',
        category: 'ai_generation',
        amount: 5000,
        frequency: 'monthly',
        date: '2024-01-01',
        description: 'AI image generation costs',
        is_variable: true
      },
      {
        id: '3',
        name: 'Gelato Fulfillment',
        category: 'fulfillment',
        amount: 15000,
        frequency: 'monthly',
        date: '2024-01-01',
        description: 'Print and shipping costs',
        is_variable: true
      },
      {
        id: '4',
        name: 'Software Subscriptions',
        category: 'infrastructure',
        amount: 800,
        frequency: 'monthly',
        date: '2024-01-01',
        description: 'Various SaaS tools and services',
        is_variable: false
      },
      {
        id: '5',
        name: 'Marketing Campaigns',
        category: 'marketing',
        amount: 3000,
        frequency: 'monthly',
        date: '2024-01-01',
        description: 'Digital advertising and promotion',
        is_variable: false
      }
    ];
  };

  const calculateCostSummary = (costsData: CostItem[]): CostSummary => {
    // Convert all costs to monthly equivalent
    const monthlyCosts = costsData.map(cost => {
      let monthlyAmount = cost.amount;
      switch (cost.frequency) {
        case 'yearly':
          monthlyAmount = cost.amount / 12;
          break;
        case 'quarterly':
          monthlyAmount = cost.amount / 3;
          break;
        case 'one_time':
          monthlyAmount = cost.amount / 12; // Amortize over year
          break;
      }
      return { ...cost, monthlyAmount };
    });

    const totalMonthlyCosts = monthlyCosts.reduce((sum, cost) => sum + cost.monthlyAmount, 0);
    const totalYearlyCosts = totalMonthlyCosts * 12;

    // Calculate costs by category
    const categoryTotals: Record<string, number> = {};
    monthlyCosts.forEach(cost => {
      categoryTotals[cost.category] = (categoryTotals[cost.category] || 0) + cost.monthlyAmount;
    });

    const costByCategory = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category: categories.find(c => c.value === category)?.label || category,
        amount,
        percentage: totalMonthlyCosts > 0 ? (amount / totalMonthlyCosts) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);

    const variableCosts = monthlyCosts
      .filter(cost => cost.is_variable)
      .reduce((sum, cost) => sum + cost.monthlyAmount, 0);
    
    const fixedCosts = totalMonthlyCosts - variableCosts;

    // Generate cost trend (sample data)
    const costTrend = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (11 - i));
      return {
        month: date.toISOString().slice(0, 7),
        total_costs: totalMonthlyCosts * (0.8 + Math.random() * 0.4), // Add some variation
        variable_costs: variableCosts * (0.8 + Math.random() * 0.4),
        fixed_costs: fixedCosts
      };
    });

    return {
      total_monthly_costs: totalMonthlyCosts,
      total_yearly_costs: totalYearlyCosts,
      cost_by_category: costByCategory,
      variable_costs: variableCosts,
      fixed_costs: fixedCosts,
      cost_trend: costTrend
    };
  };

  const handleAddCost = async () => {
    if (!newCost.name || !newCost.amount) return;

    const costItem: CostItem = {
      id: Date.now().toString(),
      name: newCost.name,
      category: newCost.category as any,
      amount: newCost.amount,
      frequency: newCost.frequency as any,
      date: newCost.date || new Date().toISOString().split('T')[0],
      description: newCost.description,
      is_variable: newCost.is_variable || false
    };

    try {
      // In a real app, you would save to database
      const updatedCosts = [...costs, costItem];
      setCosts(updatedCosts);
      setCostSummary(calculateCostSummary(updatedCosts));
      
      setNewCost({
        name: '',
        category: 'other',
        amount: 0,
        frequency: 'monthly',
        date: new Date().toISOString().split('T')[0],
        description: '',
        is_variable: false
      });
      setShowAddCost(false);
    } catch (error) {
      console.error('Error adding cost:', error);
    }
  };

  const handleDeleteCost = async (costId: string) => {
    const updatedCosts = costs.filter(cost => cost.id !== costId);
    setCosts(updatedCosts);
    setCostSummary(calculateCostSummary(updatedCosts));
  };

  const formatCurrency = (amountInPence: number) => {
    return `£${(amountInPence / 100).toFixed(2)}`;
  };

  const getCategoryIcon = (category: string) => {
    const categoryInfo = categories.find(c => c.value === category);
    const IconComponent = categoryInfo?.icon || DollarSign;
    return <IconComponent className="w-4 h-4" />;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      infrastructure: 'bg-blue-100 text-blue-800',
      ai_generation: 'bg-purple-100 text-purple-800',
      fulfillment: 'bg-green-100 text-green-800',
      marketing: 'bg-orange-100 text-orange-800',
      personnel: 'bg-pink-100 text-pink-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.other;
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Cost Management</h1>
          <p className="text-gray-600 mt-2">
            Track and manage business expenses and operational costs
          </p>
        </div>
        
        <Dialog open={showAddCost} onOpenChange={setShowAddCost}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Cost
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Cost</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newCost.name}
                  onChange={(e) => setNewCost({ ...newCost, name: e.target.value })}
                  placeholder="Cost item name"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={newCost.category} onValueChange={(value) => setNewCost({ ...newCost, category: value as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={newCost.frequency} onValueChange={(value) => setNewCost({ ...newCost, frequency: value as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="one_time">One Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={newCost.amount}
                    onChange={(e) => setNewCost({ ...newCost, amount: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newCost.date}
                    onChange={(e) => setNewCost({ ...newCost, date: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={newCost.description}
                  onChange={(e) => setNewCost({ ...newCost, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="variable"
                  checked={newCost.is_variable}
                  onChange={(e) => setNewCost({ ...newCost, is_variable: e.target.checked })}
                />
                <Label htmlFor="variable">Variable cost (scales with business volume)</Label>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowAddCost(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCost}>
                  Add Cost
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {costSummary && (
        <>
          {/* Cost Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <DollarSign className="w-6 h-6 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Monthly Costs</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(costSummary.total_monthly_costs)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Yearly Projection</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(costSummary.total_yearly_costs)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Server className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Fixed Costs</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(costSummary.fixed_costs)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingDown className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Variable Costs</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(costSummary.variable_costs)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost by Category */}
            <Card>
              <CardHeader>
                <CardTitle>Costs by Category</CardTitle>
                <CardDescription>Breakdown of expenses by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {costSummary.cost_by_category.map((category) => (
                    <div key={category.category} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        <span className="font-medium text-gray-900">{category.category}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(category.amount)}</p>
                        <p className="text-sm text-gray-500">{category.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Costs */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Cost Items</CardTitle>
                <CardDescription>Latest expense entries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {costs.slice(0, 5).map((cost) => (
                    <div key={cost.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Badge className={getCategoryColor(cost.category)}>
                          {getCategoryIcon(cost.category)}
                          <span className="ml-1">{categories.find(c => c.value === cost.category)?.label}</span>
                        </Badge>
                        <div>
                          <p className="font-medium text-gray-900">{cost.name}</p>
                          <p className="text-sm text-gray-500">
                            {cost.frequency} • {cost.is_variable ? 'Variable' : 'Fixed'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{formatCurrency(cost.amount)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCost(cost.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}