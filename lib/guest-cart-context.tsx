'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
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

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  loading: boolean;
  isGuest: boolean;
  addToCart: (item: Omit<CartItem, 'id' | 'addedAt'>) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const GUEST_CART_STORAGE_KEY = 'pawtraits_guest_cart';

export function GuestCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize cart from localStorage only (guest cart only)
  useEffect(() => {
    loadGuestCart();
    setLoading(false);
  }, []);

  const loadGuestCart = () => {
    try {
      const stored = localStorage.getItem(GUEST_CART_STORAGE_KEY);
      console.log('Loading guest cart from localStorage:', stored);

      if (stored) {
        const guestItems = JSON.parse(stored);
        console.log('Parsed guest items:', guestItems);

        if (Array.isArray(guestItems)) {
          // Validate guest cart items
          const validatedItems = guestItems.filter((item: any) => {
            // Check if item has basic structure
            if (!item) {
              console.warn('Removing null/undefined cart item');
              return false;
            }

            // Check pricing structure more thoroughly
            if (!item.pricing) {
              console.warn('Removing cart item - missing pricing object:', {
                id: item.id,
                imageId: item.imageId,
                productId: item.productId,
                hasPricing: !!item.pricing
              });
              return false;
            }

            // Check for sale_price or other price fields that might be used
            const hasValidPrice = (
              (typeof item.pricing.sale_price === 'number' && item.pricing.sale_price > 0) ||
              (typeof item.pricing.price === 'number' && item.pricing.price > 0) ||
              (typeof item.pricing.amount === 'number' && item.pricing.amount > 0) ||
              (typeof item.pricing.total === 'number' && item.pricing.total > 0)
            );

            if (!hasValidPrice) {
              console.warn('Removing cart item - no valid price field found:', {
                id: item.id,
                imageId: item.imageId,
                productId: item.productId,
                pricing: item.pricing,
                available_price_fields: {
                  sale_price: item.pricing.sale_price,
                  price: item.pricing.price,
                  amount: item.pricing.amount,
                  total: item.pricing.total
                }
              });
              return false;
            }

            // Item is valid
            return true;
          });
          console.log(`Guest cart validation: ${guestItems.length} items → ${validatedItems.length} valid items`);
          setItems(validatedItems);
        } else {
          console.log('Guest cart data is not an array, clearing items');
          setItems([]);
        }
      } else {
        console.log('No guest cart data found in localStorage');
        setItems([]);
      }
    } catch (error) {
      console.error('Error loading guest cart:', error);
      setItems([]);
    }
  };

  const saveGuestCart = (newItems: CartItem[]) => {
    try {
      console.log('Saving guest cart to localStorage:', newItems);
      localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(newItems));
      console.log('Guest cart saved successfully');
    } catch (error) {
      console.error('Error saving guest cart:', error);
    }
  };

  const addToCart = (itemData: Omit<CartItem, 'id' | 'addedAt'>) => {
    console.log('Adding item to guest cart:', itemData);

    const newItem: CartItem = {
      ...itemData,
      id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      addedAt: new Date().toISOString(),
    };

    console.log('Created new cart item:', newItem);

    // Check if item already exists (same product + image combination)
    const existingItemIndex = items.findIndex(
      item => item.productId === itemData.productId &&
               item.imageId === itemData.imageId
    );

    let newItems: CartItem[];

    if (existingItemIndex >= 0) {
      // Update quantity of existing item
      newItems = items.map((item, index) =>
        index === existingItemIndex
          ? { ...item, quantity: item.quantity + itemData.quantity }
          : item
      );
    } else {
      // Add new item
      newItems = [...items, newItem];
    }

    console.log('Setting cart items:', newItems);
    setItems(newItems);
    saveGuestCart(newItems);
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    const newItems = items.map(item =>
      item.id === itemId ? { ...item, quantity } : item
    );
    setItems(newItems);
    saveGuestCart(newItems);
  };

  const removeFromCart = (itemId: string) => {
    const newItems = items.filter(item => item.id !== itemId);
    setItems(newItems);
    saveGuestCart(newItems);
  };

  const clearCart = () => {
    setItems([]);
    localStorage.removeItem(GUEST_CART_STORAGE_KEY);
  };

  // Calculate totals
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => {
    // Safety check for pricing data
    if (!item.pricing) {
      console.warn('Cart item missing pricing data:', item);
      return sum;
    }

    // Get the price from whatever field is available
    const itemPrice = item.pricing.sale_price ||
                     item.pricing.price ||
                     item.pricing.amount ||
                     item.pricing.total ||
                     0;

    if (typeof itemPrice !== 'number' || itemPrice <= 0) {
      console.warn('Cart item has no valid price field:', item);
      return sum;
    }

    return sum + (itemPrice * item.quantity);
  }, 0);

  const value: CartContextType = {
    items,
    totalItems,
    totalPrice,
    loading,
    isGuest: true, // This is always a guest cart
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useGuestCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useGuestCart must be used within a GuestCartProvider');
  }
  return context;
}