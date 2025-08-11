import Link from 'next/link';

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            🐾 Pawtraits Demo Screens
          </h1>
          <p className="text-lg text-gray-600">
            Browse all the beautiful Vercel-designed screens
          </p>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Auth Screens */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              🔐 Authentication
            </h2>
            <div className="space-y-2">
              <Link href="/auth/login" className="block text-blue-600 hover:text-blue-800 text-sm">
                → Login Page
              </Link>
              <Link href="/auth/forgot-password" className="block text-blue-600 hover:text-blue-800 text-sm">
                → Forgot Password
              </Link>
              <Link href="/auth/reset-password" className="block text-blue-600 hover:text-blue-800 text-sm">
                → Reset Password
              </Link>
              <Link href="/auth/password-setup" className="block text-blue-600 hover:text-blue-800 text-sm">
                → Password Setup
              </Link>
              <Link href="/auth/verify-email" className="block text-blue-600 hover:text-blue-800 text-sm">
                → Verify Email
              </Link>
              <Link href="/auth/verify-phone" className="block text-blue-600 hover:text-blue-800 text-sm">
                → Verify Phone
              </Link>
              <Link href="/auth/welcome" className="block text-blue-600 hover:text-blue-800 text-sm">
                → Welcome Screen
              </Link>
            </div>
          </div>

          {/* Dashboard Screens */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              📊 Dashboard
            </h2>
            <div className="space-y-2">
              <Link href="/dashboard" className="block text-green-600 hover:text-green-800 text-sm">
                → Main Dashboard
              </Link>
              <Link href="/dashboard/catalog" className="block text-green-600 hover:text-green-800 text-sm">
                → Portrait Catalog
              </Link>
              <Link href="/dashboard/referrals" className="block text-green-600 hover:text-green-800 text-sm">
                → Referrals Management
              </Link>
              <Link href="/dashboard/referrals/create" className="block text-green-600 hover:text-green-800 text-sm">
                → Create Referral
              </Link>
              <Link href="/dashboard/account" className="block text-green-600 hover:text-green-800 text-sm">
                → Account Settings
              </Link>
            </div>
          </div>

          {/* Admin Screens */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              ⚙️ Admin Management
            </h2>
            <div className="space-y-2">
              <Link href="/admin" className="block text-purple-600 hover:text-purple-800 text-sm">
                → Admin Dashboard
              </Link>
              <Link href="/admin/breeds" className="block text-purple-600 hover:text-purple-800 text-sm">
                → Breeds Management
              </Link>
              <Link href="/admin/themes" className="block text-purple-600 hover:text-purple-800 text-sm">
                → Themes Management
              </Link>
              <Link href="/admin/styles" className="block text-purple-600 hover:text-purple-800 text-sm">
                → Styles Management
              </Link>
              <Link href="/admin/formats" className="block text-purple-600 hover:text-purple-800 text-sm">
                → Formats Management
              </Link>
            </div>
          </div>

          {/* Preview Screens */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              👀 Preview Mode
            </h2>
            <div className="space-y-2">
              <Link href="/preview" className="block text-orange-600 hover:text-orange-800 text-sm">
                → Preview Dashboard
              </Link>
              <Link href="/preview/catalog" className="block text-orange-600 hover:text-orange-800 text-sm">
                → Preview Catalog
              </Link>
              <Link href="/preview/referrals" className="block text-orange-600 hover:text-orange-800 text-sm">
                → Preview Referrals
              </Link>
              <Link href="/preview/account" className="block text-orange-600 hover:text-orange-800 text-sm">
                → Preview Account
              </Link>
            </div>
          </div>

          {/* Test Screens */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              🧪 Component Tests
            </h2>
            <div className="space-y-2">
              <Link href="/test" className="block text-indigo-600 hover:text-indigo-800 text-sm">
                → UI Components Test
              </Link>
            </div>
          </div>

          {/* Back to Original */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              🏠 Original
            </h2>
            <div className="space-y-2">
              <Link href="/" className="block text-gray-600 hover:text-gray-800 text-sm">
                → Home Page
              </Link>
              <Link href="/admin/definitions" className="block text-gray-600 hover:text-gray-800 text-sm">
                → Old Admin (Tabbed)
              </Link>
            </div>
          </div>
        </div>

        {/* Featured Showcase */}
        <div className="mt-12 bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
            ✨ Featured: Beautiful Dashboard with Real Data
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/dashboard/catalog" 
                  className="block bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all">
              <h3 className="text-xl font-semibold mb-2">🎨 Portrait Catalog</h3>
              <p className="text-blue-100">Browse pet portraits with search and filtering</p>
            </Link>
            <Link href="/admin/breeds" 
                  className="block bg-gradient-to-r from-green-500 to-teal-600 text-white p-6 rounded-lg hover:from-green-600 hover:to-teal-700 transition-all">
              <h3 className="text-xl font-semibold mb-2">🐕 Breeds Management</h3>
              <p className="text-green-100">Manage dog breeds</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}