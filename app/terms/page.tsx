'use client'

import Image from 'next/image';
import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#f9fafb] py-10">
      <style jsx global>{`
        .terms-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.8;
          color: #333;
          max-width: 800px;
          margin: 40px auto;
          background: white;
          border-radius: 12px;
          padding: 50px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        @media only screen and (max-width: 600px) {
          .terms-container {
            margin: 0;
            border-radius: 0;
            padding: 30px 20px;
          }
        }
      `}</style>

      <div className="terms-container">
        {/* Header */}
        <div className="text-center mb-10 pb-8 border-b-2 border-gray-200">
          <Image
            src="/assets/logos/paw-svgrepo-200x200-purple.svg"
            alt="Pawtraits"
            width={60}
            height={60}
            className="mx-auto mb-5"
          />
          <h1 className="text-purple-600 text-4xl font-bold mb-3">Terms of Service</h1>
          <p className="text-gray-500 text-sm italic">Last updated: October 27, 2025</p>
        </div>

        {/* Section 1 */}
        <div className="my-10">
          <h2 className="text-gray-900 text-2xl font-semibold mb-4 pb-3 border-b-2 border-purple-100">
            <span className="inline-block w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-full text-center leading-8 font-bold mr-3">1</span>
            Acceptance of Terms
          </h2>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            By accessing and using Pawtraits, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, please do not use our services.
          </p>
        </div>

        {/* Section 2 */}
        <div className="my-10">
          <h2 className="text-gray-900 text-2xl font-semibold mb-4 pb-3 border-b-2 border-purple-100">
            <span className="inline-block w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-full text-center leading-8 font-bold mr-3">2</span>
            Service Description
          </h2>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            Pawtraits provides AI-powered pet portrait generation services. We use advanced artificial intelligence technology to create artistic representations of your pets based on photos you provide. Our master AI artist, Pawcasso, transforms your beloved pets into stunning custom portraits.
          </p>
        </div>

        {/* Section 3 */}
        <div className="my-10">
          <h2 className="text-gray-900 text-2xl font-semibold mb-4 pb-3 border-b-2 border-purple-100">
            <span className="inline-block w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-full text-center leading-8 font-bold mr-3">3</span>
            User Responsibilities
          </h2>
          <p className="text-gray-600 text-base my-4 leading-relaxed">As a user of Pawtraits, you agree to:</p>
          <ul className="my-4 pl-0 list-none">
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Provide accurate and current account information
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Upload only photos you own or have explicit permission to use
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Respect intellectual property rights of others
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Use the service in compliance with all applicable local, state, national, and international laws
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Maintain the security and confidentiality of your account credentials
            </li>
          </ul>
        </div>

        {/* Section 4 */}
        <div className="my-10">
          <h2 className="text-gray-900 text-2xl font-semibold mb-4 pb-3 border-b-2 border-purple-100">
            <span className="inline-block w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-full text-center leading-8 font-bold mr-3">4</span>
            Payment Terms
          </h2>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            Payment is required for premium services, including customization credits and physical print orders. All fees are charged in the currency displayed at checkout and are non-refundable unless otherwise stated in our refund policy.
          </p>
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 border-l-4 border-purple-600 p-5 my-6 rounded">
            <p className="text-purple-900 my-1">
              <strong>Important:</strong> We reserve the right to change our pricing structure with reasonable advance notice. Any price changes will not affect orders already placed.
            </p>
          </div>
        </div>

        {/* Section 5 */}
        <div className="my-10">
          <h2 className="text-gray-900 text-2xl font-semibold mb-4 pb-3 border-b-2 border-purple-100">
            <span className="inline-block w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-full text-center leading-8 font-bold mr-3">5</span>
            Intellectual Property
          </h2>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            Generated portraits are provided for your personal, non-commercial use. You may print, display, and share your portraits, but may not resell or commercially exploit them without explicit written permission.
          </p>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            Pawtraits retains the right to use anonymized data patterns derived from portrait generations to improve our AI models and service quality. We do not share or sell your personal photos or identifying information.
          </p>
        </div>

        {/* Section 6 */}
        <div className="my-10">
          <h2 className="text-gray-900 text-2xl font-semibold mb-4 pb-3 border-b-2 border-purple-100">
            <span className="inline-block w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-full text-center leading-8 font-bold mr-3">6</span>
            Limitation of Liability
          </h2>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            Pawtraits provides its services &quot;as is&quot; and &quot;as available.&quot; To the maximum extent permitted by law, Pawtraits shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to:
          </p>
          <ul className="my-4 pl-0 list-none">
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Loss of profits or revenue
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Loss of data or content
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Loss of business opportunity
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Service interruptions or delays
            </li>
          </ul>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            Our total liability for any claims arising from your use of the service shall not exceed the amount you paid to Pawtraits in the twelve (12) months preceding the claim.
          </p>
        </div>

        {/* Section 7 */}
        <div className="my-10">
          <h2 className="text-gray-900 text-2xl font-semibold mb-4 pb-3 border-b-2 border-purple-100">
            <span className="inline-block w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-full text-center leading-8 font-bold mr-3">7</span>
            Modifications to Terms
          </h2>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            We reserve the right to modify these Terms of Service at any time. We will notify users of any material changes via email or through prominent notice on our website. Your continued use of Pawtraits after such modifications constitutes acceptance of the updated terms.
          </p>
        </div>

        {/* Contact Section */}
        <div className="bg-gray-50 p-8 rounded-lg mt-12 text-center">
          <h3 className="text-gray-900 text-xl font-semibold mb-4">📧 Questions About These Terms?</h3>
          <p className="text-gray-600 my-3">
            If you have any questions or concerns about our Terms of Service, we&apos;re here to help.
          </p>
          <p className="text-gray-600 my-3">
            Contact us at{' '}
            <a href="mailto:terms@pawtraits.pics" className="text-purple-600 no-underline font-semibold hover:underline">
              terms@pawtraits.pics
            </a>
          </p>
          <p className="mt-5 text-sm text-gray-500">
            We typically respond within 24-48 hours.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center mt-10 pt-8 border-t border-gray-200 text-gray-500 text-sm">
          <p><strong>Pawtraits</strong> - Where Pets Become Art</p>
          <p>© 2025 Pawtraits. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
