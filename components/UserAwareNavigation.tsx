'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { useUserRouting } from '@/hooks/use-user-routing'
import { useCountryPricing } from '@/lib/country-context'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  Heart,
  Dog,
  Cat,
  Palette,
  Images,
  PawPrint,
  Share2
} from 'lucide-react'
import { SupabaseService } from '@/lib/supabase'
import { useHybridCart } from '@/lib/hybrid-cart-context'
import CountrySelector from '@/components/CountrySelector'

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
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { userProfile, loading: userLoading } = useUserRouting()
  const { totalItems } = useHybridCart()
  const { selectedCountry, selectedCountryData, availableCountries, setSelectedCountry } = useCountryPricing()
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

  // Expandable menu items (from brand/logo click) - exclude admin
  const getExpandableMenuItems = (): NavigationItem[] => {
    const baseItems: NavigationItem[] = [
      { name: 'Browse', href: '/browse', icon: ShoppingBag }
    ]

    // Add user-specific items only if user is logged in
    if (userProfile) {
      baseItems.push(
        { name: 'Gallery', href: '/gallery', icon: Images },
        { name: 'Pets', href: '/pets', icon: PawPrint }
      )
    }

    if (isPartner) {
      return [
        ...baseItems,
        { name: 'Orders', href: '/orders', icon: Package },
        { name: 'Commissions', href: '/commissions', icon: DollarSign },
        { name: 'Referrals', href: '/referrals', icon: Share2 },
        { name: 'Account', href: '/account', icon: User }
      ]
    }

    // Customer expandable menu - only add user-specific items if logged in
    if (userProfile) {
      return [
        ...baseItems,
        { name: 'Orders', href: '/orders', icon: Package },
        { name: 'Referrals', href: '/referrals', icon: Share2 },
        { name: 'Account', href: '/account', icon: User }
      ]
    }

    // Guest menu - only public items
    return baseItems
  }

  // Top permanent menu items
  const getTopMenuItems = () => [
    { name: 'Dogs', href: '/browse?type=dogs', icon: Dog },
    { name: 'Cats', href: '/browse?type=cats', icon: Cat },
    { name: 'Themes', href: '/browse?type=themes', icon: Palette }
  ]

  const expandableMenuItems = getExpandableMenuItems()
  const topMenuItems = getTopMenuItems()

  const handleSignOut = async () => {
    try {
      await supabaseService.signOut()
      router.push('/')
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

  // Header variant with new expandable menu structure
  return (
    <nav className={`bg-white shadow-sm border-b ${className}`}>
      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Expandable Logo/Brand (left side) */}
          <div className="flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
            >
              <Image
                src={theme.logo}
                alt="Pawtraits Logo"
                width={40}
                height={40}
                className="w-10 h-10 transition-transform duration-500 ease-in-out"
                style={{
                  transform: isMenuOpen ? 'rotate(360deg)' : 'rotate(0deg)'
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
            </button>
          </div>

          {/* Permanent Top Menu (desktop) */}
          <div className="hidden md:flex items-center space-x-6">
            {/* Dogs, Cats, Themes */}
            {topMenuItems.map((item) => {
              const Icon = item.icon
              const isActive = isActivePath(item.href.split('?')[0])

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? theme.primary
                      : `text-gray-700 ${theme.primaryHover}`
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {item.name}
                </Link>
              )
            })}

            {/* Country Selector */}
            <div className="border-l border-gray-200 pl-6">
              <CountrySelector compact={true} showLabel={false} />
            </div>

            {/* Cart */}
            <Link
              href="/shop/cart"
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                isActivePath('/shop/cart')
                  ? theme.primary
                  : `text-gray-700 ${theme.primaryHover}`
              }`}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Cart
              {totalItems > 0 && (
                <span className={`ml-2 px-2 py-1 text-xs rounded-full ${theme.primaryBg} text-white`}>
                  {totalItems}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-2">
            {/* Mobile cart */}
            <Link href="/shop/cart" className="relative p-2">
              <ShoppingCart className="w-6 h-6 text-gray-600" />
              {totalItems > 0 && (
                <span className={`absolute -top-1 -right-1 px-2 py-1 text-xs rounded-full ${theme.primaryBg} text-white`}>
                  {totalItems}
                </span>
              )}
            </Link>
            <Button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              variant="ghost"
              size="sm"
              className="text-gray-500"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Expandable Menu Dropdown */}
        {isMenuOpen && (
          <div className="absolute left-0 right-0 top-16 bg-white shadow-lg border-b z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {expandableMenuItems.map((item) => {
                  const Icon = item.icon
                  const isActive = isActivePath(item.href.split('?')[0])

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? `${theme.accent} ${theme.primary}`
                          : `text-gray-700 hover:bg-gray-50 ${theme.primaryHover}`
                      }`}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </Link>
                  )
                })}

                {/* Sign Out button in expandable menu */}
                {userProfile ? (
                  <button
                    onClick={() => {
                      handleSignOut()
                      setIsMenuOpen(false)
                    }}
                    className="flex items-center px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <LogOut className="w-5 h-5 mr-3" />
                    Sign Out
                  </button>
                ) : (
                  <Link
                    href="/auth/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User className="w-5 h-5 mr-3" />
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {/* Mobile top menu items */}
              {topMenuItems.map((item) => {
                const Icon = item.icon
                const isActive = isActivePath(item.href.split('?')[0])

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center px-3 py-2 rounded-lg text-base font-medium transition-colors ${
                      isActive
                        ? `${theme.accent} ${theme.primary}`
                        : `text-gray-700 hover:bg-gray-50 ${theme.primaryHover}`
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </Link>
                )
              })}

              {/* Mobile expandable menu items */}
              <div className="pt-2 border-t">
                {expandableMenuItems.map((item) => {
                  const Icon = item.icon
                  const isActive = isActivePath(item.href.split('?')[0])

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center px-3 py-2 rounded-lg text-base font-medium transition-colors ${
                        isActive
                          ? `${theme.accent} ${theme.primary}`
                          : `text-gray-700 hover:bg-gray-50 ${theme.primaryHover}`
                      }`}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </Link>
                  )
                })}
              </div>

              {/* Mobile Country Selector */}
              <div className="pt-2 border-t">
                <div className="px-3 py-2">
                  <CountrySelector compact={false} showLabel={true} />
                </div>
              </div>

              {/* Mobile User Menu */}
              <div className="pt-2 border-t">
                {userProfile ? (
                  <>
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
                      onClick={() => {
                        handleSignOut()
                        setIsMobileMenuOpen(false)
                      }}
                      variant="ghost"
                      className="w-full justify-start px-3 py-2 text-gray-700 hover:bg-gray-50"
                    >
                      <LogOut className="w-5 h-5 mr-3" />
                      Sign Out
                    </Button>
                  </>
                ) : (
                  <Link
                    href="/auth/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center px-3 py-2 rounded-lg text-base font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User className="w-5 h-5 mr-3" />
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}