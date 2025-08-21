import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl text-center">Privacy Policy</CardTitle>
            <p className="text-center text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <h2>Information We Collect</h2>
            <p>
              At Pawtraits, we collect information you provide directly to us, such as when you create an account, 
              upload pet photos, make purchases, or contact us for support.
            </p>

            <h2>How We Use Your Information</h2>
            <ul>
              <li>To provide and maintain our AI pet portrait service</li>
              <li>To process your payments and fulfill orders</li>
              <li>To communicate with you about your account and orders</li>
              <li>To improve our services and develop new features</li>
            </ul>

            <h2>Information Sharing</h2>
            <p>
              We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, 
              except as described in this privacy policy.
            </p>

            <h2>Data Security</h2>
            <p>
              We implement appropriate security measures to protect your personal information against unauthorized access, 
              alteration, disclosure, or destruction.
            </p>

            <h2>Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at privacy@pawtraits.com.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}