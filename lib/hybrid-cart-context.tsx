'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  addToCart: (item: Omit<CartItem, 'id' | 'addedAt'>) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  migrateGuestCartToServer: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const GUEST_CART_STORAGE_KEY = 'pawtraits_guest_cart';

export function HybridCartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(true);

  // Check auth status and load appropriate cart
  useEffect(() => {
    initializeCart();
  }, []); // Remove initializeCart from deps to avoid temporal dead zone

  const loadGuestCart = useCallback(() => {
    try {
      const stored = localStorage.getItem(GUEST_CART_STORAGE_KEY);
      console.log('Loading guest cart from localStorage:', stored);

      if (stored) {
        const guestItems = JSON.parse(stored);
        console.log('Parsed guest items:', guestItems);

        if (Array.isArray(guestItems)) {
          const validatedItems = validateCartItems(guestItems);
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
  }, []);

  const initializeCart = useCallback(async () => {
    try {
      setLoading(true);

      // Check if user is authenticated (without direct database access)
      const authCheckResponse = await fetch('/api/auth/check', {
        credentials: 'include'
      });

      if (authCheckResponse.ok) {
        const { isAuthenticated } = await authCheckResponse.json();
        setIsGuest(!isAuthenticated);

        if (isAuthenticated) {
          // Check if there are guest cart items to migrate
          const stored = localStorage.getItem(GUEST_CART_STORAGE_KEY);
          if (stored) {
            try {
              const guestItems = JSON.parse(stored);
              if (Array.isArray(guestItems) && guestItems.length > 0) {
                console.log(`🔄 Found ${guestItems.length} guest cart items, triggering migration...`);
                await migrateGuestCartToServer();
                return; // migrateGuestCartToServer already loads the server cart
              }
            } catch (parseError) {
              console.error('Error parsing guest cart for migration:', parseError);
              // Clear invalid guest cart data
              localStorage.removeItem(GUEST_CART_STORAGE_KEY);
            }
          }

          // No guest items to migrate, load server cart normally
          await loadServerCart();
        } else {
          // Load from localStorage
          loadGuestCart();
        }
      } else {
        // Not authenticated, load guest cart
        setIsGuest(true);
        loadGuestCart();
      }
    } catch (error) {
      console.error('Error initializing cart:', error);
      // Fallback to guest cart
      setIsGuest(true);
      loadGuestCart();
    } finally {
      setLoading(false);
    }
  }, [loadGuestCart, migrateGuestCartToServer]);

  const loadServerCart = async () => {
    try {
      const response = await fetch('/api/cart', {
        credentials: 'include'
      });

      if (response.ok) {
        const { items: serverItems } = await response.json();
        console.log('🛒 Server cart loaded:', {
          itemCount: serverItems?.length || 0,
          sampleItem: serverItems?.[0] ? {
            id: serverItems[0].id,
            hasProduct: !!serverItems[0].product,
            hasPricing: !!serverItems[0].pricing,
            productKeys: serverItems[0].product ? Object.keys(serverItems[0].product) : [],
            pricingKeys: serverItems[0].pricing ? Object.keys(serverItems[0].pricing) : []
          } : null
        });
        setItems(serverItems || []);
      } else {
        console.error('Failed to load server cart, status:', response.status);
        setItems([]);
      }
    } catch (error) {
      console.error('Error loading server cart:', error);
      setItems([]);
    }
  };

  const validateCartItems = (items: any[]): CartItem[] => {
    return items.filter((item: any) => {
      if (!item) {
        console.warn('Removing null/undefined cart item');
        return false;
      }

      if (!item.pricing) {
        console.warn('Removing cart item - missing pricing object:', {
          id: item.id,
          imageId: item.imageId,
          productId: item.productId
        });
        return false;
      }

      const hasValidPrice = (
        (typeof item.pricing.sale_price === 'number' && item.pricing.sale_price > 0) ||
        (typeof item.pricing.price === 'number' && item.pricing.price > 0) ||
        (typeof item.pricing.amount === 'number' && item.pricing.amount > 0) ||
        (typeof item.pricing.total === 'number' && item.pricing.total > 0)
      );

      if (!hasValidPrice) {
        console.warn('Removing cart item - no valid price field found:', {
          id: item.id,
          pricing: item.pricing
        });
        return false;
      }

      return true;
    });
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

  const addToCart = async (itemData: Omit<CartItem, 'id' | 'addedAt'>) => {
    if (isGuest) {
      addToGuestCart(itemData);
    } else {
      await addToServerCart(itemData);
    }
  };

  const addToGuestCart = (itemData: Omit<CartItem, 'id' | 'addedAt'>) => {
    console.log('Adding item to guest cart:', itemData);

    const newItem: CartItem = {
      ...itemData,
      id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      addedAt: new Date().toISOString(),
    };

    const existingItemIndex = items.findIndex(
      item => item.productId === itemData.productId && item.imageId === itemData.imageId
    );

    let newItems: CartItem[];
    if (existingItemIndex >= 0) {
      newItems = items.map((item, index) =>
        index === existingItemIndex
          ? { ...item, quantity: item.quantity + itemData.quantity }
          : item
      );
    } else {
      newItems = [...items, newItem];
    }

    setItems(newItems);
    saveGuestCart(newItems);
  };

  const addToServerCart = async (itemData: Omit<CartItem, 'id' | 'addedAt'>) => {
    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(itemData),
      });

      if (!response.ok) {
        throw new Error(`Failed to add to cart: ${response.status}`);
      }

      await loadServerCart();
    } catch (error) {
      console.error('Error adding to server cart:', error);
      throw error;
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(itemId);
      return;
    }

    if (isGuest) {
      const newItems = items.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      );
      setItems(newItems);
      saveGuestCart(newItems);
    } else {
      await updateServerCartQuantity(itemId, quantity);
    }
  };

  const updateServerCartQuantity = async (itemId: string, quantity: number) => {
    try {
      const response = await fetch(`/api/cart/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ quantity }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update cart: ${response.status}`);
      }

      await loadServerCart();
    } catch (error) {
      console.error('Error updating server cart:', error);
      throw error;
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (isGuest) {
      const newItems = items.filter(item => item.id !== itemId);
      setItems(newItems);
      saveGuestCart(newItems);
    } else {
      await removeFromServerCart(itemId);
    }
  };

  const removeFromServerCart = async (itemId: string) => {
    try {
      const response = await fetch(`/api/cart/${itemId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to remove from cart: ${response.status}`);
      }

      await loadServerCart();
    } catch (error) {
      console.error('Error removing from server cart:', error);
      throw error;
    }
  };

  const clearCart = async () => {
    if (isGuest) {
      setItems([]);
      localStorage.removeItem(GUEST_CART_STORAGE_KEY);
    } else {
      await clearServerCart();
    }
  };

  const clearServerCart = async () => {
    try {
      const response = await fetch('/api/cart', {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to clear cart: ${response.status}`);
      }

      setItems([]);
    } catch (error) {
      console.error('Error clearing server cart:', error);
      throw error;
    }
  };

  const migrateGuestCartToServer = async () => {
    try {
      const stored = localStorage.getItem(GUEST_CART_STORAGE_KEY);
      if (!stored) return;

      const guestItems = JSON.parse(stored);
      if (!Array.isArray(guestItems) || guestItems.length === 0) return;

      console.log(`Migrating ${guestItems.length} guest cart items to server...`);

      const response = await fetch('/api/cart/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ items: guestItems }),
      });

      if (!response.ok) {
        throw new Error(`Failed to migrate cart: ${response.status}`);
      }

      localStorage.removeItem(GUEST_CART_STORAGE_KEY);
      setIsGuest(false);
      await loadServerCart();

      console.log('Guest cart migration completed');
    } catch (error) {
      console.error('Error during cart migration:', error);
    }
  };

  // Calculate totals
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => {
    // Safety check for pricing data
    if (!item.pricing) {
      console.warn('Cart item missing pricing data:', {
        itemId: item.id,
        productId: item.productId,
        hasProduct: !!item.product,
        hasPricing: !!item.pricing,
        item: item
      });
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
    isGuest,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    migrateGuestCartToServer,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useHybridCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useHybridCart must be used within a HybridCartProvider');
  }
  return context;
}