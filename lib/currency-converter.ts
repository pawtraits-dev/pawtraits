/**
 * Currency Conversion Service
 * Handles conversion between currencies with real-time and fallback rates
 */

interface ExchangeRate {
  currency: string;
  rate: number;
  lastUpdated: Date;
}

interface CurrencyConversionResult {
  fromAmount: number;
  fromCurrency: string;
  toAmount: number;
  toCurrency: string;
  rate: number;
  source: 'api' | 'fallback';
}

export class CurrencyConverter {
  private static instance: CurrencyConverter;
  private exchangeRates: Map<string, ExchangeRate> = new Map();
  private lastFetch: Date | null = null;
  private readonly CACHE_DURATION = 1000 * 60 * 60; // 1 hour
  
  // Fallback exchange rates (updated periodically)
  private readonly FALLBACK_RATES: Record<string, number> = {
    'USD': 1.0,     // Base currency
    'GBP': 0.79,
    'EUR': 0.92,
    'CAD': 1.35,
    'AUD': 1.52,
    'JPY': 149.5,
    'SGD': 1.34,
    'BRL': 5.02,
    'CHF': 0.88,
    'NZD': 1.64,
    'SEK': 10.5,
    'NOK': 10.8,
    'DKK': 6.85,
    'ISK': 138.2,
    'PLN': 4.03,
    'CZK': 22.7,
    'HUF': 361.0,
    'KRW': 1320,
    'HKD': 7.81,
    'MYR': 4.48,
    'THB': 35.8,
    'INR': 83.2,
    'MXN': 17.1,
    'ZAR': 18.4,
    'TRY': 30.5,
    'ILS': 3.7,
    'CNY': 7.2,
    'RUB': 91.0
  };

  public static getInstance(): CurrencyConverter {
    if (!CurrencyConverter.instance) {
      CurrencyConverter.instance = new CurrencyConverter();
    }
    return CurrencyConverter.instance;
  }

  /**
   * Convert amount from one currency to another
   */
  public async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<CurrencyConversionResult> {
    // If same currency, no conversion needed
    if (fromCurrency === toCurrency) {
      return {
        fromAmount: amount,
        fromCurrency,
        toAmount: amount,
        toCurrency,
        rate: 1.0,
        source: 'fallback'
      };
    }

    try {
      // Try to get real-time rates first
      let rate = await this.getExchangeRate(fromCurrency, toCurrency);
      let source: 'api' | 'fallback' = 'api';

      // Fall back to static rates if API fails
      if (rate === null) {
        rate = this.getFallbackRate(fromCurrency, toCurrency);
        source = 'fallback';
      }

      const convertedAmount = amount * rate;

      return {
        fromAmount: amount,
        fromCurrency,
        toAmount: convertedAmount,
        toCurrency,
        rate,
        source
      };
    } catch (error) {
      console.error('Currency conversion error:', error);
      
      // Use fallback rates in case of error
      const rate = this.getFallbackRate(fromCurrency, toCurrency);
      const convertedAmount = amount * rate;

      return {
        fromAmount: amount,
        fromCurrency,
        toAmount: convertedAmount,
        toCurrency,
        rate,
        source: 'fallback'
      };
    }
  }

  /**
   * Get exchange rate from API with caching
   */
  private async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
    try {
      // Check if we have cached rates and they're not expired
      const now = new Date();
      if (this.lastFetch && (now.getTime() - this.lastFetch.getTime()) < this.CACHE_DURATION) {
        const cachedRate = this.getCachedRate(fromCurrency, toCurrency);
        if (cachedRate !== null) {
          return cachedRate;
        }
      }

      // Fetch new rates from API
      await this.fetchExchangeRates();
      
      return this.getCachedRate(fromCurrency, toCurrency);
    } catch (error) {
      console.warn('Failed to fetch real-time exchange rates:', error);
      return null;
    }
  }

  /**
   * Fetch exchange rates from free API
   */
  private async fetchExchangeRates(): Promise<void> {
    try {
      // Using exchangerate-api.com (free tier: 1500 requests/month)
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      
      if (!response.ok) {
        throw new Error(`Exchange rate API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.rates) {
        // Store rates with USD as base
        this.exchangeRates.set('USD', {
          currency: 'USD',
          rate: 1.0,
          lastUpdated: new Date()
        });

        Object.entries(data.rates).forEach(([currency, rate]) => {
          this.exchangeRates.set(currency, {
            currency,
            rate: rate as number,
            lastUpdated: new Date()
          });
        });

        this.lastFetch = new Date();
        console.log(`✅ Updated exchange rates for ${Object.keys(data.rates).length} currencies`);
      }
    } catch (error) {
      console.error('Failed to fetch exchange rates from API:', error);
      throw error;
    }
  }

  /**
   * Get cached rate if available
   */
  private getCachedRate(fromCurrency: string, toCurrency: string): number | null {
    const fromRate = this.exchangeRates.get(fromCurrency);
    const toRate = this.exchangeRates.get(toCurrency);

    if (fromRate && toRate) {
      // Convert via USD: amount * (1/fromRate) * toRate
      return toRate.rate / fromRate.rate;
    }

    return null;
  }

  /**
   * Get fallback rate from static rates
   */
  private getFallbackRate(fromCurrency: string, toCurrency: string): number {
    const fromRate = this.FALLBACK_RATES[fromCurrency] || 1.0;
    const toRate = this.FALLBACK_RATES[toCurrency] || 1.0;

    // Convert via USD: amount * (1/fromRate) * toRate
    return toRate / fromRate;
  }

  /**
   * Get all supported currencies
   */
  public getSupportedCurrencies(): string[] {
    return Object.keys(this.FALLBACK_RATES);
  }

  /**
   * Format currency amount for display
   */
  public formatCurrency(amount: number, currency: string, symbol?: string): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      currencyDisplay: 'symbol'
    });

    if (symbol) {
      // Use custom symbol if provided
      return `${symbol}${amount.toFixed(2)}`;
    }

    try {
      return formatter.format(amount);
    } catch (error) {
      // Fallback if currency not supported by Intl
      return `${currency} ${amount.toFixed(2)}`;
    }
  }
}

// Export singleton instance
export const currencyConverter = CurrencyConverter.getInstance();