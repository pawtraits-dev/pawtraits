'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AdminSupabaseService } from '@/lib/admin-supabase';
import { PawSpinner } from '@/components/ui/paw-spinner';
import { Globe, Plus, Edit, Trash2, Search } from 'lucide-react';

interface Country {
  code: string;
  name: string;
  currency_code: string;
  currency_symbol: string;
  is_supported: boolean;
  shipping_zone: string;
  tax_rate_percent: number;
  display_order: number;
  created_at: string;
}

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const supabaseService = new AdminSupabaseService();

  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    try {
      setLoading(true);
      const result = await supabaseService.getCountries(false); // Get all countries, not just supported ones
      console.log('📊 Loaded countries:', result?.length || 0);
      console.log('🟢 Active countries:', result?.filter(c => c.is_supported)?.length || 0);
      setCountries(result || []);
    } catch (err) {
      console.error('Error loading countries:', err);
      setError('Failed to load countries');
    } finally {
      setLoading(false);
    }
  };

  const toggleCountrySupport = async (countryCode: string, isSupported: boolean) => {
    try {
      console.log(`Toggling ${countryCode} to ${isSupported ? 'active' : 'inactive'}`);
      await supabaseService.updateCountry(countryCode, { is_supported: isSupported });
      await loadCountries(); // Reload data
      console.log(`✅ Successfully updated ${countryCode}`);
    } catch (err) {
      console.error('Error updating country:', err);
      alert(`Failed to update country support status: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const updateDisplayOrder = async (countryCode: string, newOrder: number) => {
    try {
      await supabaseService.updateCountry(countryCode, { display_order: newOrder });
      await loadCountries(); // Reload data
    } catch (err) {
      console.error('Error updating display order:', err);
      alert('Failed to update display order');
    }
  };

  // Filter countries based on search
  const filteredCountries = countries
    .filter(country => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return country.name.toLowerCase().includes(searchLower) ||
             country.code.toLowerCase().includes(searchLower) ||
             country.currency_code.toLowerCase().includes(searchLower);
    })
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));

  // Get active countries for Gelato pricing
  const activeCountries = countries.filter(c => c.is_supported);
  const activeCountryCodes = activeCountries.map(c => c.code).join(', ');

  if (loading) return (
    <div className="p-8 flex items-center justify-center">
      <PawSpinner size="lg" />
    </div>
  );
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Globe className="w-8 h-8 mr-3" />
            Countries & Markets
          </h1>
          <p className="text-gray-600">Manage supported countries for Gelato pricing and shipping</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Active Countries for Pricing:</p>
          <p className="text-sm font-mono text-blue-600">{activeCountryCodes}</p>
        </div>
      </div>

      {/* Active Countries Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-green-700">Active Markets Summary</CardTitle>
          <CardDescription>
            These countries will be used for Gelato pricing API calls. 
            Pricing will be fetched in USD and converted to local currencies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {activeCountries.map(country => (
              <div key={country.code} className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg">
                <span className="text-2xl">{getCountryFlag(country.code)}</span>
                <div>
                  <div className="font-medium text-sm">{country.name}</div>
                  <div className="text-xs text-gray-600">{country.currency_symbol} {country.currency_code}</div>
                </div>
              </div>
            ))}
          </div>
          {activeCountries.length === 0 && (
            <p className="text-center text-gray-500 py-8">No active countries selected</p>
          )}
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search countries by name, code, or currency..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setSearchTerm('')}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Countries Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Countries ({filteredCountries.length})</CardTitle>
          <CardDescription>
            Toggle country support to include/exclude from Gelato pricing calls
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4 font-medium">Flag</th>
                  <th className="text-left p-4 font-medium">Country</th>
                  <th className="text-left p-4 font-medium">Code</th>
                  <th className="text-left p-4 font-medium">Currency</th>
                  <th className="text-center p-4 font-medium">Tax Rate</th>
                  <th className="text-center p-4 font-medium">Shipping Zone</th>
                  <th className="text-center p-4 font-medium">Order</th>
                  <th className="text-center p-4 font-medium">Active</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCountries.map((country) => (
                  <tr 
                    key={country.code} 
                    className={`border-b hover:bg-gray-50 ${
                      country.is_supported ? 'bg-green-50' : 'bg-gray-50'
                    }`}
                  >
                    <td className="p-4 text-2xl">
                      {getCountryFlag(country.code)}
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{country.name}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {country.code}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{country.currency_symbol}</span>
                        <span className="font-mono text-sm">{country.currency_code}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {country.tax_rate_percent}%
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        country.shipping_zone === 'domestic' ? 'bg-blue-100 text-blue-800' :
                        country.shipping_zone === 'eu' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {country.shipping_zone}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <Input
                        type="number"
                        value={country.display_order}
                        onChange={(e) => updateDisplayOrder(country.code, parseInt(e.target.value) || 0)}
                        className="w-16 text-center"
                        min="0"
                      />
                    </td>
                    <td className="p-4 text-center">
                      <Switch
                        checked={country.is_supported}
                        onCheckedChange={(checked) => toggleCountrySupport(country.code, checked)}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end space-x-2">
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredCountries.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No countries match your search' : 'No countries found'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>Active Countries:</strong> Countries with the toggle enabled will be included in Gelato pricing API calls.</p>
            <p><strong>Pricing Flow:</strong> Gelato returns prices in USD → We convert to local currency using exchange rates.</p>
            <p><strong>Display Order:</strong> Controls the order countries appear in dropdowns and pricing displays.</p>
            <p><strong>Shipping Zones:</strong> Used for calculating shipping costs and tax rates.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to get country flag emoji
function getCountryFlag(countryCode: string): string {
  const flagMap: Record<string, string> = {
    'GB': '🇬🇧', 'US': '🇺🇸', 'CA': '🇨🇦', 'AU': '🇦🇺',
    'DE': '🇩🇪', 'FR': '🇫🇷', 'ES': '🇪🇸', 'IT': '🇮🇹',
    'NL': '🇳🇱', 'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰',
    'FI': '🇫🇮', 'IE': '🇮🇪', 'PT': '🇵🇹', 'AT': '🇦🇹',
    'BE': '🇧🇪', 'CH': '🇨🇭', 'LU': '🇱🇺', 'PL': '🇵🇱',
    'CZ': '🇨🇿', 'SK': '🇸🇰', 'HU': '🇭🇺', 'SI': '🇸🇮',
    'HR': '🇭🇷', 'RO': '🇷🇴', 'BG': '🇧🇬', 'GR': '🇬🇷',
    'CY': '🇨🇾', 'MT': '🇲🇹', 'LT': '🇱🇹', 'LV': '🇱🇻',
    'EE': '🇪🇪', 'JP': '🇯🇵', 'KR': '🇰🇷', 'SG': '🇸🇬',
    'HK': '🇭🇰', 'TW': '🇹🇼', 'NZ': '🇳🇿', 'BR': '🇧🇷',
    'MX': '🇲🇽', 'AR': '🇦🇷', 'CL': '🇨🇱', 'IN': '🇮🇳',
    'CN': '🇨🇳', 'RU': '🇷🇺', 'ZA': '🇿🇦', 'EG': '🇪🇬',
    'NG': '🇳🇬', 'KE': '🇰🇪', 'MA': '🇲🇦', 'AE': '🇦🇪',
    'SA': '🇸🇦', 'IL': '🇮🇱', 'TR': '🇹🇷', 'UA': '🇺🇦'
  };
  
  return flagMap[countryCode] || '🏳️';
}