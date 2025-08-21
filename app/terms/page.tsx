import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl text-center">Terms of Service</CardTitle>
            <p className="text-center text-gray-600">Last updated: {new Date().toLocaleDateString()}</p>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <h2>Acceptance of Terms</h2>
            <p>
              By accessing and using Pawtraits, you accept and agree to be bound by the terms and provision of this agreement.
            </p>

            <h2>Service Description</h2>
            <p>
              Pawtraits provides AI-powered pet portrait generation services. We use artificial intelligence to create 
              artistic representations of your pets based on photos you provide.
            </p>

            <h2>User Responsibilities</h2>
            <ul>
              <li>Provide accurate account information</li>
              <li>Upload only photos you own or have permission to use</li>
              <li>Respect intellectual property rights</li>
              <li>Use the service in compliance with applicable laws</li>
            </ul>

            <h2>Payment Terms</h2>
            <p>
              Payment is required for premium services. All fees are non-refundable unless otherwise stated. 
              We reserve the right to change our pricing with notice.
            </p>

            <h2>Intellectual Property</h2>
            <p>
              Generated portraits are provided for your personal use. Pawtraits retains rights to improve our AI models 
              using anonymized data patterns.
            </p>

            <h2>Limitation of Liability</h2>
            <p>
              Pawtraits shall not be liable for any indirect, incidental, special, consequential, or punitive damages 
              resulting from your use of the service.
            </p>

            <h2>Contact Information</h2>
            <p>
              Questions about these Terms should be sent to us at terms@pawtraits.com.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}