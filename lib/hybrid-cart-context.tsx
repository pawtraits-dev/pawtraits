'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { Product, ProductPricing } from '@/lib/product-types';
import { BundlePricingService, type BundlePricing } from '@/lib/bundle-pricing-service';

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
  digitalBundlePricing: BundlePricing | null;
  getMasterBundleProductId: () => Promise<string | null>;
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
  const [digitalBundlePricing, setDigitalBundlePricing] = useState<BundlePricing | null>(null);

  // Initialize bundle pricing service once
  const bundlePricingService = useMemo(() => new BundlePricingService(), []);

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

          // Merge with any existing items (in case items were added during loading)
          setItems(currentItems => {
            const existingItems = currentItems.filter(item => item.id.startsWith('guest_'));
            const allItems = [...existingItems, ...validatedItems];

            // Remove duplicates based on productId and imageId
            const uniqueItems = allItems.reduce((acc: CartItem[], item) => {
              const existing = acc.find(existing =>
                existing.productId === item.productId && existing.imageId === item.imageId
              );

              if (existing) {
                // Merge quantities
                existing.quantity += item.quantity;
                return acc;
              } else {
                return [...acc, item];
              }
            }, []);

            console.log(`Merged cart: ${existingItems.length} existing + ${validatedItems.length} stored = ${uniqueItems.length} final items`);
            return uniqueItems;
          });
        } else {
          console.log('Guest cart data is not an array, using existing items');
          // Don't clear items, just keep what we have
        }
      } else {
        console.log('No guest cart data found in localStorage, keeping existing items');
        // Don't clear items, just keep what we have
      }
    } catch (error) {
      console.error('Error loading guest cart:', error);
      // Don't clear items on error, just keep what we have
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
                // Direct migration call to avoid circular dependency
                try {
                  const response = await fetch('/api/cart/migrate', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({ items: guestItems }),
                  });

                  if (response.ok) {
                    localStorage.removeItem(GUEST_CART_STORAGE_KEY);
                    setIsGuest(false);
                    // Load server cart after migration
                    const cartResponse = await fetch('/api/cart', {
                      credentials: 'include'
                    });
                    if (cartResponse.ok) {
                      const { items: serverItems } = await cartResponse.json();
                      setItems(serverItems || []);
                    }
                  }
                } catch (migrateError) {
                  console.error('Error during cart migration:', migrateError);
                  loadGuestCart(); // Fallback to guest cart
                }
                return;
              }
            } catch (parseError) {
              console.error('Error parsing guest cart for migration:', parseError);
              // Clear invalid guest cart data
              localStorage.removeItem(GUEST_CART_STORAGE_KEY);
            }
          }

          // No guest items to migrate, load server cart normally
          try {
            const response = await fetch('/api/cart', {
              credentials: 'include'
            });

            if (response.ok) {
              const { items: serverItems } = await response.json();
              setItems(serverItems || []);
            } else {
              console.error('Failed to load server cart');
              setItems([]);
            }
          } catch (error) {
            console.error('Error loading server cart:', error);
            setItems([]);
          }
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
  }, [loadGuestCart]);

  const loadServerCart = useCallback(async () => {
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
  }, []);

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
    // If still loading, wait for initialization to complete
    if (loading) {
      console.log('Cart still loading, adding to guest cart directly');
      addToGuestCart(itemData);
      return;
    }

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

    setItems(currentItems => {
      const existingItemIndex = currentItems.findIndex(
        item => item.productId === itemData.productId && item.imageId === itemData.imageId
      );

      let newItems: CartItem[];
      if (existingItemIndex >= 0) {
        newItems = currentItems.map((item, index) =>
          index === existingItemIndex
            ? { ...item, quantity: item.quantity + itemData.quantity }
            : item
        );
      } else {
        newItems = [...currentItems, newItem];
      }

      // Save to localStorage immediately
      saveGuestCart(newItems);
      console.log(`Guest cart updated: ${newItems.length} items, saved to localStorage`);

      return newItems;
    });
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

      // Reload server cart inline to avoid circular dependency
      try {
        const cartResponse = await fetch('/api/cart', {
          credentials: 'include'
        });

        if (cartResponse.ok) {
          const { items: serverItems } = await cartResponse.json();
          setItems(serverItems || []);
        }
      } catch (error) {
        console.error('Error loading server cart after add:', error);
        setItems([]);
      }
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
      setItems(currentItems => {
        const newItems = currentItems.map(item =>
          item.id === itemId ? { ...item, quantity } : item
        );
        saveGuestCart(newItems);
        return newItems;
      });
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

      // Reload server cart inline to avoid circular dependency
      try {
        const cartResponse = await fetch('/api/cart', {
          credentials: 'include'
        });

        if (cartResponse.ok) {
          const { items: serverItems } = await cartResponse.json();
          setItems(serverItems || []);
        }
      } catch (error) {
        console.error('Error loading server cart after update:', error);
        setItems([]);
      }
    } catch (error) {
      console.error('Error updating server cart:', error);
      throw error;
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (isGuest) {
      setItems(currentItems => {
        const newItems = currentItems.filter(item => item.id !== itemId);
        saveGuestCart(newItems);
        return newItems;
      });
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

      // Reload server cart inline to avoid circular dependency
      try {
        const cartResponse = await fetch('/api/cart', {
          credentials: 'include'
        });

        if (cartResponse.ok) {
          const { items: serverItems } = await cartResponse.json();
          setItems(serverItems || []);
        }
      } catch (error) {
        console.error('Error loading server cart after remove:', error);
        setItems([]);
      }
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

  const migrateGuestCartToServer = useCallback(async () => {
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

      // Load server cart inline to avoid circular dependency
      try {
        const cartResponse = await fetch('/api/cart', {
          credentials: 'include'
        });

        if (cartResponse.ok) {
          const { items: serverItems } = await cartResponse.json();
          setItems(serverItems || []);
        }
      } catch (error) {
        console.error('Error loading server cart after migration:', error);
        setItems([]);
      }

      console.log('Guest cart migration completed');
    } catch (error) {
      console.error('Error during cart migration:', error);
    }
  }, []);

  const getMasterBundleProductId = useCallback(async () => {
    try {
      return await bundlePricingService.getMasterBundleProductId();
    } catch (error) {
      console.error('❌ [Bundle Pricing] Failed to get master bundle product ID:', error);
      return null;
    }
  }, [bundlePricingService]);

  // Load bundle pricing when items change
  useEffect(() => {
    const loadBundlePricing = async () => {
      try {
        // Filter digital download items
        const digitalItems = items.filter(item => {
          const productData = item.product as any;
          return productData?.product_type === 'digital_download';
        });

        if (digitalItems.length > 0) {
          console.log(`💰 [Bundle Pricing] Calculating pricing for ${digitalItems.length} digital items`);
          const pricing = await bundlePricingService.calculateBundlePrice(digitalItems.length);
          setDigitalBundlePricing(pricing);
        } else {
          setDigitalBundlePricing(null);
        }
      } catch (error) {
        console.error('❌ [Bundle Pricing] Failed to calculate bundle pricing:', error);
        setDigitalBundlePricing(null);
      }
    };

    loadBundlePricing();
  }, [items, bundlePricingService]);

  // Calculate totals
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const totalPrice = useMemo(() => {
    let total = 0;

    // Physical products: use individual pricing
    const physicalItems = items.filter(item => {
      const productData = item.product as any;
      return productData?.product_type !== 'digital_download';
    });

    for (const item of physicalItems) {
      // Safety check for pricing data
      if (!item.pricing) {
        console.warn('Cart item missing pricing data:', {
          itemId: item.id,
          productId: item.productId,
          hasProduct: !!item.product,
          hasPricing: !!item.pricing,
          item: item
        });
        continue;
      }

      // Get the price from whatever field is available
      const itemPrice = item.pricing.sale_price ||
                       item.pricing.price ||
                       item.pricing.amount ||
                       item.pricing.total ||
                       0;

      if (typeof itemPrice !== 'number' || itemPrice <= 0) {
        console.warn('Cart item has no valid price field:', item);
        continue;
      }

      total += itemPrice * item.quantity;
    }

    // Digital products: use bundle pricing
    if (digitalBundlePricing) {
      total += digitalBundlePricing.total_price;
      console.log(`💰 [Bundle Pricing] Total price: Physical £${(total - digitalBundlePricing.total_price) / 100} + Digital £${digitalBundlePricing.total_price / 100} = £${total / 100}`);
    }

    return total;
  }, [items, digitalBundlePricing]);

  const value: CartContextType = {
    items,
    totalItems,
    totalPrice,
    loading,
    isGuest,
    digitalBundlePricing,
    getMasterBundleProductId,
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