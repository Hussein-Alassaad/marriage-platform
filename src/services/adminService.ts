import { requireSupabaseClient } from '@/lib/supabase';

/**
 * Every admin action goes through the `admin` Edge Function, which re-checks the role
 * server-side and audits the mutation. The role check in the UI is an affordance — it
 * decides what to *show*, never what is *allowed*.
 */

export interface Overview {
  members: number;
  verified: number;
  pendingVerifications: number;
  pendingClaims: number;
  activeMatches: number;
  openTickets: number;
  tiers: Record<string, number>;
  moderation: { checked: number; blocked: number; byCategory: Record<string, number> };
}

export interface Setting {
  key: string;
  value: unknown;
  type: 'number' | 'boolean' | 'string' | 'json';
  is_public: boolean;
  description: string | null;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  display_name: string | null;
  gender: string | null;
  country: string | null;
  verification_status: string;
  subscription_tier: string;
  status: 'active' | 'suspended' | 'banned';
  suspended_until: string | null;
  created_at: string;
}

export interface VerificationItem {
  id: string;
  userId: string;
  documentType: string | null;
  submittedAt: string;
  profile: { display_name?: string | null; dob?: string | null; country?: string | null } | null;
  documentUrl: string | null;
  selfieUrl: string | null;
}

export interface Job {
  name: string;
  schedule: string;
  enabled: boolean;
  last_run_at: string | null;
  last_result: string | null;
}

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  actorName: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  reason: string | null;
  created_at: string;
}

export interface Ticket {
  id: string;
  user_id: string | null;
  category: string;
  subject: string;
  body: string | null;
  status: string;
  created_at: string;
}

async function call<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.functions.invoke('admin', { body: { action, ...extra } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export interface HealthCheck {
  key: string;
  ok: boolean;
  detail: string;
}

export const adminService = {
  overview: () => call<Overview>('overview'),

  /** The silent-failure traps: each can be broken for a week without raising an error. */
  health: () => call<{ checks: HealthCheck[]; healthy: boolean }>('health'),

  listSettings: () => call<{ settings: Setting[] }>('settings-list').then((r) => r.settings),
  updateSetting: (key: string, value: unknown) =>
    call<{ ok: true }>('settings-update', { key, value }),

  searchUsers: (query: string) =>
    call<{ users: AdminUser[] }>('users-search', { query }).then((r) => r.users),
  setUserStatus: (
    userId: string,
    status: 'active' | 'suspended' | 'banned',
    days?: number,
    reason?: string,
  ) => call<{ ok: true }>('user-status', { userId, status, days, reason }),

  verificationQueue: () =>
    call<{ queue: VerificationItem[] }>('verification-queue').then((r) => r.queue),
  reviewVerification: (id: string, decision: 'verified' | 'rejected', reason?: string) =>
    call<{ ok: true }>('verification-review', { id, decision, reason }),

  listJobs: () => call<{ jobs: Job[] }>('jobs').then((r) => r.jobs),
  runJob: (name: string) => call<{ result: string }>('job-run', { name }),
  toggleJob: (name: string, enabled: boolean) =>
    call<{ ok: true }>('job-toggle', { name, enabled }),

  auditLog: () => call<{ entries: AuditEntry[] }>('audit').then((r) => r.entries),

  listTickets: () => call<{ tickets: Ticket[] }>('tickets').then((r) => r.tickets),
  updateTicket: (id: string, status: string) => call<{ ok: true }>('ticket-update', { id, status }),
};
