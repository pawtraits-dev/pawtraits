import Link from 'next/link'
import type { Metadata } from 'next'
import { shippingSummary } from '@/lib/shipping/rates'

export const metadata: Metadata = { title: 'Help & delivery | Pawtraits' }

const SUPPORT_EMAIL = 'support@pawtraits.pics'

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'How do I put my pet in a picture?',
    a: 'Pick a design, tap “Add my pet’s photo” and upload a clear, well-lit photo. Pawcasso paints your pet into the design and shows you a free preview in about a minute. No sign-up needed.',
  },
  {
    q: 'What kind of photo works best?',
    a: 'One pet, facing the camera, in good light, with their whole face in shot. JPG, PNG and WEBP files work.',
  },
  {
    q: 'Does it work for cats as well as dogs?',
    a: 'Yes. Cats and dogs, any breed, including mixes.',
  },
  {
    q: 'What can I buy?',
    a: 'Prints, mugs, phone cases and digital downloads. The sizes, materials and prices for each design are on its page.',
  },
  {
    q: 'Do I get a digital copy with a print?',
    a: 'Yes. Every print bought on the website comes with a free digital download of the same Pawtrait.',
  },
  {
    q: 'How much is delivery?',
    a: `Tracked delivery is charged once per order: ${shippingSummary()}. Digital downloads have no delivery charge.`,
  },
  {
    q: 'Where is my order?',
    a: (
      <>
        Your order confirmation email has the details, and we email again when your order is posted. If you have an account, your orders are under{' '}
        <Link href="/orders" className="text-purple-700 underline">My orders</Link>.
      </>
    ),
  },
  {
    q: 'Something is wrong with my order',
    a: (
      <>
        Email <a href={`mailto:${SUPPORT_EMAIL}`} className="text-purple-700 underline">{SUPPORT_EMAIL}</a> with your order number and a photo of the problem, and we will put it right.
      </>
    ),
  },
]

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link href="/" className="text-sm text-purple-700 hover:underline">← Back to Pawtraits</Link>

        <h1 className="mt-4 text-3xl font-semibold text-gray-900">Help &amp; delivery</h1>
        <p className="mt-2 text-gray-600">
          Answers to the questions we hear most. Still stuck? Email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-purple-700 underline">{SUPPORT_EMAIL}</a>.
        </p>

        <div className="mt-8 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
          {FAQS.map(({ q, a }) => (
            <div key={q} className="px-5 py-4">
              <h2 className="font-medium text-gray-900">{q}</h2>
              <p className="mt-1 text-gray-600">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
