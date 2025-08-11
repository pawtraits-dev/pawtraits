'use client';

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { Product, ProductPricing } from '@/lib/product-types';

export interface CartItem {
  id: string; // Unique cart item ID
  productId: string;
  imageId: string;
  imageUrl: string;
  imageTitle: string;
  product: Product;
  pricing: ProductPricing;
  quantity: number;
  addedAt: string;
  partnerId?: string; // Partner referral ID
  discountCode?: string; // Partner discount code
}

interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
}

type CartAction =
  | { type: 'ADD_ITEM'; payload: Omit<CartItem, 'id' | 'addedAt'> }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'CLEAR_CART' }
  | { type: 'LOAD_CART'; payload: CartItem[] };

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      // Check if item already exists (same product + image combination)
      const existingItemIndex = state.items.findIndex(
        item => item.productId === action.payload.productId && 
                item.imageId === action.payload.imageId
      );

      let newItems: CartItem[];
      
      if (existingItemIndex >= 0) {
        // Update quantity of existing item
        newItems = state.items.map((item, index) =>
          index === existingItemIndex
            ? { ...item, quantity: item.quantity + action.payload.quantity }
            : item
        );
      } else {
        // Add new item
        const newItem: CartItem = {
          ...action.payload,
          id: `${action.payload.productId}-${action.payload.imageId}-${Date.now()}`,
          addedAt: new Date().toISOString(),
        };
        newItems = [...state.items, newItem];
      }

      return calculateTotals({ ...state, items: newItems });
    }

    case 'UPDATE_QUANTITY': {
      const newItems = state.items.map(item =>
        item.id === action.payload.id
          ? { ...item, quantity: Math.max(0, action.payload.quantity) }
          : item
      ).filter(item => item.quantity > 0); // Remove items with 0 quantity

      return calculateTotals({ ...state, items: newItems });
    }

    case 'REMOVE_ITEM': {
      const newItems = state.items.filter(item => item.id !== action.payload.id);
      return calculateTotals({ ...state, items: newItems });
    }

    case 'CLEAR_CART': {
      return calculateTotals({ ...state, items: [] });
    }

    case 'LOAD_CART': {
      return calculateTotals({ ...state, items: action.payload });
    }

    default:
      return state;
  }
};

const calculateTotals = (state: CartState): CartState => {
  const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = state.items.reduce((sum, item) => 
    sum + (item.pricing.sale_price * item.quantity), 0
  );

  return {
    ...state,
    totalItems,
    totalPrice,
  };
};

interface CartContextType {
  cart: CartState;
  addToCart: (item: Omit<CartItem, 'id' | 'addedAt'>) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  getShippingCost: () => number;
  getCartTotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const initialState: CartState = {
  items: [],
  totalItems: 0,
  totalPrice: 0,
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, initialState);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('pawtraits-cart');
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        dispatch({ type: 'LOAD_CART', payload: parsedCart });
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('pawtraits-cart', JSON.stringify(cart.items));
  }, [cart.items]);

  const addToCart = (item: Omit<CartItem, 'id' | 'addedAt'>) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  };

  const updateQuantity = (id: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  };

  const removeFromCart = (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
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
    getShippingCost,
    getCartTotal,
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}