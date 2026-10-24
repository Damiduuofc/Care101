import type { useStripe } from '@stripe/stripe-react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

type StripeSheet = Pick<ReturnType<typeof useStripe>, 'initPaymentSheet' | 'presentPaymentSheet'>;

export type BillPaymentResult =
    | { status: 'paid'; queueNumber: number | null }
    // Card was charged but the server couldn't record it yet; the server recovers it automatically
    | { status: 'unconfirmed'; message: string }
    | { status: 'canceled' }
    | { status: 'failed'; message: string };

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Tells the server the bill was paid. It verifies the payment with Stripe and is safe to repeat,
// so we retry through brief network drops instead of losing a successful payment.
const confirmBillPayment = async (token: string, billId: string, paymentIntentId?: string) => {
    let lastMessage = 'Could not reach the server.';
    for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) await wait(1500 * attempt);
        try {
            const res = await fetch(`${API_URL}/payments/pay-bill/${billId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ paymentIntentId })
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && res.status !== 202) {
                return { ok: true as const, queueNumber: data.queueNumber ?? null };
            }
            lastMessage = data.msg || `Server responded with ${res.status}`;
            // 202 = still processing, 5xx = server hiccup: worth retrying. Other 4xx won't change.
            if (res.status !== 202 && res.status < 500) break;
        } catch (err: any) {
            lastMessage = err?.message || lastMessage;
        }
    }
    return { ok: false as const, message: lastMessage };
};

// Runs the full Stripe payment for one bill: create/reuse the bill's intent, show the sheet, confirm with the server.
export const payBill = async (token: string, billId: string, stripe: StripeSheet): Promise<BillPaymentResult> => {
    try {
        const intentRes = await fetch(`${API_URL}/payments/create-intent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ billId })
        });
        const intentData = await intentRes.json().catch(() => ({}));

        if (!intentRes.ok) {
            return { status: 'failed', message: intentData.msg || 'Could not start the payment. Please try again.' };
        }
        // A previous attempt was charged but not recorded; the server has now recorded it
        if (intentData.alreadyPaid) {
            return { status: 'paid', queueNumber: null };
        }

        const { error: initError } = await stripe.initPaymentSheet({
            paymentIntentClientSecret: intentData.clientSecret,
            merchantDisplayName: 'Care101 Hospital',
            returnURL: 'carelink://stripe-redirect',
            defaultBillingDetails: { address: { country: 'LK' } }
        });
        if (initError) {
            return { status: 'failed', message: initError.message };
        }

        const { error: paymentError } = await stripe.presentPaymentSheet();
        if (paymentError) {
            if (paymentError.code === 'Canceled') return { status: 'canceled' };
            return { status: 'failed', message: paymentError.message };
        }

        const confirmed = await confirmBillPayment(token, billId, intentData.paymentIntentId);
        if (confirmed.ok) {
            return { status: 'paid', queueNumber: confirmed.queueNumber };
        }
        return {
            status: 'unconfirmed',
            message: 'Your payment was received, but we could not confirm it yet. It will be updated automatically within a few minutes — please do not pay again.'
        };
    } catch (err: any) {
        return { status: 'failed', message: err?.message || 'Payment system offline. Please try again.' };
    }
};

// Gives an RN <Modal> time to finish closing; presenting the Stripe sheet while it animates out can silently fail on iOS.
export const waitForModalDismiss = () => wait(450);
