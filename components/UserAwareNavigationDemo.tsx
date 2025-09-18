'use client'

import React from 'react'
import UserAwareNavigation from './UserAwareNavigation'

export default function UserAwareNavigationDemo() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Navigation */}
      <UserAwareNavigation variant="header" />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            User-Aware Navigation Component
          </h1>

          <div className="prose max-w-none">
            <p className="text-gray-600 mb-4">
              This navigation component automatically adapts based on the authenticated user's type:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              {/* Customer */}
              <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                <h3 className="text-lg font-semibold text-purple-900 mb-2">
                  👤 Customer Navigation
                </h3>
                <ul className="text-sm text-purple-800 space-y-1">
                  <li>• Purple theme with logo</li>
                  <li>• Home, Shop, Cart, Favorites</li>
                  <li>• My Orders, Account</li>
                  <li>• Cart badge shows item count</li>
                </ul>
              </div>

              {/* Partner */}
              <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                <h3 className="text-lg font-semibold text-green-900 mb-2">
                  🤝 Partner Navigation
                </h3>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• Green theme with logo</li>
                  <li>• Dashboard, Shop, Cart</li>
                  <li>• QR Codes, Commissions</li>
                  <li>• My Orders, Account</li>
                  <li>• Partner badge indicator</li>
                </ul>
              </div>

              {/* Admin */}
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  ⚡ Admin Navigation
                </h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Blue theme with logo</li>
                  <li>• Dashboard, Shop</li>
                  <li>• Orders, Partners</li>
                  <li>• Products management</li>
                  <li>• Admin badge indicator</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Key Features:</h3>
              <ul className="text-gray-700 space-y-1">
                <li>✅ <strong>User-Type Awareness</strong> - Automatically detects customer/partner/admin</li>
                <li>✅ <strong>Dynamic Theming</strong> - Purple for customers, green for partners, blue for admins</li>
                <li>✅ <strong>Responsive Design</strong> - Works on desktop and mobile with collapsible menu</li>
                <li>✅ <strong>Animated Logo</strong> - Rotates clockwise when menu opens, anti-clockwise when closed</li>
                <li>✅ <strong>Cart Integration</strong> - Shows cart item count badge</li>
                <li>✅ <strong>Role Indicators</strong> - Partner/Admin badges for easy identification</li>
                <li>✅ <strong>Active State</strong> - Highlights current page/section</li>
                <li>✅ <strong>Two Variants</strong> - Header navigation and sidebar navigation</li>
                <li>✅ <strong>Sign Out</strong> - Integrated authentication handling</li>
              </ul>
            </div>

            <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-green-50 border border-purple-200 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">🎯 Animation Details:</h3>
              <p className="text-gray-700 text-sm">
                The paw logo features a delightful rotation animation: <strong>clockwise rotation (360°)</strong> when the mobile menu opens,
                and <strong>counter-clockwise</strong> when closing. The animation duration is <code>500ms</code> with an
                <code>ease-in-out</code> timing function for a smooth, professional feel.
                In the sidebar variant, the logo rotates <strong>180° on hover</strong> for interactive feedback.
              </p>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold text-yellow-900 mb-2">Usage:</h3>
              <pre className="text-sm bg-white p-3 rounded border overflow-x-auto">
{`// Header Navigation
<UserAwareNavigation variant="header" />

// Sidebar Navigation
<UserAwareNavigation variant="sidebar" className="w-64" />`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Example */}
      <div className="fixed bottom-4 right-4">
        <div className="bg-white rounded-lg shadow-lg border p-4 max-w-sm">
          <h4 className="font-semibold text-gray-900 mb-2">Sidebar Preview:</h4>
          <div className="w-64 h-64 border rounded overflow-hidden">
            <UserAwareNavigation variant="sidebar" className="h-full" />
          </div>
        </div>
      </div>
    </div>
  )
}