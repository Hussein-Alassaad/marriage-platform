// Edge Function: verify-identity
// Identity documents are server-only (the `identity-documents` bucket has no
// client policies), and `identity_verifications` is not client-writable — so all
// submissions and admin reviews flow through here with the service role.
//
// Actions:
//   • submit  (multipart/form-data): the signed-in user uploads a document
//     (+ optional selfie); we store them in their folder and create a pending
//     `identity_verifications` row. A DB trigger locks gender + flips the profile
//     to `verified` once an admin approves.
//   • review  (JSON, admin only): { action:'review', id, decision, reason? }.
//
// Deploy: `supabase functions deploy verify-identity` (requires your login).
// Secrets used: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { emit } from '../_shared/notify.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DOC_BUCKET = 'identity-documents';
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const extFor = (file: File) => {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  return file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1] || 'bin';
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // Identify the caller from their JWT.
  const asUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await asUser.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(url, serviceKey);
  const contentType = req.headers.get('content-type') ?? '';

  try {
    // ── submit ───────────────────────────────────────────────────────────────
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const document = form.get('document');
      const selfie = form.get('selfie');
      const documentType = String(form.get('documentType') ?? '');

      if (!(document instanceof File)) return json({ error: 'document_required' }, 400);
      for (const f of [document, selfie].filter((x): x is File => x instanceof File)) {
        if (!ALLOWED.includes(f.type)) return json({ error: 'unsupported_type' }, 400);
        if (f.size > MAX_BYTES) return json({ error: 'file_too_large' }, 400);
      }

      // Block duplicate submissions while one is already verified/pending.
      const { data: existing } = await admin
        .from('identity_verifications')
        .select('status')
        .eq('user_id', user.id)
        .in('status', ['verified', 'pending'])
        .maybeSingle();
      if (existing?.status === 'verified') return json({ status: 'verified' });
      if (existing?.status === 'pending') return json({ status: 'pending' });

      const docPath = `${user.id}/document-${crypto.randomUUID()}.${extFor(document)}`;
      const up1 = await admin.storage.from(DOC_BUCKET).upload(docPath, document, { contentType: document.type });
      if (up1.error) return json({ error: up1.error.message }, 400);

      let selfiePath: string | null = null;
      if (selfie instanceof File) {
        selfiePath = `${user.id}/selfie-${crypto.randomUUID()}.${extFor(selfie)}`;
        const up2 = await admin.storage.from(DOC_BUCKET).upload(selfiePath, selfie, { contentType: selfie.type });
        if (up2.error) return json({ error: up2.error.message }, 400);
      }

      const { data, error } = await admin
        .from('identity_verifications')
        .insert({
          user_id: user.id,
          status: 'pending',
          document_type: documentType || null,
          document_path: docPath,
          selfie_path: selfiePath,
          provider: 'manual',
        })
        .select('id, status')
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ status: 'pending', id: data.id });
    }

    // ── review (admin only) ────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    if (body.action === 'review') {
      const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id);
      const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin' || r.role === 'super_admin');
      if (!isAdmin) return json({ error: 'forbidden' }, 403);

      const decision = String(body.decision);
      if (decision !== 'verified' && decision !== 'rejected') return json({ error: 'bad_decision' }, 400);

      const { error } = await admin
        .from('identity_verifications')
        .update({
          status: decision,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: decision === 'rejected' ? (body.reason ?? null) : null,
        })
        .eq('id', body.id);
      if (error) return json({ error: error.message }, 400);

      const { data: record } = await admin
        .from('identity_verifications')
        .select('user_id')
        .eq('id', body.id)
        .maybeSingle();
      await emit(
        admin,
        decision === 'verified' ? 'verification.approved' : 'verification.rejected',
        record?.user_id ?? null,
        decision === 'rejected' ? { reason: body.reason ?? null } : {},
      );
      return json({ ok: true });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unexpected_error' }, 500);
  }
});
