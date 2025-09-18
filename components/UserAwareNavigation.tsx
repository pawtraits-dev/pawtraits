'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { useUserRouting } from '@/hooks/use-user-routing'
import { Button } from '@/components/ui/button'
import {
  Home,
  ShoppingBag,
  ShoppingCart,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  BarChart3,
  Users,
  QrCode,
  DollarSign,
  Package,
  Heart
} from 'lucide-react'
import { SupabaseService } from '@/lib/supabase'
import { useHybridCart } from '@/lib/hybrid-cart-context'

interface NavigationItem {
  name: string
  href: string
  icon: React.ElementType
  badge?: string
}

interface UserAwareNavigationProps {
  className?: string
  variant?: 'header' | 'sidebar'
}

export default function UserAwareNavigation({
  className = '',
  variant = 'header'
}: UserAwareNavigationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { userProfile, loading: userLoading } = useUserRouting()
  const { totalItems } = useHybridCart()
  const router = useRouter()
  const pathname = usePathname()
  const supabaseService = new SupabaseService()

  // Determine user type and theming
  const userType = userProfile?.user_type || 'customer'
  const isPartner = userType === 'partner'
  const isAdmin = userType === 'admin'

  // Theme colors based on user type
  const theme = {
    primary: isPartner ? 'text-green-600' : isAdmin ? 'text-blue-600' : 'text-purple-600',
    primaryHover: isPartner ? 'hover:text-green-700' : isAdmin ? 'hover:text-blue-700' : 'hover:text-purple-700',
    primaryBg: isPartner ? 'bg-green-600' : isAdmin ? 'bg-blue-600' : 'bg-purple-600',
    primaryBgHover: isPartner ? 'hover:bg-green-700' : isAdmin ? 'hover:bg-blue-700' : 'hover:bg-purple-700',
    accent: isPartner ? 'bg-green-50 border-green-200' : isAdmin ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200',
    logo: isPartner ? '/assets/logos/paw-svgrepo-200x200-green.svg' :
          isAdmin ? '/assets/logos/paw-svgrepo-200x200-blue.svg' :
          '/assets/logos/paw-svgrepo-200x200-purple.svg'
  }

  // Navigation items based on user type
  const getNavigationItems = (): NavigationItem[] => {
    if (isAdmin) {
      return [
        { name: 'Dashboard', href: '/admin', icon: BarChart3 },
        { name: 'Shop', href: '/browse', icon: ShoppingBag },
        { name: 'Orders', href: '/admin/orders', icon: Package },
        { name: 'Partners', href: '/admin/partners', icon: Users },
        { name: 'Products', href: '/admin/products', icon: Settings }
      ]
    }

    if (isPartner) {
      return [
        { name: 'Dashboard', href: '/partners', icon: Home },
        { name: 'Shop', href: '/browse', icon: ShoppingBag },
        { name: 'Cart', href: '/shop/cart', icon: ShoppingCart, badge: totalItems > 0 ? totalItems.toString() : undefined },
        { name: 'My Orders', href: '/partners/orders', icon: Package },
        { name: 'QR Codes', href: '/partners/qr-codes', icon: QrCode },
        { name: 'Commissions', href: '/partners/commissions', icon: DollarSign },
        { name: 'Account', href: '/partners/account', icon: User }
      ]
    }

    // Customer navigation
    return [
      { name: 'Home', href: '/', icon: Home },
      { name: 'Shop', href: '/browse', icon: ShoppingBag },
      { name: 'Cart', href: '/shop/cart', icon: ShoppingCart, badge: totalItems > 0 ? totalItems.toString() : undefined },
      { name: 'Favorites', href: '/customer/favorites', icon: Heart },
      { name: 'My Orders', href: '/customer/orders', icon: Package },
      { name: 'Account', href: '/customer/account', icon: User }
    ]
  }

  const navigationItems = getNavigationItems()

  const handleSignOut = async () => {
    try {
      await supabaseService.signOut()
      router.push('/auth/login')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const isActivePath = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  if (userLoading) {
    return (
      <nav className={`bg-white shadow-sm border-b ${className}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="animate-pulse bg-gray-300 w-10 h-10 rounded"></div>
              <div className="animate-pulse bg-gray-300 w-32 h-6 ml-3 rounded"></div>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  if (variant === 'sidebar') {
    return (
      <nav className={`bg-white shadow-lg border-r h-full ${className}`}>
        <div className="p-4">
          {/* Logo */}
          <Link href={isAdmin ? '/admin' : isPartner ? '/partners' : '/'} className="flex items-center mb-8">
            <Image
              src={theme.logo}
              alt="Pawtraits Logo"
              width={40}
              height={40}
              className="w-10 h-10 transition-transform duration-700 ease-in-out hover:rotate-180"
            />
            <span className={`ml-3 text-xl font-bold ${theme.primary} font-[family-name:var(--font-life-savers)]`}>
              Pawtraits
            </span>
            {isPartner && (
              <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                Partner
              </span>
            )}
            {isAdmin && (
              <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                Admin
              </span>
            )}
          </Link>

          {/* Navigation Items */}
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = isActivePath(item.href)

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                    isActive
                      ? `${theme.accent} ${theme.primary}`
                      : `text-gray-700 hover:bg-gray-50 ${theme.primaryHover}`
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                  {item.badge && (
                    <span className={`ml-auto px-2 py-1 text-xs rounded-full ${theme.primaryBg} text-white`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>

          {/* User Info & Sign Out */}
          {userProfile && (
            <div className="mt-8 pt-6 border-t">
              <div className="flex items-center px-3 py-2 text-sm">
                <User className="w-5 h-5 mr-3 text-gray-400" />
                <div>
                  <div className="font-medium text-gray-900">
                    {userProfile.first_name} {userProfile.last_name}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {userProfile.email}
                  </div>
                </div>
              </div>
              <Button
                onClick={handleSignOut}
                variant="ghost"
                className="w-full justify-start px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Sign Out
              </Button>
            </div>
          )}
        </div>
      </nav>
    )
  }

  // Header variant
  return (
    <nav className={`bg-white shadow-sm border-b ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link href={isAdmin ? '/admin' : isPartner ? '/partners' : '/'} className="flex items-center">
              <Image
                src={theme.logo}
                alt="Pawtraits Logo"
                width={40}
                height={40}
                className="w-10 h-10 transition-transform duration-500 ease-in-out"
                style={{
                  transform: isOpen ? 'rotate(360deg)' : 'rotate(0deg)'
                }}
              />
              <span className={`ml-3 text-xl font-bold ${theme.primary} font-[family-name:var(--font-life-savers)]`}>
                Pawtraits
              </span>
              {isPartner && (
                <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                  Partner
                </span>
              )}
              {isAdmin && (
                <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                  Admin
                </span>
              )}
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navigationItems.map((item) => {
              const Icon = item.icon
              const isActive = isActivePath(item.href)

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                    isActive
                      ? theme.primary
                      : `text-gray-700 ${theme.primaryHover}`
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.name}
                  {item.badge && (
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${theme.primaryBg} text-white`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}

            {/* User Menu */}
            {userProfile && (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  {userProfile.first_name}
                </span>
                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  size="sm"
                  className={`${theme.primary} border-current hover:bg-current hover:text-white`}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Button
              onClick={() => setIsOpen(!isOpen)}
              variant="ghost"
              size="sm"
              className="text-gray-500"
            >
              {isOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon
                const isActive = isActivePath(item.href)

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center px-3 py-2 rounded-lg text-base font-medium transition-colors ${
                      isActive
                        ? `${theme.accent} ${theme.primary}`
                        : `text-gray-700 hover:bg-gray-50 ${theme.primaryHover}`
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                    {item.badge && (
                      <span className={`ml-auto px-2 py-1 text-xs rounded-full ${theme.primaryBg} text-white`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )
              })}

              {/* Mobile User Menu */}
              {userProfile && (
                <div className="pt-4 border-t">
                  <div className="flex items-center px-3 py-2">
                    <User className="w-5 h-5 mr-3 text-gray-400" />
                    <div>
                      <div className="text-base font-medium text-gray-900">
                        {userProfile.first_name} {userProfile.last_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {userProfile.email}
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={handleSignOut}
                    variant="ghost"
                    className="w-full justify-start px-3 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    <LogOut className="w-5 h-5 mr-3" />
                    Sign Out
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}