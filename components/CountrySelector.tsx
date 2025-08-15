'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, MapPin } from 'lucide-react';
import { useCountry } from '@/lib/country-context';
import { getCountryFlag } from '@/lib/country-detection';

interface CountrySelectorProps {
  className?: string;
  showLabel?: boolean;
  showDefault?: boolean;
  compact?: boolean;
}

export default function CountrySelector({ 
  className = '',
  showLabel = true,
  showDefault = true,
  compact = false 
}: CountrySelectorProps) {
  const { 
    selectedCountry, 
    setSelectedCountry, 
    countries, 
    selectedCountryData,
    isLoading,
    userDefaultCountry,
    hasUserOverride,
    resetToDefault,
  } = useCountry();

  if (isLoading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="animate-pulse bg-gray-200 rounded h-8 w-32"></div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Select value={selectedCountry} onValueChange={setSelectedCountry}>
          <SelectTrigger className="w-auto min-w-[100px] bg-white/80 backdrop-blur-sm">
            <SelectValue>
              <div className="flex items-center space-x-2">
                <span>{getCountryFlag(selectedCountry)}</span>
                <span className="font-medium">{selectedCountryData?.currency_symbol}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {countries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <div className="flex items-center space-x-2">
                  <span>{getCountryFlag(country.code)}</span>
                  <span>{country.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {country.currency_symbol} {country.currency_code}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasUserOverride && showDefault && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetToDefault}
            className="text-gray-500 hover:text-gray-700"
            title="Reset to detected location"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 flex items-center space-x-1">
            <MapPin className="w-4 h-4" />
            <span>Location & Currency</span>
          </label>
          {hasUserOverride && showDefault && userDefaultCountry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefault}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset to {getCountryFlag(userDefaultCountry)} detected
            </Button>
          )}
        </div>
      )}
      
      <Select value={selectedCountry} onValueChange={setSelectedCountry}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {selectedCountryData && (
              <div className="flex items-center space-x-2">
                <span>{getCountryFlag(selectedCountry)}</span>
                <span>{selectedCountryData.name}</span>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {selectedCountryData.currency_symbol} {selectedCountryData.currency_code}
                </Badge>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {countries.map((country) => (
            <SelectItem key={country.code} value={country.code}>
              <div className="flex items-center space-x-3 w-full">
                <span className="text-lg">{getCountryFlag(country.code)}</span>
                <div className="flex-1">
                  <div className="font-medium">{country.name}</div>
                  <div className="text-sm text-gray-500">
                    Currency: {country.currency_symbol} {country.currency_code}
                  </div>
                </div>
                {country.code === userDefaultCountry && (
                  <Badge variant="outline" className="text-xs">
                    Detected
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {hasUserOverride && (
        <div className="text-xs text-gray-600 flex items-center space-x-1">
          <span>💡</span>
          <span>You've overridden your detected location</span>
        </div>
      )}
    </div>
  );
}