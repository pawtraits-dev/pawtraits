import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required');
}

// Initialize Stripe with the secret key
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

// Helper function to convert amount from pounds to pence (Stripe expects amounts in smallest currency unit)
export const convertToPence = (amountInPounds: number): number => {
  return Math.round(amountInPounds * 100);
};

// Helper function to convert amount from pence to pounds
export const convertToPounds = (amountInPence: number): number => {
  return amountInPence / 100;
};

// Helper function to create a PaymentIntent
export const createPaymentIntent = async (params: {
  amount: number; // in pence
  currency: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  automaticPaymentMethods?: boolean;
}) => {
  const {
    amount,
    currency = 'gbp',
    customerEmail,
    metadata = {},
    automaticPaymentMethods = true,
  } = params;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      receipt_email: customerEmail,
      metadata,
      ...(automaticPaymentMethods && {
        automatic_payment_methods: {
          enabled: true,
        },
      }),
    });

    return paymentIntent;
  } catch (error) {
    console.error('Error creating PaymentIntent:', error);
    throw error;
  }
};

// Helper function to retrieve a PaymentIntent
export const retrievePaymentIntent = async (paymentIntentId: string) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    console.error('Error retrieving PaymentIntent:', error);
    throw error;
  }
};

// Helper function to update a PaymentIntent
export const updatePaymentIntent = async (
  paymentIntentId: string,
  params: Stripe.PaymentIntentUpdateParams
) => {
  try {
    const paymentIntent = await stripe.paymentIntents.update(paymentIntentId, params);
    return paymentIntent;
  } catch (error) {
    console.error('Error updating PaymentIntent:', error);
    throw error;
  }
};

// Helper function to confirm a PaymentIntent
export const confirmPaymentIntent = async (
  paymentIntentId: string,
  params?: Stripe.PaymentIntentConfirmParams
) => {
  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, params);
    return paymentIntent;
  } catch (error) {
    console.error('Error confirming PaymentIntent:', error);
    throw error;
  }
};

// Helper function to create a Customer
export const createStripeCustomer = async (params: {
  email: string;
  name?: string;
  phone?: string;
  metadata?: Record<string, string>;
}) => {
  try {
    const customer = await stripe.customers.create(params);
    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw error;
  }
};

// Helper function to retrieve a Customer
export const retrieveStripeCustomer = async (customerId: string) => {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer;
  } catch (error) {
    console.error('Error retrieving Stripe customer:', error);
    throw error;
  }
};

// Helper function to update a Customer
export const updateStripeCustomer = async (
  customerId: string,
  params: Stripe.CustomerUpdateParams
) => {
  try {
    const customer = await stripe.customers.update(customerId, params);
    return customer;
  } catch (error) {
    console.error('Error updating Stripe customer:', error);
    throw error;
  }
};

// Helper function to construct webhook event
export const constructWebhookEvent = (
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event => {
  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error('Error constructing webhook event:', error);
    throw error;
  }
};

// Helper function to format currency for display
export const formatCurrency = (
  amountInPence: number,
  currency: string = 'GBP',
  locale: string = 'en-GB'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  }).format(convertToPounds(amountInPence));
};

// Types for commonly used Stripe objects
export type StripePaymentIntent = Stripe.PaymentIntent;
export type StripeCustomer = Stripe.Customer;
export type StripeEvent = Stripe.Event;
export type StripeError = Stripe.StripeError;