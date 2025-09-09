'use client';

import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import type { Product, ProductPricing } from '@/lib/product-types';
import { getSupabaseClient } from '@/lib/supabase-client';
import { SupabaseService } from '@/lib/supabase';

export interface CartItem {
  id: string; // Server-side cart item ID
  productId: string;
  imageId: string;
  imageUrl: string;
  imageTitle: string;
  product: Product;
  pricing: ProductPricing;
  quantity: number;
  addedAt: string;
  partnerId?: string;
  discountCode?: string;
  // Enhanced Gelato integration data (internal use only, not displayed to user)
  gelatoProductUid?: string; // From product.gelato_sku
  printSpecs?: {
    width_cm: number;
    height_cm: number;
    medium: string;
    format: string;
    print_ready_url?: string; // Generated at checkout time
  };
}

interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  loading: boolean;
  initialized: boolean;
}

type CartAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CART'; payload: { items: CartItem[]; totalItems: number; totalPrice: number } }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'CLEAR_CART' };

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_CART':
      return {
        ...state,
        items: action.payload.items,
        totalItems: action.payload.totalItems,
        totalPrice: action.payload.totalPrice,
        loading: false
      };
    
    case 'SET_INITIALIZED':
      return { ...state, initialized: action.payload };
    
    case 'CLEAR_CART':
      return {
        ...state,
        items: [],
        totalItems: 0,
        totalPrice: 0,
        loading: false
      };
    
    default:
      return state;
  }
};

interface CartContextType {
  cart: CartState;
  addToCart: (item: Omit<CartItem, 'id' | 'addedAt'>) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  removeFromCart: (id: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  getShippingCost: () => number;
  getCartTotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const initialState: CartState = {
  items: [],
  totalItems: 0,
  totalPrice: 0,
  loading: false,
  initialized: false
};

export function ServerCartProvider({ children }: { children: React.ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, initialState);
  const [hasError, setHasError] = useState(false);
  const supabaseService = new SupabaseService();

  // Get auth token for API calls
  const getAuthToken = async () => {
    try {
      const { data: { session } } = await supabaseService.getClient().auth.getSession();
      console.log('[CART AUTH] Session check:', { 
        hasSession: !!session, 
        hasUser: !!session?.user,
        hasAccessToken: !!session?.access_token,
        userEmail: session?.user?.email,
        sessionExpiry: session?.expires_at
      });
      
      if (!session) {
        console.log('[CART AUTH] No session found - user needs to log in');
      }
      
      return session?.access_token || null;
    } catch (error) {
      console.error('[CART AUTH] Failed to get auth session:', error);
      return null;
    }
  };

  // Load cart from server on mount and when user changes
  useEffect(() => {
    if (hasError) {
      dispatch({ type: 'SET_INITIALIZED', payload: true });
      return;
    }
    
    let mounted = true;

    const loadCart = async () => {
      try {
        const token = await getAuthToken();
        if (!token) {
          if (mounted) {
            dispatch({ type: 'SET_INITIALIZED', payload: true });
          }
          return;
        }

        dispatch({ type: 'SET_LOADING', payload: true });

        const response = await fetch('/api/cart', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          // Transform server data to match CartItem interface
          const transformedItems: CartItem[] = data.items.map((item: any) => ({
            id: item.cart_item_id,
            productId: item.product_id,
            imageId: item.image_id,
            imageUrl: item.image_url,
            imageTitle: item.image_title,
            product: item.product_data,
            pricing: item.pricing_data,
            quantity: item.quantity,
            addedAt: item.created_at,
            partnerId: item.partner_id,
            discountCode: item.discount_code,
            // Enhanced Gelato data from product
            gelatoProductUid: item.product_data?.gelato_sku,
            printSpecs: item.product_data ? {
              width_cm: item.product_data.width_cm || 30,
              height_cm: item.product_data.height_cm || 30,
              medium: item.product_data.medium?.name || 'Canvas',
              format: item.product_data.format?.name || 'Portrait'
            } : undefined
          }));

          if (mounted) {
            dispatch({
              type: 'SET_CART',
              payload: {
                items: transformedItems,
                totalItems: data.totalItems,
                totalPrice: data.totalPrice
              }
            });
          }
        } else if (response.status === 401) {
          console.log('[CART] User not authenticated, starting with empty cart');
          if (mounted) {
            dispatch({
              type: 'SET_CART',
              payload: {
                items: [],
                totalItems: 0,
                totalPrice: 0
              }
            });
          }
        } else {
          console.error('Failed to load cart:', response.status, response.statusText);
          if (mounted) {
            dispatch({ type: 'SET_LOADING', payload: false });
          }
        }
      } catch (error) {
        console.error('Error loading cart:', error);
        if (mounted) {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } finally {
        if (mounted) {
          dispatch({ type: 'SET_INITIALIZED', payload: true });
        }
      }
    };

    loadCart();

    return () => {
      mounted = false;
    };
  }, [hasError]);

  const refreshCart = async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch('/api/cart', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        const transformedItems: CartItem[] = data.items.map((item: any) => ({
          id: item.cart_item_id,
          productId: item.product_id,
          imageId: item.image_id,
          imageUrl: item.image_url,
          imageTitle: item.image_title,
          product: item.product_data,
          pricing: item.pricing_data,
          quantity: item.quantity,
          addedAt: item.created_at,
          partnerId: item.partner_id,
          discountCode: item.discount_code,
          // Enhanced Gelato data from product
          gelatoProductUid: item.product_data?.gelato_sku,
          printSpecs: item.product_data ? {
            width_cm: item.product_data.width_cm || 30,
            height_cm: item.product_data.height_cm || 30,
            medium: item.product_data.medium?.name || 'Canvas',
            format: item.product_data.format?.name || 'Portrait'
          } : undefined
        }));

        dispatch({
          type: 'SET_CART',
          payload: {
            items: transformedItems,
            totalItems: data.totalItems,
            totalPrice: data.totalPrice
          }
        });
      }
    } catch (error) {
      console.error('Error refreshing cart:', error);
    }
  };

  const addToCart = async (item: Omit<CartItem, 'id' | 'addedAt'>) => {
    try {
      console.log('[CART] Adding item to cart:', item);
      
      const token = await getAuthToken();
      if (!token) {
        console.error('[CART] No auth token available');
        throw new Error('Authentication required');
      }
      
      console.log('[CART] Auth token obtained, making request...');

      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: item.productId,
          imageId: item.imageId,
          imageUrl: item.imageUrl,
          imageTitle: item.imageTitle,
          quantity: item.quantity,
          pricing: item.pricing,
          product: item.product,
          partnerId: item.partnerId,
          discountCode: item.discountCode,
          // Enhanced Gelato data for order fulfillment
          gelatoProductUid: item.gelatoProductUid,
          printSpecs: item.printSpecs
        })
      });

      console.log('[CART] Response status:', response.status);

      if (response.ok) {
        console.log('[CART] Item added successfully, refreshing cart...');
        await refreshCart();
        console.log('[CART] Cart refreshed');
      } else if (response.status === 401) {
        console.error('[CART] User not authenticated for adding to cart');
        throw new Error('Please log in to add items to your cart');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[CART] Failed to add item:', errorData);
        throw new Error(`Failed to add item to cart: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[CART] Error adding to cart:', error);
      throw error;
    }
  };

  const updateQuantity = async (id: string, quantity: number) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/cart/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ quantity })
      });

      if (response.ok) {
        await refreshCart();
      } else {
        throw new Error('Failed to update cart item');
      }
    } catch (error) {
      console.error('Error updating cart item:', error);
      throw error;
    }
  };

  const removeFromCart = async (id: string) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`/api/cart/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await refreshCart();
      } else {
        throw new Error('Failed to remove cart item');
      }
    } catch (error) {
      console.error('Error removing from cart:', error);
      throw error;
    }
  };

  const clearCart = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch('/api/cart', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        dispatch({ type: 'CLEAR_CART' });
      } else {
        throw new Error('Failed to clear cart');
      }
    } catch (error) {
      console.error('Error clearing cart:', error);
      throw error;
    }
  };

  const getShippingCost = () => {
    // Get selected country from localStorage (same key as country context)
    let selectedCountryCode = 'GB'; // Default fallback
    
    // Only access localStorage on client side
    if (typeof window !== 'undefined') {
      const storedCountry = localStorage.getItem('pawtraits_selected_country');
      if (storedCountry) {
        selectedCountryCode = storedCountry;
      }
    }

    // Country-specific shipping rates (can be moved to database later)
    const shippingRates: Record<string, { freeThreshold: number; standardCost: number }> = {
      'GB': { freeThreshold: 7500, standardCost: 999 }, // £75 free, £9.99 standard
      'US': { freeThreshold: 10000, standardCost: 1299 }, // $100 free, $12.99 standard
      'EU': { freeThreshold: 8500, standardCost: 1199 }, // €85 free, €11.99 standard
      'DE': { freeThreshold: 8500, standardCost: 1199 }, // €85 free, €11.99 standard
      'FR': { freeThreshold: 8500, standardCost: 1199 }, // €85 free, €11.99 standard
      'CA': { freeThreshold: 12000, standardCost: 1599 }, // CAD $120 free, $15.99 standard
      'AU': { freeThreshold: 12000, standardCost: 1599 }, // AUD $120 free, $15.99 standard
    };

    const rates = shippingRates[selectedCountryCode] || shippingRates['GB'];
    return cart.totalPrice >= rates.freeThreshold ? 0 : rates.standardCost;
  };

  const getCartTotal = () => {
    return cart.totalPrice + getShippingCost();
  };

  const contextValue: CartContextType = {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    refreshCart,
    getShippingCost,
    getCartTotal,
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export function useServerCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useServerCart must be used within a ServerCartProvider');
  }
  return context;
}