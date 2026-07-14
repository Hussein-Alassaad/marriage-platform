import { requireSupabaseClient } from '@/lib/supabase';

export type Tier = 'free' | 'serious' | 'marriage_plus';

/** Cheapest to richest. Feature gates compare rank, never equality. */
export const TIER_ORDER: Tier[] = ['free', 'serious', 'marriage_plus'];

/**
 * Does `tier` meet the minimum a feature asks for? Minimums come from settings
 * (e.g. `finance_charts_min_tier`), so an admin can move a feature between tiers
 * without a deploy — hence the tolerant lookup of an unknown minimum.
 */
export function tierAtLeast(tier: string, minimum: string): boolean {
  const have = TIER_ORDER.indexOf(tier as Tier);
  const need = TIER_ORDER.indexOf(minimum as Tier);
  if (need < 0) return false; // unknown minimum: fail closed, do not unlock
  return have >= need;
}
export type BillingPeriod = 'monthly' | 'yearly';
export type ManualMethod = 'omt' | 'whish' | 'bank_transfer';

export interface Plan {
  tier: Tier;
  name: string;
  monthly_price: number;
  yearly_price: number | null;
  currency: string;
  features: Record<string, boolean>;
}

export interface Subscription {
  id: string;
  tier: Tier;
  status: string;
  started_at: string;
  expires_at: string | null;
}

export interface PaymentClaim {
  id: string;
  method: ManualMethod;
  reference_code: string;
  amount: number | null;
  currency: string;
  status: string;
  receipt_path: string | null;
  submitted_at: string;
  expires_at: string | null;
}

export interface CouponPreview {
  code: string;
  discount: number;
  total: number;
  currency: string;
}

export interface AdminClaim {
  id: string;
  userId: string;
  displayName: string | null;
  method: ManualMethod;
  referenceCode: string;
  amount: number | null;
  currency: string;
  submittedAt: string;
  expiresAt: string | null;
  receiptUrl: string | null;
  tier: Tier | null;
  period: BillingPeriod;
}

export const subscriptionService = {
  /** The plan catalog (RLS: active plans are public — this is the pricing page). */
  async listPlans(): Promise<Plan[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('tier, name, monthly_price, yearly_price, currency, features')
      .eq('active', true);
    if (error) throw error;
    const order: Tier[] = ['free', 'serious', 'marriage_plus'];
    return ((data ?? []) as Plan[]).sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier));
  },

  /** The user's active subscription, if any (RLS: own only). */
  async getMySubscription(userId: string): Promise<Subscription | null> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .select('id, tier, status, started_at, expires_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as Subscription) ?? null;
  },

  /** The user's most recent manual payment claim (RLS: own only). */
  async getMyClaim(userId: string): Promise<PaymentClaim | null> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase
      .from('payment_claims')
      .select(
        'id, method, reference_code, amount, currency, status, receipt_path, submitted_at, expires_at',
      )
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data as PaymentClaim) ?? null;
  },

  /**
   * Preview a coupon. Nothing is spent here — the code is only redeemed when a claim is
   * actually created, so typing one into the box cannot exhaust a campaign.
   */
  async checkCoupon(code: string, tier: Tier, period: BillingPeriod): Promise<CouponPreview> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.functions.invoke('subscriptions', {
      body: { action: 'check-coupon', coupon: code, tier, period },
    });
    if (error) {
      const detail = await error.context?.json?.().catch(() => null);
      if (detail?.error) throw new Error(detail.error);
      throw error;
    }
    if (data?.error) throw new Error(data.error);
    return data as CouponPreview;
  },

  /** Start a manual payment: the server sets the amount from the plan catalog, and applies
   *  the coupon itself. The client sends a CODE, never a price — a client-supplied price
   *  is a free membership. */
  async createClaim(
    tier: Tier,
    method: ManualMethod,
    period: BillingPeriod,
    coupon?: string,
  ): Promise<PaymentClaim> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.functions.invoke('subscriptions', {
      body: { action: 'create-claim', tier, method, period, coupon },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.claim as PaymentClaim;
  },

  /** Upload the receipt into the caller's own folder, then attach it to the claim. */
  async uploadReceipt(userId: string, claimId: string, file: File): Promise<void> {
    const supabase = requireSupabaseClient();
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${userId}/${claimId}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('payment-receipts')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) throw upErr;
    const { data, error } = await supabase.functions.invoke('subscriptions', {
      body: { action: 'attach-receipt', claimId, path },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  },

  /** Admin: the review queue, with short-lived signed receipt URLs. */
  async listPendingClaims(): Promise<AdminClaim[]> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.functions.invoke('subscriptions', {
      body: { action: 'pending-claims' },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return (data.claims ?? []) as AdminClaim[];
  },

  /** Admin: approve (activates the tier) or reject a claim. */
  async reviewClaim(
    claimId: string,
    decision: 'approved' | 'rejected',
    reason?: string,
  ): Promise<void> {
    const supabase = requireSupabaseClient();
    const { data, error } = await supabase.functions.invoke('subscriptions', {
      body: { action: 'review', claimId, decision, reason },
    });
    if (error) {
      // A non-2xx from an Edge Function surfaces as "returned a non-2xx status code",
      // which names nothing. The reason is in the body — read it.
      const detail = await error.context?.json?.().catch(() => null);
      if (detail?.error) throw new Error(detail.error);
      throw error;
    }
    if (data?.error) throw new Error(data.error);
  },
};
