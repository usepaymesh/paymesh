import { createClient } from './packages/paymesh/src';
import { stripe } from './packages/stripe/src';

export const paymesh = createClient({
	provider: stripe(),
});
