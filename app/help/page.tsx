import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mail, MessageCircle, Phone, HelpCircle } from 'lucide-react'
import Link from 'next/link'

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Card className="shadow-xl mb-8">
          <CardHeader>
            <CardTitle className="text-3xl text-center">Help & Support</CardTitle>
            <p className="text-center text-gray-600">We're here to help you create amazing pet portraits!</p>
          </CardHeader>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* FAQ Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <HelpCircle className="w-5 h-5 mr-2" />
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold">How do I create a pet portrait?</h4>
                <p className="text-sm text-gray-600">Upload a clear photo of your pet, select a style, and our AI will generate a beautiful portrait.</p>
              </div>
              <div>
                <h4 className="font-semibold">What image formats are supported?</h4>
                <p className="text-sm text-gray-600">We accept JPG, PNG, and WEBP files up to 10MB in size.</p>
              </div>
              <div>
                <h4 className="font-semibold">How long does generation take?</h4>
                <p className="text-sm text-gray-600">Most portraits are ready within 2-5 minutes depending on complexity.</p>
              </div>
              <div>
                <h4 className="font-semibold">Can I print my portraits?</h4>
                <p className="text-sm text-gray-600">Yes! We offer high-resolution downloads and printing services.</p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Options */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full justify-start" variant="outline">
                <Mail className="w-4 h-4 mr-2" />
                support@pawtraits.com
              </Button>
              
              <Button className="w-full justify-start" variant="outline">
                <MessageCircle className="w-4 h-4 mr-2" />
                Live Chat (9 AM - 5 PM EST)
              </Button>
              
              <Button className="w-full justify-start" variant="outline">
                <Phone className="w-4 h-4 mr-2" />
                1-800-PAWTRAITS
              </Button>
              
              <div className="pt-4">
                <h4 className="font-semibold mb-2">Quick Links</h4>
                <div className="space-y-2 text-sm">
                  <Link href="/customer/shop" className="block text-blue-600 hover:underline">
                    Customer Dashboard
                  </Link>
                  <Link href="/partners" className="block text-blue-600 hover:underline">
                    Partner Portal
                  </Link>
                  <Link href="/privacy" className="block text-blue-600 hover:underline">
                    Privacy Policy
                  </Link>
                  <Link href="/terms" className="block text-blue-600 hover:underline">
                    Terms of Service
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Getting Started Guide */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Getting Started Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-blue-600 font-bold">1</span>
                </div>
                <h4 className="font-semibold mb-2">Upload Photo</h4>
                <p className="text-sm text-gray-600">Choose a clear, well-lit photo of your pet</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-purple-600 font-bold">2</span>
                </div>
                <h4 className="font-semibold mb-2">Select Style</h4>
                <p className="text-sm text-gray-600">Choose from various artistic styles and themes</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-green-600 font-bold">3</span>
                </div>
                <h4 className="font-semibold mb-2">Download & Share</h4>
                <p className="text-sm text-gray-600">Get your portrait and share with friends</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}