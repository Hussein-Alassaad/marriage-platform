// Paddle webhook signature verification.
//
// Paddle signs each webhook with a `Paddle-Signature` header shaped like
// `ts=<unix_seconds>;h1=<hex_hmac>`. The HMAC is SHA-256 of `${ts}:${rawBody}`
// keyed with the notification destination's secret (from Paddle's dashboard /
// the notification-settings API, stored as PADDLE_WEBHOOK_SECRET). This must
// run against the raw, unparsed request body — re-serializing parsed JSON can
// reorder keys or change whitespace and silently break verification.
//
// Fails closed: any malformed header, wrong key, or mismatched signature
// returns false, and the caller must reject the request. A webhook that can't
// be verified is not a event to act on — it's how someone forges a payment.

export async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;

  const parts = new Map(
    signatureHeader.split(';').map((p) => {
      const [k, v] = p.split('=');
      return [k, v] as [string, string];
    }),
  );
  const ts = parts.get('ts');
  const h1 = parts.get('h1');
  if (!ts || !h1) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${ts}:${rawBody}`));
  const computed = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison — a length/early-exit timing difference on a
  // signature check is exactly the kind of side channel this exists to avoid.
  if (computed.length !== h1.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ h1.charCodeAt(i);
  return diff === 0;
}
