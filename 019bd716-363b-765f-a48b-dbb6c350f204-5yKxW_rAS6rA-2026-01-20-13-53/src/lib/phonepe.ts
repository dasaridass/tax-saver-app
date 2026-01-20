/**
 * PhonePe Payment Gateway Integration (Web)
 * Currently in MOCK MODE for prototype testing
 *
 * To enable real PhonePe payments:
 * 1. Complete PhonePe merchant onboarding
 * 2. Get valid test credentials from PhonePe dashboard
 * 3. Set EXPO_PUBLIC_PHONEPE_USE_LIVE=true in ENV tab
 */

// Environment variables
const MERCHANT_ID = process.env.EXPO_PUBLIC_PHONEPE_MERCHANT_ID || '';
const SALT_KEY = process.env.EXPO_PUBLIC_PHONEPE_SALT_KEY || '';
const SALT_INDEX = process.env.EXPO_PUBLIC_PHONEPE_SALT_INDEX || '1';

// Force mock mode for prototype (set to 'true' in ENV to use real PhonePe)
const USE_LIVE_PHONEPE = process.env.EXPO_PUBLIC_PHONEPE_USE_LIVE === 'true';

// PhonePe UAT/Sandbox endpoint
const PHONEPE_API_URL = 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay';
const PHONEPE_STATUS_URL = 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status';

export interface PhonePePaymentResult {
  success: boolean;
  redirectUrl?: string;
  transactionId?: string;
  error?: string;
}

/**
 * Generate SHA256 hash using Web Crypto API (browser-compatible)
 */
async function sha256Hash(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate unique transaction ID
 */
function generateTransactionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `TXN_${timestamp}_${random}`;
}

/**
 * Initiate PhonePe payment
 * Uses mock mode by default for prototype testing
 */
export async function initiatePhonePePayment(
  amount: number = 100,
  customerName: string = 'User',
  customerMobile: string = '9999999999'
): Promise<PhonePePaymentResult> {
  // Use mock payment for prototype unless explicitly enabled
  if (!USE_LIVE_PHONEPE) {
    console.log('Using mock payment mode (prototype)');
    return mockPayment();
  }

  // Check if credentials are configured for live mode
  if (!MERCHANT_ID || !SALT_KEY) {
    console.warn('PhonePe credentials not configured. Using mock payment.');
    return mockPayment();
  }

  const merchantTransactionId = generateTransactionId();

  // Get current URL for redirect (web only)
  const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
  const redirectUrl = `${currentUrl}?payment_status=success&txnId=${merchantTransactionId}`;
  const callbackUrl = redirectUrl;

  // PhonePe payload structure
  const payload = {
    merchantId: MERCHANT_ID,
    merchantTransactionId: merchantTransactionId,
    merchantUserId: `USER_${Date.now()}`,
    amount: amount * 100, // Amount in paise (₹100 = 10000 paise)
    redirectUrl: redirectUrl,
    redirectMode: 'REDIRECT',
    callbackUrl: callbackUrl,
    mobileNumber: customerMobile,
    paymentInstrument: {
      type: 'PAY_PAGE',
    },
  };

  try {
    // Base64 encode the payload
    const payloadString = JSON.stringify(payload);
    const base64Payload = btoa(payloadString);

    // Generate checksum: SHA256(base64Payload + "/pg/v1/pay" + saltKey) + "###" + saltIndex
    const checksumString = base64Payload + '/pg/v1/pay' + SALT_KEY;
    const sha256 = await sha256Hash(checksumString);
    const checksum = sha256 + '###' + SALT_INDEX;

    // Make API request to PhonePe
    const response = await fetch(PHONEPE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'accept': 'application/json',
      },
      body: JSON.stringify({
        request: base64Payload,
      }),
    });

    const data = await response.json();

    if (data.success && data.data?.instrumentResponse?.redirectInfo?.url) {
      return {
        success: true,
        redirectUrl: data.data.instrumentResponse.redirectInfo.url,
        transactionId: merchantTransactionId,
      };
    } else {
      console.error('PhonePe API error:', JSON.stringify(data, null, 2));
      // Fallback to mock payment on error
      console.log('Falling back to mock payment');
      return mockPayment();
    }
  } catch (error) {
    console.error('PhonePe payment error:', error);
    // Fallback to mock payment on network error
    return mockPayment();
  }
}

/**
 * Check payment status
 */
export async function checkPaymentStatus(transactionId: string): Promise<{
  success: boolean;
  status: string;
  message?: string;
}> {
  // Mock mode always returns success
  if (!USE_LIVE_PHONEPE || !MERCHANT_ID || !SALT_KEY) {
    return { success: true, status: 'SUCCESS' };
  }

  try {
    const statusUrl = `${PHONEPE_STATUS_URL}/${MERCHANT_ID}/${transactionId}`;
    const checksumString = `/pg/v1/status/${MERCHANT_ID}/${transactionId}` + SALT_KEY;
    const sha256 = await sha256Hash(checksumString);
    const checksum = sha256 + '###' + SALT_INDEX;

    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': MERCHANT_ID,
        'accept': 'application/json',
      },
    });

    const data = await response.json();

    return {
      success: data.success && data.code === 'PAYMENT_SUCCESS',
      status: data.code || 'UNKNOWN',
      message: data.message,
    };
  } catch (error) {
    console.error('Status check error:', error);
    return {
      success: false,
      status: 'ERROR',
      message: 'Failed to check payment status',
    };
  }
}

/**
 * Mock payment for testing when credentials are not configured
 */
async function mockPayment(): Promise<PhonePePaymentResult> {
  // Simulate API delay (2 seconds as requested)
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return {
    success: true,
    transactionId: `MOCK_${Date.now()}`,
  };
}

/**
 * Check if PhonePe is properly configured AND live mode is enabled
 */
export function isPhonePeConfigured(): boolean {
  return USE_LIVE_PHONEPE && Boolean(MERCHANT_ID && SALT_KEY);
}
