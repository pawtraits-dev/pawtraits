'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Product, ProductPricing } from '@/lib/product-types';
import { getSupabaseClient } from '@/lib/supabase-client';
import { SupabaseService } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

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
  const [user, setUser] = useState<any>(null);
  const [initialized, setInitialized] = useState(false);

  const supabase = getSupabaseClient();
  const supabaseService = new SupabaseService();
  const router = useRouter();

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error checking auth status:', error);
        setUser(null);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user || null;
      const previousUser = user;
      setUser(currentUser);

      // If user just logged in and had guest cart, migrate it
      if (!previousUser && currentUser && !initialized) {
        await migrateGuestCartToServer();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialize cart based on auth status
  useEffect(() => {
    if (user === null || user) { // Run for both guest (null) and authenticated users
      initializeCart();
    }
  }, [user]);

  const initializeCart = async () => {
    setLoading(true);

    try {
      if (user) {
        // Authenticated user: load from server
        await loadServerCart();
      } else {
        // Guest user: load from localStorage
        loadGuestCart();
      }
    } catch (error) {
      console.error('Error initializing cart:', error);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  const loadServerCart = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No auth token available');
      }

      const response = await fetch('/api/cart', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load cart: ${response.status}`);
      }

      const data = await response.json();
      const validatedItems = (data.items || []).filter((item: any) => {
        // Validate that cart items have required pricing data
        if (!item.pricing || typeof item.pricing.sale_price !== 'number') {
          console.warn('Removing cart item with invalid pricing:', item);
          return false;
        }
        return true;
      });
      setItems(validatedItems);
    } catch (error) {
      console.error('Error loading server cart:', error);
      setItems([]);
    }
  };

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
            if (!item.pricing || typeof item.pricing.sale_price !== 'number') {
              console.warn('Removing guest cart item with invalid pricing:', item);
              return false;
            }
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

  const getAuthToken = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  const addToCart = async (itemData: Omit<CartItem, 'id' | 'addedAt'>) => {
    if (user) {
      // Authenticated user: add to server
      await addToServerCart(itemData);
    } else {
      // Guest user: add to localStorage
      addToGuestCart(itemData);
    }
  };

  const addToServerCart = async (itemData: Omit<CartItem, 'id' | 'addedAt'>) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No auth token available');
      }

      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(itemData),
      });

      if (!response.ok) {
        throw new Error(`Failed to add to cart: ${response.status}`);
      }

      // Reload cart from server
      await loadServerCart();
    } catch (error) {
      console.error('Error adding to server cart:', error);
      throw error;
    }
  };

  const addToGuestCart = (itemData: Omit<CartItem, 'id' | 'addedAt'>) => {
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

    setItems(newItems);
    saveGuestCart(newItems);
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(itemId);
      return;
    }

    if (user) {
      // Authenticated user: update server
      await updateServerCartQuantity(itemId, quantity);
    } else {
      // Guest user: update localStorage
      updateGuestCartQuantity(itemId, quantity);
    }
  };

  const updateServerCartQuantity = async (itemId: string, quantity: number) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No auth token available');
      }

      const response = await fetch(`/api/cart/${itemId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quantity }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update cart: ${response.status}`);
      }

      // Reload cart from server
      await loadServerCart();
    } catch (error) {
      console.error('Error updating server cart:', error);
      throw error;
    }
  };

  const updateGuestCartQuantity = (itemId: string, quantity: number) => {
    const newItems = items.map(item =>
      item.id === itemId ? { ...item, quantity } : item
    );
    setItems(newItems);
    saveGuestCart(newItems);
  };

  const removeFromCart = async (itemId: string) => {
    if (user) {
      // Authenticated user: remove from server
      await removeFromServerCart(itemId);
    } else {
      // Guest user: remove from localStorage
      removeFromGuestCart(itemId);
    }
  };

  const removeFromServerCart = async (itemId: string) => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No auth token available');
      }

      const response = await fetch(`/api/cart/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to remove from cart: ${response.status}`);
      }

      // Reload cart from server
      await loadServerCart();
    } catch (error) {
      console.error('Error removing from server cart:', error);
      throw error;
    }
  };

  const removeFromGuestCart = (itemId: string) => {
    const newItems = items.filter(item => item.id !== itemId);
    setItems(newItems);
    saveGuestCart(newItems);
  };

  const clearCart = async () => {
    if (user) {
      // Authenticated user: clear server cart
      await clearServerCart();
    } else {
      // Guest user: clear localStorage cart
      clearGuestCart();
    }
  };

  const clearServerCart = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('No auth token available');
      }

      const response = await fetch('/api/cart', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
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

  const clearGuestCart = () => {
    setItems([]);
    localStorage.removeItem(GUEST_CART_STORAGE_KEY);
  };

  const migrateGuestCartToServer = async () => {
    if (!user) return;

    try {
      // Get guest cart items
      const stored = localStorage.getItem(GUEST_CART_STORAGE_KEY);
      if (!stored) return;

      const guestItems = JSON.parse(stored);
      if (!Array.isArray(guestItems) || guestItems.length === 0) return;

      console.log(`Migrating ${guestItems.length} guest cart items to server...`);

      // Add each item to server cart
      for (const item of guestItems) {
        try {
          const itemData = {
            productId: item.productId,
            imageId: item.imageId,
            imageUrl: item.imageUrl,
            imageTitle: item.imageTitle,
            product: item.product,
            pricing: item.pricing,
            quantity: item.quantity,
            partnerId: item.partnerId,
            discountCode: item.discountCode,
            gelatoProductUid: item.gelatoProductUid,
            printSpecs: item.printSpecs,
          };

          await addToServerCart(itemData);
        } catch (error) {
          console.error('Error migrating cart item:', error);
          // Continue with other items even if one fails
        }
      }

      // Clear guest cart after successful migration
      localStorage.removeItem(GUEST_CART_STORAGE_KEY);
      console.log('Guest cart migration completed');

    } catch (error) {
      console.error('Error during cart migration:', error);
    }
  };

  // Calculate totals
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => {
    // Safety check for pricing data
    if (!item.pricing || typeof item.pricing.sale_price !== 'number') {
      console.warn('Cart item missing pricing data:', item);
      return sum;
    }
    return sum + (item.pricing.sale_price * item.quantity);
  }, 0);

  const value: CartContextType = {
    items,
    totalItems,
    totalPrice,
    loading,
    isGuest: !user,
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