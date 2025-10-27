'use client'

import Image from 'next/image';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f9fafb] py-10">
      <style jsx global>{`
        .privacy-container {
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
          .privacy-container {
            margin: 0;
            border-radius: 0;
            padding: 30px 20px;
          }
        }
      `}</style>

      <div className="privacy-container">
        {/* Header */}
        <div className="text-center mb-10 pb-8 border-b-2 border-gray-200">
          <Image
            src="/assets/logos/paw-svgrepo-200x200-purple.svg"
            alt="Pawtraits"
            width={60}
            height={60}
            className="mx-auto mb-5"
          />
          <h1 className="text-purple-600 text-4xl font-bold mb-3">Privacy Policy</h1>
          <p className="text-gray-500 text-sm italic">Last updated: October 27, 2025</p>
        </div>

        {/* Intro Box */}
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 border-l-4 border-purple-600 p-5 my-6 rounded">
          <p className="text-purple-900 my-1">
            <strong>Your Privacy Matters</strong>
          </p>
          <p className="text-purple-900 my-1">
            At Pawtraits, we take your privacy seriously. This policy explains how we collect, use, protect, and share your personal information when you use our AI-powered pet portrait service.
          </p>
        </div>

        {/* Section 1 */}
        <div className="my-10">
          <h2 className="text-gray-900 text-2xl font-semibold mb-4 pb-3 border-b-2 border-purple-100">
            <span className="inline-block w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-full text-center leading-8 font-bold mr-3">1</span>
            Information We Collect
          </h2>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            We collect several types of information to provide and improve our services:
          </p>

          <div className="bg-gray-50 p-5 my-6 rounded border-l-4 border-purple-300">
            <p className="text-gray-900 font-semibold mb-2">Account Information:</p>
            <ul className="my-2 pl-0 list-none">
              <li className="relative pl-8 my-2 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
                Name, email address, and password
              </li>
              <li className="relative pl-8 my-2 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
                Profile information and preferences
              </li>
              <li className="relative pl-8 my-2 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
                Payment information (processed securely through Stripe)
              </li>
            </ul>
          </div>

          <div className="bg-gray-50 p-5 my-6 rounded border-l-4 border-purple-300">
            <p className="text-gray-900 font-semibold mb-2">Pet Photos and Content:</p>
            <ul className="my-2 pl-0 list-none">
              <li className="relative pl-8 my-2 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
                Photos you upload of your pets
              </li>
              <li className="relative pl-8 my-2 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
                Pet information (breed, name, coat color, etc.)
              </li>
              <li className="relative pl-8 my-2 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
                AI-generated portraits and customization preferences
              </li>
            </ul>
          </div>

          <div className="bg-gray-50 p-5 my-6 rounded border-l-4 border-purple-300">
            <p className="text-gray-900 font-semibold mb-2">Usage Information:</p>
            <ul className="my-2 pl-0 list-none">
              <li className="relative pl-8 my-2 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
                How you interact with our service (pages visited, features used)
              </li>
              <li className="relative pl-8 my-2 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
                Device information (browser type, IP address, operating system)
              </li>
              <li className="relative pl-8 my-2 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
                Cookies and similar tracking technologies
              </li>
            </ul>
          </div>
        </div>

        {/* Section 2 */}
        <div className="my-10">
          <h2 className="text-gray-900 text-2xl font-semibold mb-4 pb-3 border-b-2 border-purple-100">
            <span className="inline-block w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-full text-center leading-8 font-bold mr-3">2</span>
            How We Use Your Information
          </h2>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            We use the information we collect to:
          </p>
          <ul className="my-4 pl-0 list-none">
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Provide Our Services:</strong> Generate AI portraits, process orders, and deliver physical prints
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Process Payments:</strong> Handle transactions securely through our payment processor
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Communicate:</strong> Send order confirmations, updates, and customer support responses
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Improve Our AI:</strong> Train and enhance our AI models to generate better portraits
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Marketing:</strong> Send promotional emails (you can opt out anytime)
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Analytics:</strong> Understand how our service is used and identify areas for improvement
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Partner Program:</strong> Track referrals and calculate partner commissions
            </li>
          </ul>
        </div>

        {/* Section 3 */}
        <div className="my-10">
          <h2 className="text-gray-900 text-2xl font-semibold mb-4 pb-3 border-b-2 border-purple-100">
            <span className="inline-block w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-full text-center leading-8 font-bold mr-3">3</span>
            Information Sharing &amp; Disclosure
          </h2>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            We do not sell your personal information. We may share your information only in these limited circumstances:
          </p>
          <ul className="my-4 pl-0 list-none">
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Service Providers:</strong> Third-party companies that help us operate our business (payment processing, cloud storage, print fulfillment)
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Legal Requirements:</strong> When required by law or to protect our rights and safety
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>With Your Consent:</strong> When you explicitly agree to share your information
            </li>
          </ul>
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 border-l-4 border-purple-600 p-5 my-6 rounded">
            <p className="text-purple-900 my-1">
              <strong>Important:</strong> We use anonymized and aggregated data patterns from portrait generations to improve our AI models. We never share your personal photos or identifying information with third parties for their marketing purposes.
            </p>
          </div>
        </div>

        {/* Section 4 */}
        <div className="my-10">
          <h2 className="text-gray-900 text-2xl font-semibold mb-4 pb-3 border-b-2 border-purple-100">
            <span className="inline-block w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-full text-center leading-8 font-bold mr-3">4</span>
            Data Security
          </h2>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            We implement industry-standard security measures to protect your information:
          </p>
          <ul className="my-4 pl-0 list-none">
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Encrypted data transmission using SSL/TLS
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Secure cloud storage with enterprise-grade providers (Supabase, Cloudinary)
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Payment information handled by PCI-compliant processor (Stripe)
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Regular security audits and updates
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Access controls and authentication requirements
            </li>
          </ul>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            However, no method of transmission over the Internet is 100% secure. While we strive to protect your personal information, we cannot guarantee absolute security.
          </p>
        </div>

        {/* Section 5 */}
        <div className="my-10">
          <h2 className="text-gray-900 text-2xl font-semibold mb-4 pb-3 border-b-2 border-purple-100">
            <span className="inline-block w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-full text-center leading-8 font-bold mr-3">5</span>
            Your Privacy Rights
          </h2>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            Depending on your location, you may have certain rights regarding your personal information:
          </p>
          <ul className="my-4 pl-0 list-none">
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Access:</strong> Request a copy of the personal information we hold about you
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Correction:</strong> Request corrections to inaccurate or incomplete information
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Deletion:</strong> Request deletion of your personal information (subject to legal obligations)
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Portability:</strong> Request transfer of your data to another service
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Opt-Out:</strong> Unsubscribe from marketing emails at any time
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Object:</strong> Object to certain types of data processing
            </li>
          </ul>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            To exercise any of these rights, please contact us at{' '}
            <a href="mailto:privacy@pawtraits.pics" className="text-purple-600 no-underline font-semibold hover:underline">
              privacy@pawtraits.pics
            </a>
            . We will respond to your request within 30 days.
          </p>
        </div>

        {/* Section 6 */}
        <div className="my-10">
          <h2 className="text-gray-900 text-2xl font-semibold mb-4 pb-3 border-b-2 border-purple-100">
            <span className="inline-block w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-full text-center leading-8 font-bold mr-3">6</span>
            Cookies &amp; Tracking Technologies
          </h2>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            We use cookies and similar technologies to enhance your experience:
          </p>
          <ul className="my-4 pl-0 list-none">
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Essential Cookies:</strong> Required for authentication and basic site functionality
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Analytics Cookies:</strong> Help us understand how users interact with our service
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Preference Cookies:</strong> Remember your settings and customization choices
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              <strong>Marketing Cookies:</strong> Track referrals and measure campaign effectiveness
            </li>
          </ul>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            You can control cookies through your browser settings. However, disabling certain cookies may limit your ability to use some features of our service.
          </p>
        </div>

        {/* Section 7 */}
        <div className="my-10">
          <h2 className="text-gray-900 text-2xl font-semibold mb-4 pb-3 border-b-2 border-purple-100">
            <span className="inline-block w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-full text-center leading-8 font-bold mr-3">7</span>
            Children&apos;s Privacy
          </h2>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we discover that we have collected information from a child under 13, we will promptly delete that information.
          </p>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            If you believe we have inadvertently collected information from a child under 13, please contact us immediately at{' '}
            <a href="mailto:privacy@pawtraits.pics" className="text-purple-600 no-underline font-semibold hover:underline">
              privacy@pawtraits.pics
            </a>
            .
          </p>
        </div>

        {/* Section 8 */}
        <div className="my-10">
          <h2 className="text-gray-900 text-2xl font-semibold mb-4 pb-3 border-b-2 border-purple-100">
            <span className="inline-block w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-full text-center leading-8 font-bold mr-3">8</span>
            Changes to This Policy
          </h2>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of any material changes by:
          </p>
          <ul className="my-4 pl-0 list-none">
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Posting a prominent notice on our website
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Sending you an email notification
            </li>
            <li className="relative pl-8 my-3 text-gray-600 text-base leading-relaxed before:content-['•'] before:absolute before:left-2 before:text-purple-600 before:font-bold before:text-xl">
              Updating the &quot;Last updated&quot; date at the top of this policy
            </li>
          </ul>
          <p className="text-gray-600 text-base my-4 leading-relaxed">
            Your continued use of Pawtraits after such modifications constitutes your acceptance of the updated Privacy Policy.
          </p>
        </div>

        {/* Contact Section */}
        <div className="bg-gray-50 p-8 rounded-lg mt-12 text-center">
          <h3 className="text-gray-900 text-xl font-semibold mb-4">🔒 Privacy Questions or Concerns?</h3>
          <p className="text-gray-600 my-3">
            We&apos;re committed to protecting your privacy. If you have any questions, concerns, or requests regarding this Privacy Policy or how we handle your data, please don&apos;t hesitate to reach out.
          </p>
          <p className="text-gray-600 my-3">
            Contact us at{' '}
            <a href="mailto:privacy@pawtraits.pics" className="text-purple-600 no-underline font-semibold hover:underline">
              privacy@pawtraits.pics
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
