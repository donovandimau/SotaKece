#!/usr/bin/env node
// Makes the key pair that lets Sota Kece send call alerts to phones that have the site closed.
// Run it once on your own computer:   node scripts/make-vapid-keys.mjs
// It prints two lines. Put each on the Cloudflare Worker "sotakece" as a secret, for example:
//   npx wrangler secret put VAPID_PUBLIC_KEY      (paste the public value)
//   npx wrangler secret put VAPID_PRIVATE_KEY     (paste the private value)
// The private value is a password: do not commit it, paste it into a chat, or share it.
// Making a new pair later switches every phone over; people just turn the alert on again.
import { webcrypto } from 'node:crypto';
const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
const raw = Buffer.from(await webcrypto.subtle.exportKey('raw', pair.publicKey));
const jwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
console.log('VAPID_PUBLIC_KEY=' + raw.toString('base64url'));
console.log('VAPID_PRIVATE_KEY=' + jwk.d);
