import { loadStripe } from '@stripe/stripe-js';

if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required');
}

// Initialize Stripe with the publishable key
let stripePromise: Promise<any>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
};

// Helper function to create payment method
export const createPaymentMethod = async (stripe: any, elements: any, customerDetails: {
  email: string;
  name: string;
}) => {
  if (!stripe || !elements) {
    throw new Error('Stripe or Elements not loaded');
  }

  const cardElement = elements.getElement('card');
  if (!cardElement) {
    throw new Error('Card element not found');
  }

  try {
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: {
        name: customerDetails.name,
        email: customerDetails.email,
      },
    });

    if (error) {
      console.error('Error creating payment method:', error);
      throw error;
    }

    return paymentMethod;
  } catch (error) {
    console.error('Error in createPaymentMethod:', error);
    throw error;
  }
};

// Helper function to confirm payment with payment method
export const confirmPayment = async (
  stripe: any,
  clientSecret: string,
  paymentMethodId: string,
  customerDetails: {
    email: string;
    name: string;
    address: {
      line1: string;
      city: string;
      postal_code: string;
      country: string;
    };
  }
) => {
  if (!stripe) {
    throw new Error('Stripe not loaded');
  }

  try {
    const { error, paymentIntent } = await stripe.confirmPayment({
      clientSecret,
      payment_method: paymentMethodId,
      receipt_email: customerDetails.email,
    });

    if (error) {
      console.error('Error confirming payment:', error);
      throw error;
    }

    return paymentIntent;
  } catch (error) {
    console.error('Error in confirmPayment:', error);
    throw error;
  }
};

// Helper function to confirm payment with Elements
export const confirmPaymentWithElements = async (
  stripe: any,
  elements: any,
  clientSecret: string,
  customerDetails: {
    email: string;
    name: string;
    address: {
      line1: string;
      city: string;
      postal_code: string;
      country: string;
    };
  },
  returnUrl: string
) => {
  if (!stripe || !elements) {
    throw new Error('Stripe or Elements not loaded');
  }

  try {
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: {
        return_url: returnUrl,
        receipt_email: customerDetails.email,
        payment_method_data: {
          billing_details: {
            name: customerDetails.name,
            email: customerDetails.email,
            address: {
              line1: customerDetails.address.line1,
              city: customerDetails.address.city,
              postal_code: customerDetails.address.postal_code,
              country: customerDetails.address.country,
            },
          },
        },
      },
    });

    if (error) {
      console.error('Error confirming payment with elements:', error);
      throw error;
    }

    return paymentIntent;
  } catch (error) {
    console.error('Error in confirmPaymentWithElements:', error);
    throw error;
  }
};

// Helper function to retrieve payment intent
export const retrievePaymentIntentClient = async (
  stripe: any,
  clientSecret: string
) => {
  if (!stripe) {
    throw new Error('Stripe not loaded');
  }

  try {
    const { error, paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);

    if (error) {
      console.error('Error retrieving payment intent:', error);
      throw error;
    }

    return paymentIntent;
  } catch (error) {
    console.error('Error in retrievePaymentIntentClient:', error);
    throw error;
  }
};

// Helper function to handle payment result
export const handlePaymentResult = (paymentIntent: any) => {
  switch (paymentIntent.status) {
    case 'succeeded':
      return {
        success: true,
        message: 'Payment succeeded!',
        status: 'succeeded'
      };
    case 'processing':
      return {
        success: false,
        message: 'Your payment is processing.',
        status: 'processing'
      };
    case 'requires_payment_method':
      return {
        success: false,
        message: 'Your payment was not successful, please try again.',
        status: 'requires_payment_method'
      };
    default:
      return {
        success: false,
        message: 'Something went wrong.',
        status: paymentIntent.status
      };
  }
};

// Type definitions
export interface PaymentResult {
  success: boolean;
  message: string;
  status: string;
  paymentIntent?: any;
}

export interface CustomerDetails {
  email: string;
  name: string;
  address?: {
    line1: string;
    city: string;
    postal_code: string;
    country: string;
  };
}

// Stripe appearance configuration for consistent styling
export const stripeAppearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#7c3aed', // Purple-600 to match our theme
    colorBackground: '#ffffff',
    colorText: '#1f2937',
    colorDanger: '#dc2626',
    fontFamily: 'system-ui, sans-serif',
    spacingUnit: '4px',
    borderRadius: '8px',
  },
  rules: {
    '.Input': {
      border: '1px solid #d1d5db',
      boxShadow: 'none',
    },
    '.Input:focus': {
      border: '1px solid #7c3aed',
      boxShadow: '0 0 0 2px rgba(124, 58, 237, 0.1)',
    },
    '.Label': {
      fontSize: '14px',
      fontWeight: '500',
      color: '#374151',
    },
  },
};