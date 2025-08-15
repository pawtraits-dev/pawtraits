'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShoppingCart, Plus, Minus, X } from 'lucide-react';
import type { ImageCatalogWithDetails } from '@/lib/types';
import { CatalogImage } from '@/components/CloudinaryImageDisplay';

// Generic image interface that works with both catalog and customer page images
interface GenericImage {
  id: string;
  public_url: string;
  description?: string;
  format_id?: string;
  breed_name?: string;
  theme_name?: string;
  style_name?: string;
  coat_name?: string;
  // Customer page format
  breed?: { name: string };
  theme?: { name: string };
  style?: { name: string };
}
import type { Product, ProductPricing } from '@/lib/product-types';
import { formatPrice, formatProductDimensions } from '@/lib/product-types';
import { useServerCart } from '@/lib/server-cart-context';
import { useRouter } from 'next/navigation';

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: GenericImage;
  products: Product[];
  pricing: ProductPricing[];
  onAddToBasket: (productId: string, quantity: number) => void;
}

interface CartItem {
  productId: string;
  quantity: number;
}

export default function ProductSelectionModal({
  isOpen,
  onClose,
  image,
  products,
  pricing,
  onAddToBasket
}: ProductSelectionModalProps) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const { addToCart } = useServerCart();
  const router = useRouter();

  // Get products that match the image's format and have GB pricing (default country)
  const availableProducts = products.filter(product => {
    const gbPricing = pricing.find(p => 
      p.product_id === product.id && p.country_code === 'GB'
    );
    // Filter by format_id if available, otherwise show all active products with pricing
    const formatMatches = !image.format_id || product.format_id === image.format_id;
    return product.is_active && gbPricing && formatMatches;
  });

  const getProductPricing = (productId: string) => {
    return pricing.find(p => p.product_id === productId && p.country_code === 'GB');
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCartItems(prev => prev.filter(item => item.productId !== productId));
    } else {
      setCartItems(prev => {
        const existingIndex = prev.findIndex(item => item.productId === productId);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex].quantity = newQuantity;
          return updated;
        } else {
          return [...prev, { productId, quantity: newQuantity }];
        }
      });
    }
  };

  const getQuantity = (productId: string) => {
    return cartItems.find(item => item.productId === productId)?.quantity || 0;
  };

  const handleAddAllToBasket = () => {
    cartItems.forEach(item => {
      const product = availableProducts.find(p => p.id === item.productId);
      const productPricing = getProductPricing(item.productId);
      
      if (product && productPricing) {
        addToCart({
          productId: item.productId,
          imageId: image.id,
          imageUrl: image.public_url,
          imageTitle: image.description || 'Pet Portrait',
          product,
          pricing: productPricing,
          quantity: item.quantity,
          // Enhanced Gelato data (not shown to user, used internally)
          gelatoProductUid: product.gelato_sku || undefined,
          printSpecs: {
            width_cm: product.width_cm || 30,
            height_cm: product.height_cm || 30,
            medium: product.medium?.name || 'Canvas',
            format: product.format?.name || 'Portrait'
            // print_ready_url will be generated at checkout time
          }
        });
      }
    });
    
    // Note: Removed duplicate callback to prevent double addition to cart
    
    setCartItems([]);
    onClose();
    
    // Redirect to appropriate cart page based on current path
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/customer')) {
      router.push('/customer/cart');
    } else if (currentPath.startsWith('/partners')) {
      router.push('/partners/cart');
    } else {
      router.push('/shop/cart');
    }
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => {
      const productPricing = getProductPricing(item.productId);
      return total + (productPricing ? productPricing.sale_price * item.quantity : 0);
    }, 0);
  };

  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();
  const gbCurrency = pricing.find(p => p.country_code === 'GB');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Select Products for This Image</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left side - Image */}
          <div className="space-y-4 min-h-0">
            <div className="aspect-square overflow-hidden rounded-lg bg-gray-100 flex-shrink-0">
              <CatalogImage
                imageId={image.id}
                alt={image.description || 'Generated image'}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Image Details */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {(image.breed_name || image.breed?.name) && (
                  <Badge variant="outline" className="text-xs">
                    🐕 {image.breed_name || image.breed?.name}
                  </Badge>
                )}
                {(image.theme_name || image.theme?.name) && (
                  <Badge variant="outline" className="text-xs">
                    🎨 {image.theme_name || image.theme?.name}
                  </Badge>
                )}
                {(image.style_name || image.style?.name) && (
                  <Badge variant="outline" className="text-xs">
                    ✨ {image.style_name || image.style?.name}
                  </Badge>
                )}
              </div>
              
              {image.description && (
                <p className="text-sm text-gray-600">{image.description}</p>
              )}
            </div>
          </div>

          {/* Right side - Products */}
          <div className="space-y-4 min-h-0">
            <h3 className="text-lg font-semibold">Available Products</h3>
            
            <div className="space-y-3">
              {availableProducts.map((product) => {
                const productPricing = getProductPricing(product.id);
                const quantity = getQuantity(product.id);
                
                if (!productPricing) return null;

                return (
                  <Card key={product.id} className="p-4">
                    <div className="space-y-3">
                      {/* Product Info */}
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{product.name}</h4>
                          <div className="flex items-center space-x-2 text-xs text-gray-600 mt-1">
                            <span>{product.medium?.name}</span>
                            <span>•</span>
                            <span>{product.format?.name}</span>
                            <span>•</span>
                            <span>{formatProductDimensions(product)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {formatPrice(productPricing.sale_price, productPricing.currency_code, productPricing.currency_symbol)}
                          </div>
                          {productPricing.is_on_sale && productPricing.discount_price && (
                            <div className="text-sm text-red-600">
                              Sale: {formatPrice(productPricing.discount_price, productPricing.currency_code, productPricing.currency_symbol)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(product.id, quantity - 1)}
                            disabled={quantity === 0}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(product.id, quantity + 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        {quantity > 0 && (
                          <div className="text-sm font-medium">
                            Subtotal: {formatPrice(
                              productPricing.sale_price * quantity, 
                              productPricing.currency_code, 
                              productPricing.currency_symbol
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Cart Summary */}
            {totalItems > 0 && (
              <Card className="p-4 bg-purple-50 border-purple-200">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Cart Summary</span>
                    <Badge variant="secondary">{totalItems} item{totalItems > 1 ? 's' : ''}</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center text-lg font-semibold">
                    <span>Total:</span>
                    <span>
                      {gbCurrency && formatPrice(totalPrice, gbCurrency.currency_code, gbCurrency.currency_symbol)}
                    </span>
                  </div>
                  
                  <Button 
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    onClick={handleAddAllToBasket}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Add {totalItems} Item{totalItems > 1 ? 's' : ''} to Basket
                  </Button>
                </div>
              </Card>
            )}

            {availableProducts.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No products available for this image yet.</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}