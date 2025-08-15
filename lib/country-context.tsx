'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Country } from '@/lib/product-types';
import { detectCountryFromPhone, getDefaultCountry } from '@/lib/country-detection';

interface CountryContextType {
  selectedCountry: string;
  setSelectedCountry: (country: string) => void;
  countries: Country[];
  selectedCountryData: Country | null;
  isLoading: boolean;
  userDefaultCountry: string | null;
  hasUserOverride: boolean;
  resetToDefault: () => void;
}

const CountryContext = createContext<CountryContextType | undefined>(undefined);

interface CountryProviderProps {
  children: ReactNode;
  userPhone?: string;
  fallbackCountry?: string;
}

const STORAGE_KEY = 'pawtraits_selected_country';

export function CountryProvider({ 
  children, 
  userPhone, 
  fallbackCountry = 'GB' 
}: CountryProviderProps) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCountry, setSelectedCountryState] = useState<string>(fallbackCountry);
  const [isLoading, setIsLoading] = useState(true);
  const [userDefaultCountry, setUserDefaultCountry] = useState<string | null>(null);
  const [hasUserOverride, setHasUserOverride] = useState(false);

  // Load countries from API
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const response = await fetch('/api/admin/countries?supportedOnly=true');
        if (response.ok) {
          const supportedCountries = await response.json();
          setCountries(supportedCountries);
          
          // Detect user's default country from phone number
          const detectedCountry = getDefaultCountry(userPhone, fallbackCountry);
          setUserDefaultCountry(detectedCountry);
          
          // Check if user has a stored preference
          const storedCountry = localStorage.getItem(STORAGE_KEY);
          
          if (storedCountry && supportedCountries.some((c: Country) => c.code === storedCountry)) {
            // User has an override preference
            setSelectedCountryState(storedCountry);
            setHasUserOverride(storedCountry !== detectedCountry);
          } else if (supportedCountries.some((c: Country) => c.code === detectedCountry)) {
            // Use detected country if it's supported
            setSelectedCountryState(detectedCountry);
            setHasUserOverride(false);
          } else {
            // Fall back to default
            setSelectedCountryState(fallbackCountry);
            setHasUserOverride(false);
          }
        }
      } catch (error) {
        console.error('Error loading countries:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCountries();
  }, [userPhone, fallbackCountry]);

  const setSelectedCountry = (country: string) => {
    setSelectedCountryState(country);
    localStorage.setItem(STORAGE_KEY, country);
    
    // Check if this is different from user's detected default
    setHasUserOverride(userDefaultCountry !== null && country !== userDefaultCountry);
  };

  const resetToDefault = () => {
    if (userDefaultCountry) {
      setSelectedCountryState(userDefaultCountry);
      localStorage.removeItem(STORAGE_KEY);
      setHasUserOverride(false);
    }
  };

  const selectedCountryData = countries.find(c => c.code === selectedCountry) || null;

  return (
    <CountryContext.Provider
      value={{
        selectedCountry,
        setSelectedCountry,
        countries,
        selectedCountryData,
        isLoading,
        userDefaultCountry,
        hasUserOverride,
        resetToDefault,
      }}
    >
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  const context = useContext(CountryContext);
  if (context === undefined) {
    throw new Error('useCountry must be used within a CountryProvider');
  }
  return context;
}

export function useCountryPricing() {
  const { selectedCountry, selectedCountryData } = useCountry();
  
  // Helper function to filter pricing for selected country
  const getCountryPricing = (pricing: any[]) => {
    return pricing.filter(p => p.country_code === selectedCountry);
  };
  
  // Helper function to get lowest price for selected country
  const getLowestPrice = (pricing: any[]) => {
    const countryPricing = getCountryPricing(pricing);
    if (countryPricing.length === 0) return null;
    
    return countryPricing.reduce((lowest, current) => 
      current.sale_price < lowest.sale_price ? current : lowest
    );
  };

  return {
    selectedCountry,
    selectedCountryData,
    getCountryPricing,
    getLowestPrice,
  };
}