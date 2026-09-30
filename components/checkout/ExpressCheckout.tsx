'use client'

/**
 * One-tap checkout with Apple Pay / Google Pay / Link (Stripe Express Checkout Element).
 *
 * Uses Stripe's "deferred intent" flow: the wallet sheet opens straight away with the
 * basket total, collects email / name / delivery address and the delivery option itself,
 * and only when the customer authorises do we create the PaymentIntent (same
 * /api/payments/create-intent route as the card form) and confirm it.
 *
 * Shipping rates depend only on the destination country, so they are quoted from the
 * partial address the wallet shares before the customer authorises.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Elements, ExpressCheckoutElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe-client'

export interface ShippingQuote {
  id: string
  name: string
  description?: string
  price: number // pence
  currency?: string
  estimatedDeliveryDays?: string
  [key: string]: any
}

export interface ExpressPayer {
  email: string
  firstName: string
  lastName: string
  phone?: string
  address?: {
    addressLine1: string
    addressLine2?: string
    city: string
    postcode: string
    country: string
  }
  shippingOption?: ShippingQuote | null
}

interface Props {
  /** Goods total after discounts/rewards, excluding shipping, in pence */
  goodsTotalPence: number
  needsShipping: boolean
  allowedCountries: string[]
  defaultCountry: string
  /** Quote delivery options for a country (pence prices) */
  getShippingQuotes: (country: string) => Promise<ShippingQuote[]>
  /** Create the PaymentIntent for this payer and return its client secret */
  createIntent: (payer: ExpressPayer) => Promise<{ clientSecret: string }>
  onStart?: () => void
  onSuccess: (paymentIntent: any) => void
  /** Called with false when no wallet is available on this device (info: what Stripe reported, for ?debugwallet) */
  onAvailability?: (available: boolean, info?: string) => void
}

function splitName(full: string | undefined | null, fallbackEmail: string) {
  const name = (full || '').trim().replace(/\s+/g, ' ')
  if (!name) return { firstName: fallbackEmail.split('@')[0] || 'Customer', lastName: '' }
  const i = name.lastIndexOf(' ')
  return i === -1 ? { firstName: name, lastName: '' } : { firstName: name.slice(0, i), lastName: name.slice(i + 1) }
}

const toRate = (q: ShippingQuote) => ({
  id: String(q.id),
  amount: q.price,
  displayName: q.name || 'Delivery',
})

function ExpressButtons({ goodsTotalPence, needsShipping, allowedCountries, defaultCountry, getShippingQuotes, createIntent, onStart, onSuccess, onAvailability }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const [error, setError] = useState<string | null>(null)
  // Current quotes + the rate the customer has picked in the wallet sheet
  const quotes = useRef<ShippingQuote[]>([])
  const shippingPence = useRef(0)

  // Pre-quote delivery for the default country so the sheet can open instantly
  // (the click handler must resolve within 1 second).
  useEffect(() => {
    if (!needsShipping) return
    let cancelled = false
    getShippingQuotes(defaultCountry).then(q => {
      if (cancelled || !q.length) return
      quotes.current = q
      shippingPence.current = q[0].price
      elements?.update({ amount: goodsTotalPence + q[0].price })
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsShipping, defaultCountry, elements])

  // Keep the wallet total in step with basket changes (e.g. rewards toggled)
  useEffect(() => {
    elements?.update({ amount: goodsTotalPence + (needsShipping ? shippingPence.current : 0) })
  }, [elements, goodsTotalPence, needsShipping])

  return (
    <div>
      <ExpressCheckoutElement
        options={{
          emailRequired: true,
          phoneNumberRequired: false,
          shippingAddressRequired: needsShipping,
          allowedShippingCountries: needsShipping ? allowedCountries : undefined,
          buttonHeight: 50,
          buttonType: { applePay: 'buy', googlePay: 'buy' },
          paymentMethodOrder: ['apple_pay', 'google_pay', 'link'],
          // 'always' shows Apple Pay / Google Pay wherever the browser supports them, even before
          // a card is saved in the wallet (the sheet lets the customer add one). With the default
          // 'auto' the buttons were hidden for anyone without a saved card, so checkout fell back to the form.
          paymentMethods: { applePay: 'always', googlePay: 'always', link: 'auto' },
          layout: { maxColumns: 1, maxRows: 3, overflow: 'never' },
        } as any}
        onReady={(e: any) => onAvailability?.(
          !!e.availablePaymentMethods && Object.values(e.availablePaymentMethods).some(Boolean),
          `Stripe offered: ${JSON.stringify(e.availablePaymentMethods ?? null)}`
        )}
        onLoadError={(e: any) => onAvailability?.(false, `Stripe load error: ${e?.error?.message || e?.error?.type || 'unknown'}`)}
        onClick={(e: any) => {
          setError(null)
          if (needsShipping && !quotes.current.length) {
            // Quote not back yet — offer a placeholder; the real rates arrive once the address is chosen
            quotes.current = [{ id: 'standard_fallback', name: 'Standard Delivery', price: 999, currency: 'GBP', estimatedDeliveryDays: '7-10' }]
            shippingPence.current = 999
          }
          onStart?.()
          e.resolve(needsShipping ? { shippingRates: quotes.current.map(toRate) } : {})
        }}
        onShippingAddressChange={async (e: any) => {
          const country = String(e.address?.country || '').toUpperCase()
          try {
            const q = await getShippingQuotes(country)
            if (!q.length) return e.reject()
            quotes.current = q
            shippingPence.current = q[0].price
            elements?.update({ amount: goodsTotalPence + q[0].price })
            e.resolve({ shippingRates: q.map(toRate) })
          } catch {
            e.reject()
          }
        }}
        onShippingRateChange={(e: any) => {
          const q = quotes.current.find(x => String(x.id) === e.shippingRate?.id)
          shippingPence.current = q ? q.price : e.shippingRate?.amount || 0
          elements?.update({ amount: goodsTotalPence + shippingPence.current })
          e.resolve({})
        }}
        onConfirm={async (e: any) => {
          if (!stripe || !elements) return e.paymentFailed({ reason: 'fail' })
          try {
            const { error: submitError } = await elements.submit()
            if (submitError) throw submitError

            const email = String(e.billingDetails?.email || '').trim()
            const { firstName, lastName } = splitName(e.shippingAddress?.name || e.billingDetails?.name, email)
            const a = e.shippingAddress?.address
            const option = needsShipping
              ? (quotes.current.find(x => String(x.id) === e.shippingRate?.id) || quotes.current[0] || null)
              : null
            const { clientSecret } = await createIntent({
              email,
              firstName,
              lastName,
              phone: e.billingDetails?.phone || undefined,
              address: needsShipping && a ? {
                addressLine1: a.line1 || '',
                addressLine2: a.line2 || '',
                city: a.city || a.state || '',
                postcode: a.postal_code || '',
                country: (a.country || defaultCountry).toUpperCase(),
              } : undefined,
              shippingOption: option,
            })

            const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
              elements,
              clientSecret,
              confirmParams: {
                return_url: `${window.location.origin}/shop/order-confirmation`,
                receipt_email: email || undefined,
              },
              redirect: 'if_required',
            })
            if (confirmError) throw confirmError
            onSuccess(paymentIntent)
          } catch (err: any) {
            const message = err?.message || 'Payment failed — please try again or pay by card below.'
            setError(message)
            e.paymentFailed({ reason: 'fail', message })
          }
        }}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}

export default function ExpressCheckout(props: Props) {
  // Elements in deferred mode: no PaymentIntent until the customer authorises.
  // Options are fixed at mount; the amount is then kept current with elements.update().
  const [options] = useState(() => ({
    mode: 'payment' as const,
    amount: Math.max(props.goodsTotalPence, 50),
    currency: 'gbp',
    appearance: { theme: 'stripe' as const, variables: { colorPrimary: '#9333ea', borderRadius: '10px' } },
  }))
  const stripePromise = useMemo(() => getStripe(), [])
  if (props.goodsTotalPence < 50) return null // Stripe minimum charge
  return (
    <Elements stripe={stripePromise} options={options}>
      <ExpressButtons {...props} />
    </Elements>
  )
}
