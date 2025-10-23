'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Star,
  Gift,
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface CreditPackConfig {
  id: string;
  pack_id: string;
  pack_name: string;
  credits_amount: number;
  price_pence: number;
  price_currency: string;
  order_credit_pence: number;
  base_variation_cost: number;
  multi_animal_cost: number;
  format_variation_cost: number;
  outfit_variation_cost: number;
  free_trial_credits: number;
  is_active: boolean;
  is_recommended: boolean;
  discount_percentage: number;
  display_order: number;
}

export default function CreditPackSettingsPage() {
  const [packs, setPacks] = useState<CreditPackConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadCreditPacks();
  }, []);

  const loadCreditPacks = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/credit-packs');

      if (!response.ok) {
        throw new Error('Failed to fetch credit packs');
      }

      const data = await response.json();
      setPacks(data || []);
    } catch (err) {
      console.error('Error loading credit packs:', err);
      setError('Failed to load credit packs');
    } finally {
      setLoading(false);
    }
  };

  const savePack = async (pack: CreditPackConfig) => {
    try {
      setSaving(pack.id);
      setError(null);
      setSuccess(null);

      const response = await fetch(`/api/admin/credit-packs/${pack.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pack_name: pack.pack_name,
          credits_amount: pack.credits_amount,
          price_pence: pack.price_pence,
          price_currency: pack.price_currency,
          order_credit_pence: pack.order_credit_pence,
          base_variation_cost: pack.base_variation_cost,
          multi_animal_cost: pack.multi_animal_cost,
          format_variation_cost: pack.format_variation_cost,
          outfit_variation_cost: pack.outfit_variation_cost,
          free_trial_credits: pack.free_trial_credits,
          is_active: pack.is_active,
          is_recommended: pack.is_recommended,
          discount_percentage: pack.discount_percentage,
          display_order: pack.display_order
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update credit pack');
      }

      setSuccess(`${pack.pack_name} updated successfully`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving pack:', err);
      setError(`Failed to save ${pack.pack_name}`);
    } finally {
      setSaving(null);
    }
  };

  const updatePackField = (packId: string, field: keyof CreditPackConfig, value: any) => {
    setPacks(packs.map(pack =>
      pack.id === packId ? { ...pack, [field]: value } : pack
    ));
  };

  const formatPrice = (pence: number) => {
    return `£${(pence / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="w-8 h-8 text-purple-600" />
          Credit Pack Settings
        </h1>
        <p className="text-gray-600 mt-2">
          Configure pricing, order credits, and feature costs for customer credit packs
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
          <Sparkles className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Credit Packs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {packs.map((pack) => (
          <Card key={pack.id} className={!pack.is_active ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Input
                      value={pack.pack_name}
                      onChange={(e) => updatePackField(pack.id, 'pack_name', e.target.value)}
                      className="font-semibold text-lg"
                    />
                  </CardTitle>
                  <CardDescription className="mt-2 flex items-center gap-2">
                    <span className="text-xs">ID: {pack.pack_id}</span>
                    {pack.is_recommended && (
                      <Badge variant="default" className="bg-purple-600">
                        <Star className="w-3 h-3 mr-1" />
                        Recommended
                      </Badge>
                    )}
                  </CardDescription>
                </div>
                <Switch
                  checked={pack.is_active}
                  onCheckedChange={(checked) => updatePackField(pack.id, 'is_active', checked)}
                />
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Pricing */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-600">Pack Pricing</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Credits</Label>
                    <Input
                      type="number"
                      value={pack.credits_amount}
                      onChange={(e) => updatePackField(pack.id, 'credits_amount', parseInt(e.target.value) || 0)}
                      min="1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Price (pence)</Label>
                    <Input
                      type="number"
                      value={pack.price_pence}
                      onChange={(e) => updatePackField(pack.id, 'price_pence', parseInt(e.target.value) || 0)}
                      min="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">{formatPrice(pack.price_pence)}</p>
                  </div>
                </div>
              </div>

              {/* Order Credit */}
              <div className="space-y-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <Label className="text-xs text-gray-600 flex items-center gap-1">
                  <Gift className="w-3 h-3" />
                  Order Credit Bonus
                </Label>
                <Input
                  type="number"
                  value={pack.order_credit_pence}
                  onChange={(e) => updatePackField(pack.id, 'order_credit_pence', parseInt(e.target.value) || 0)}
                  min="0"
                  placeholder="Credit for print orders (pence)"
                />
                <p className="text-xs text-gray-600">
                  Bonus: {formatPrice(pack.order_credit_pence)} for print orders
                </p>
              </div>

              {/* Feature Costs */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-600">Feature Credit Costs</Label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <Label className="text-xs">Base Variation</Label>
                    <Input
                      type="number"
                      value={pack.base_variation_cost}
                      onChange={(e) => updatePackField(pack.id, 'base_variation_cost', parseInt(e.target.value) || 1)}
                      min="1"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Multi-Animal</Label>
                    <Input
                      type="number"
                      value={pack.multi_animal_cost}
                      onChange={(e) => updatePackField(pack.id, 'multi_animal_cost', parseInt(e.target.value) || 1)}
                      min="1"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Format</Label>
                    <Input
                      type="number"
                      value={pack.format_variation_cost}
                      onChange={(e) => updatePackField(pack.id, 'format_variation_cost', parseInt(e.target.value) || 1)}
                      min="1"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Outfit</Label>
                    <Input
                      type="number"
                      value={pack.outfit_variation_cost}
                      onChange={(e) => updatePackField(pack.id, 'outfit_variation_cost', parseInt(e.target.value) || 1)}
                      min="1"
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Display Settings */}
              <Separator />
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Discount %</Label>
                    <Input
                      type="number"
                      value={pack.discount_percentage}
                      onChange={(e) => updatePackField(pack.id, 'discount_percentage', parseInt(e.target.value) || 0)}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Display Order</Label>
                    <Input
                      type="number"
                      value={pack.display_order}
                      onChange={(e) => updatePackField(pack.id, 'display_order', parseInt(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={pack.is_recommended}
                      onCheckedChange={(checked) => updatePackField(pack.id, 'is_recommended', checked)}
                    />
                    <Label className="text-xs cursor-pointer">Recommended</Label>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <Button
                onClick={() => savePack(pack)}
                disabled={saving === pack.id}
                className="w-full"
              >
                {saving === pack.id ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>

              {/* Stats */}
              <div className="pt-2 text-xs text-gray-500 space-y-1">
                <p>Per credit: {formatPrice(pack.price_pence / pack.credits_amount)}</p>
                <p>Free trial: {pack.free_trial_credits} credits</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            Important Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-700 space-y-2">
          <p>
            <strong>Order Credit:</strong> When customers purchase a credit pack, they receive both customization credits
            AND a bonus credit amount added to their order balance (stored in the commissions table) for use on print orders.
          </p>
          <p>
            <strong>Feature Costs:</strong> These settings control how many credits different types of customizations require.
            Changes apply immediately to new generations.
          </p>
          <p>
            <strong>Display Order:</strong> Controls the order packs appear to customers (lower numbers appear first).
          </p>
          <p>
            <strong>Recommended Badge:</strong> Only one pack should be marked as recommended. This adds a visual indicator for customers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
