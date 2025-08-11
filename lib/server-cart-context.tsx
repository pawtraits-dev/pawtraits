'use client';

import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import type { Product, ProductPricing } from '@/lib/product-types';
import { getSupabaseClient } from '@/lib/supabase-client';

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
  const [supabase, setSupabase] = useState<any>(null);

  // Initialize Supabase client safely
  useEffect(() => {
    try {
      const client = getSupabaseClient();
      setSupabase(client);
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      setHasError(true);
    }
  }, []);

  // Get auth token for API calls
  const getAuthToken = async () => {
    if (!supabase) return null;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token;
    } catch (error) {
      console.warn('Failed to get auth session:', error);
      return null;
    }
  };

  // Load cart from server on mount and when user changes
  useEffect(() => {
    if (hasError || !supabase) {
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
            discountCode: item.discount_code
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
        } else {
          console.error('Failed to load cart:', response.status);
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
  }, [hasError, supabase]);

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
          discountCode: item.discount_code
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
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

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
          discountCode: item.discountCode
        })
      });

      if (response.ok) {
        await refreshCart();
      } else {
        throw new Error('Failed to add item to cart');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
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
    // Free shipping over £75 (converted to minor units)
    return cart.totalPrice >= 7500 ? 0 : 999; // £9.99 in pence
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