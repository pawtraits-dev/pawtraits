"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, DollarSign, Share2, Users, ArrowRight } from "lucide-react"

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <Card className="shadow-xl text-center">
          <CardHeader>
            <div className="w-20 h-20 bg-gradient-to-r from-indigo-600 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-3xl text-gray-900 mb-2">Welcome to the Pawtraits Partner Network!</CardTitle>
            <CardDescription className="text-lg text-gray-600">
              Your account has been successfully created and verified. You're now ready to start earning commissions!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Next Steps */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Get Your Link</h3>
                <p className="text-sm text-gray-600">Access your unique referral link in the dashboard</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Share2 className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Share with Clients</h3>
                <p className="text-sm text-gray-600">Start referring clients to AI pet portraits</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <DollarSign className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Earn Commissions</h3>
                <p className="text-sm text-gray-600">Receive 20% + 5% lifetime commissions</p>
              </div>
            </div>

            {/* Commission Reminder */}
            <div className="bg-gradient-to-r from-indigo-50 to-emerald-50 rounded-lg p-6 border border-indigo-200">
              <h3 className="font-semibold text-gray-900 mb-3">Your Commission Structure:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mr-2" />
                  <span>
                    <strong>20%</strong> commission on first sale
                  </span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mr-2" />
                  <span>
                    <strong>5%</strong> lifetime recurring commission
                  </span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mr-2" />
                  <span>Monthly payouts via PayPal</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mr-2" />
                  <span>Real-time tracking dashboard</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                className="bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700"
                onClick={() => (window.location.href = "/dashboard")}
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = "/resources")}>
                View Marketing Materials
              </Button>
            </div>

            {/* Support Info */}
            <div className="text-center text-sm text-gray-600">
              <p>Need help getting started? Contact our partner support team at</p>
              <a href="mailto:partners@pawtraits.ai" className="text-indigo-600 hover:text-indigo-700 font-medium">
                partners@pawtraits.ai
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
