/**
 * Shared validation library for customer and partner checkout processes
 * Ensures consistent validation logic across both routes
 */

import { SupabaseService } from './supabase';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface Address {
  firstName: string;
  lastName: string;
  email: string;
  address: string; // For backward compatibility
  addressLine1?: string; // New field for separate address lines
  addressLine2?: string; // New field for separate address lines
  city: string;
  postcode: string;
  country: string;
  // Partner-specific fields
  businessName?: string;
  isForClient?: boolean;
  clientName?: string;
  clientEmail?: string;
}

export interface ReferralValidation {
  valid: boolean;
  error?: string;
  discount?: {
    eligible: boolean;
    amount: number; // in pence
    description: string;
  };
}

export interface Country {
  code: string;
  name: string;
  currency_code: string;
  currency_symbol: string;
  flag: string;
}

export class CheckoutValidationService {
  private supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  /**
   * Validate shipping address with country-specific rules
   */
  validateAddress(address: Address, countries?: Country[]): ValidationResult {
    const errors: string[] = [];

    // Basic field validation
    if (!address.firstName?.trim()) errors.push("First name is required");
    if (!address.lastName?.trim()) errors.push("Last name is required");
    
    if (!address.email?.trim()) {
      errors.push("Email address is required");
    } else if (!this.isValidEmail(address.email.trim())) {
      errors.push("Please enter a valid email address");
    }
    
    // Address validation - check for either old format or new address lines
    if (address.addressLine1) {
      if (!address.addressLine1.trim()) {
        errors.push("Address line 1 is required");
      } else if (address.addressLine1.trim().length > 35) {
        errors.push("Address line 1 must be 35 characters or less (Gelato requirement). Please use Address Line 2 for additional details.");
      }
      // Address line 2 validation
      if (address.addressLine2 && address.addressLine2.trim().length > 35) {
        errors.push("Address line 2 must be 35 characters or less");
      }
    } else if (!address.address?.trim()) {
      errors.push("Address is required");
    } else if (address.address.trim().length > 35) {
      errors.push("Address must be 35 characters or less (Gelato requirement)");
    }
    if (!address.city?.trim()) errors.push("City is required");
    if (!address.postcode?.trim()) errors.push("Postcode is required");
    
    // Country validation
    if (!address.country?.trim()) {
      errors.push("Country is required");
    } else if (countries && countries.length > 0) {
      const isValidCountry = countries.some(c => c.name === address.country);
      if (!isValidCountry) {
        errors.push("Please select a valid country from the list");
      }
    }
    
    // Postcode format validation
    const postcodeValidation = this.validatePostcode(address.postcode?.trim() || '', address.country, countries);
    if (!postcodeValidation.isValid) {
      errors.push(postcodeValidation.error || "Invalid postcode format");
    }

    // Client information validation (for partner orders)
    if (address.isForClient) {
      if (!address.clientName?.trim()) {
        errors.push("Client name is required");
      }
      if (!address.clientEmail?.trim()) {
        errors.push("Client email is required");
      } else if (!this.isValidEmail(address.clientEmail.trim())) {
        errors.push("Please enter a valid client email address");
      }
    }

    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined
    };
  }

  /**
   * Validate postcode format based on country
   */
  private validatePostcode(postcode: string, country: string, countries?: Country[]): ValidationResult {
    if (!postcode) return { isValid: false, error: "Postcode is required" };
    
    // Get country code from country name
    const selectedCountryInfo = countries?.find(c => c.name === country);
    const countryCode = selectedCountryInfo?.code;
    
    if (!countryCode) {
      // If we don't have country info, just check it's not empty
      return { isValid: true };
    }

    let postcodeValid = true;
    let postcodeFormat = "";
    
    switch (countryCode) {
      case 'GB': // UK postcode format
        postcodeValid = /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9][A-Z]{2}$/i.test(postcode);
        postcodeFormat = "UK postcode format (e.g., SW1A 1AA)";
        break;
      case 'US': // US zip code format
        postcodeValid = /^[0-9]{5}(-[0-9]{4})?$/.test(postcode);
        postcodeFormat = "US zip code format (e.g., 12345 or 12345-6789)";
        break;
      case 'CA': // Canadian postal code format
        postcodeValid = /^[A-Z][0-9][A-Z]\s?[0-9][A-Z][0-9]$/i.test(postcode);
        postcodeFormat = "Canadian postal code format (e.g., K1A 0A6)";
        break;
      case 'DE': // German postcode format
      case 'FR': // French postcode format
        postcodeValid = /^[0-9]{5}$/.test(postcode);
        postcodeFormat = "5-digit postal code (e.g., 12345)";
        break;
      case 'AU': // Australian postcode format
        postcodeValid = /^[0-9]{4}$/.test(postcode);
        postcodeFormat = "4-digit postcode (e.g., 1234)";
        break;
      default:
        // For other countries, just check it's not empty
        postcodeValid = true;
    }
    
    return {
      isValid: postcodeValid,
      error: postcodeValid ? undefined : `Please enter a valid ${postcodeFormat}`
    };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Validate referral code (customer orders only)
   */
  async validateReferralCode(
    referralCode: string,
    customerEmail: string,
    orderTotal: number // in pounds
  ): Promise<ReferralValidation> {
    if (!referralCode || !customerEmail) {
      return { valid: false, error: 'Referral code and customer email required' };
    }

    try {
      const response = await fetch('/api/referrals/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralCode: referralCode,
          customerEmail: customerEmail,
          orderTotal: orderTotal
        })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error validating referral:', error);
      return { valid: false, error: 'Failed to validate referral code' };
    }
  }

  /**
   * Validate cart items with Gelato availability
   */
  async validateCart(authToken: string): Promise<ValidationResult> {
    try {
      const response = await fetch('/api/cart/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          mode: 'full' // Full validation including Gelato API calls
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Validation failed: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        isValid: data.isValid,
        error: data.errors?.length > 0 ? data.errors[0].error : undefined,
        warnings: data.warnings?.map((w: any) => w.message) || []
      };
    } catch (error) {
      console.error('Error validating cart:', error);
      
      return {
        isValid: false,
        error: `Validation service error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get shipping options from Gelato
   */
  async getShippingOptions(
    shippingAddress: {
      firstName: string;
      lastName: string;
      address1: string;
      city: string;
      postalCode: string;
      country: string; // country code (e.g., 'GB', 'US')
    },
    cartItems: Array<{
      gelatoProductUid: string;
      quantity: number;
      printSpecs: any;
    }>,
    authToken?: string
  ): Promise<{ success: boolean; shippingOptions?: any[]; error?: string }> {
    try {
      const response = await fetch('/api/shipping/options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify({
          shippingAddress,
          cartItems
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch shipping options');
      }

      const { shippingOptions } = await response.json();
      
      if (!shippingOptions || shippingOptions.length === 0) {
        throw new Error('No shipping options available for this address');
      }

      return {
        success: true,
        shippingOptions
      };
    } catch (error) {
      console.error('Error fetching shipping options:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch shipping options'
      };
    }
  }

  /**
   * Determine customer email based on order type
   * For partner-client orders, use client email as the customer
   */
  getCustomerEmail(address: Address): string {
    return address.isForClient && address.clientEmail 
      ? address.clientEmail 
      : address.email;
  }

  /**
   * Determine customer name based on order type
   */
  getCustomerName(address: Address): string {
    return address.isForClient && address.clientName 
      ? address.clientName 
      : `${address.firstName} ${address.lastName}`.trim();
  }

  /**
   * Determine order type based on user type and client flag
   */
  getOrderType(userType: string, isForClient: boolean): 'customer' | 'partner' | 'partner_for_client' {
    if (userType === 'partner') {
      return isForClient ? 'partner_for_client' : 'partner';
    }
    return 'customer';
  }

  /**
   * Get address lines formatted for Gelato API
   * Handles both old single address field and new address lines
   */
  getAddressLinesForGelato(address: Address): { address1: string; address2?: string } {
    if (address.addressLine1) {
      return {
        address1: address.addressLine1.trim(),
        address2: address.addressLine2?.trim() || undefined
      };
    } else {
      // Fallback to old single address field
      return {
        address1: address.address?.trim() || '',
        address2: undefined
      };
    }
  }

  /**
   * Get combined address string for display purposes
   */
  getCombinedAddress(address: Address): string {
    if (address.addressLine1) {
      const line1 = address.addressLine1.trim();
      const line2 = address.addressLine2?.trim();
      return line2 ? `${line1}, ${line2}` : line1;
    } else {
      return address.address?.trim() || '';
    }
  }

  /**
   * Validate complete checkout data
   */
  async validateCheckout(
    address: Address,
    countries: Country[],
    cartItems: any[],
    authToken: string,
    options: {
      validateReferral?: boolean;
      referralCode?: string;
      orderTotal?: number;
    } = {}
  ): Promise<{
    address: ValidationResult;
    cart: ValidationResult;
    referral?: ReferralValidation;
    overall: ValidationResult;
  }> {
    const results = {
      address: this.validateAddress(address, countries),
      cart: await this.validateCart(authToken),
      referral: undefined as ReferralValidation | undefined,
      overall: { isValid: true } as ValidationResult
    };

    // Validate referral if requested (customer orders only)
    if (options.validateReferral && options.referralCode && options.orderTotal) {
      const customerEmail = this.getCustomerEmail(address);
      results.referral = await this.validateReferralCode(
        options.referralCode,
        customerEmail,
        options.orderTotal
      );
    }

    // Determine overall validation result
    const allValid = results.address.isValid && 
                    results.cart.isValid && 
                    (!results.referral || results.referral.valid);

    results.overall = {
      isValid: allValid,
      error: allValid ? undefined : 'Please fix the validation errors above'
    };

    return results;
  }
}

// Export singleton instance
export const checkoutValidation = new CheckoutValidationService();