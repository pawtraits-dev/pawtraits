'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  ArrowLeft,
  QrCode,
  Calendar,
  Building,
  Tag,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CreateFormData {
  code: string;
  business_category: string;
  marketing_campaign: string;
  expiration_date: string;
  bulk_generation: boolean;
  quantity: number;
}

export default function CreatePreRegistrationCodePage() {
  const router = useRouter();
  const [formData, setFormData] = useState<CreateFormData>({
    code: '',
    business_category: '',
    marketing_campaign: '',
    expiration_date: '',
    bulk_generation: false,
    quantity: 10
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, code: result }));
  };

  const generateBulkCodes = (quantity: number) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const codes = [];

    for (let i = 0; i < quantity; i++) {
      let code = '';
      for (let j = 0; j < 8; j++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      codes.push(code);
    }

    return codes;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (formData.bulk_generation) {
        // Generate multiple codes
        const codes = generateBulkCodes(formData.quantity);
        const responses = [];

        for (const code of codes) {
          const response = await fetch('/api/admin/pre-registration/codes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              business_category: formData.business_category || null,
              marketing_campaign: formData.marketing_campaign || null,
              expiration_date: formData.expiration_date || null
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to create code ${code}: ${errorData.error}`);
          }

          responses.push(await response.json());
        }

        setSuccess(true);
        setError(`Successfully created ${codes.length} codes!`);
      } else {
        // Single code creation
        const response = await fetch('/api/admin/pre-registration/codes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            expiration_date: formData.expiration_date || null
          })
        });

        if (response.ok) {
          setSuccess(true);
          setError('Code created successfully!');
        } else {
          const errorData = await response.json();
          setError(errorData.error || 'Failed to create code');
        }
      }

      // Reset form
      setFormData({
        code: '',
        business_category: '',
        marketing_campaign: '',
        expiration_date: '',
        bulk_generation: false,
        quantity: 10
      });

      // Redirect after a delay to show success message
      setTimeout(() => {
        router.push('/admin/partners/pre-registration');
      }, 3000);

    } catch (error) {
      console.error('Error creating pre-registration code(s):', error);
      setError(error instanceof Error ? error.message : 'Failed to create code(s)');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof CreateFormData, value: string | boolean | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/partners/pre-registration">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Codes
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create Pre-Registration Code</h1>
          <p className="text-gray-600 mt-1">
            Generate a new QR code for partner acquisition campaigns
          </p>
        </div>
      </div>

      {/* Success Alert */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            {formData.bulk_generation ?
              `${formData.quantity} pre-registration codes created successfully! Redirecting to codes list...` :
              'Pre-registration code created successfully! Redirecting to codes list...'
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Creation Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Code Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Bulk Generation Toggle */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="bulk_generation"
                      checked={formData.bulk_generation}
                      onCheckedChange={(checked) => handleInputChange('bulk_generation', checked as boolean)}
                    />
                    <Label htmlFor="bulk_generation" className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Bulk Generation
                    </Label>
                  </div>
                  <p className="text-sm text-gray-500">
                    Generate multiple codes with the same settings
                  </p>
                </div>

                {/* Quantity Field (only shown for bulk generation) */}
                {formData.bulk_generation && (
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Number of Codes to Generate</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.quantity}
                      onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 10)}
                      placeholder="10"
                      required
                    />
                    <p className="text-sm text-gray-500">
                      How many codes to generate (1-100)
                    </p>
                  </div>
                )}

                {/* Code Field (only shown for single generation) */}
                {!formData.bulk_generation && (
                  <div className="space-y-2">
                    <Label htmlFor="code" className="flex items-center gap-2">
                      <QrCode className="w-4 h-4" />
                      Code
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                        placeholder="Enter unique code (e.g., ABC12345)"
                        required
                        maxLength={50}
                        className="font-mono"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={generateRandomCode}
                        className="whitespace-nowrap"
                      >
                        Generate Random
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500">
                      Unique identifier for this pre-registration code (6-50 characters, letters and numbers only)
                    </p>
                  </div>
                )}

                {/* Business Category */}
                <div className="space-y-2">
                  <Label htmlFor="business_category" className="flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Business Category
                  </Label>
                  <Input
                    id="business_category"
                    value={formData.business_category}
                    onChange={(e) => handleInputChange('business_category', e.target.value)}
                    placeholder="e.g., Grooming Salon, Veterinary Clinic, Pet Store"
                    maxLength={100}
                  />
                  <p className="text-sm text-gray-500">
                    Target business type for this code (optional)
                  </p>
                </div>

                {/* Marketing Campaign */}
                <div className="space-y-2">
                  <Label htmlFor="marketing_campaign" className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Marketing Campaign
                  </Label>
                  <Input
                    id="marketing_campaign"
                    value={formData.marketing_campaign}
                    onChange={(e) => handleInputChange('marketing_campaign', e.target.value)}
                    placeholder="e.g., Q1 2024 Local Outreach, Trade Show 2024"
                    maxLength={100}
                  />
                  <p className="text-sm text-gray-500">
                    Campaign or initiative this code belongs to (optional)
                  </p>
                </div>

                {/* Expiration Date */}
                <div className="space-y-2">
                  <Label htmlFor="expiration_date" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Expiration Date
                  </Label>
                  <Input
                    id="expiration_date"
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) => handleInputChange('expiration_date', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-sm text-gray-500">
                    Optional expiration date for this code (leave blank for no expiration)
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={loading || (!formData.bulk_generation && !formData.code.trim())}
                    className="flex-1"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {loading ?
                      (formData.bulk_generation ? 'Creating Codes...' : 'Creating...') :
                      (formData.bulk_generation ? `Create ${formData.quantity} Codes` : 'Create Code')
                    }
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/admin/partners/pre-registration')}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Instructions Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">QR Code Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Single vs Bulk Generation:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• <strong>Single:</strong> Create one code with custom or random ID</li>
                  <li>• <strong>Bulk:</strong> Generate up to 100 codes at once</li>
                  <li>• All codes in bulk share same settings</li>
                  <li>• QR codes generated automatically</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">After Creating:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Download individual or bulk QR codes</li>
                  <li>• Print and distribute to target partners</li>
                  <li>• Track scans and conversions</li>
                  <li>• Monitor campaign performance</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Best Practices:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Use bulk generation for campaigns</li>
                  <li>• Use descriptive campaign names</li>
                  <li>• Group codes by business type</li>
                  <li>• Set expiration dates for campaigns</li>
                </ul>
              </div>

              <div className="p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-700">
                  <strong>Tip:</strong> QR codes will redirect potential partners to a registration page where they can sign up and be linked to this code.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Code Guidelines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <strong className="text-gray-900">Code Format:</strong>
                  <p className="text-gray-600">6-50 characters, letters and numbers only</p>
                </div>
                <div>
                  <strong className="text-gray-900">Examples:</strong>
                  <p className="text-gray-600 font-mono">GROOMING2024, VET001, PETSTORE</p>
                </div>
                <div>
                  <strong className="text-gray-900">Avoid:</strong>
                  <p className="text-gray-600">Special characters, spaces, lowercase letters</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}