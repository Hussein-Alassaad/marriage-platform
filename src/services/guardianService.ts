import { requireSupabaseClient } from '@/lib/supabase';

export type Relationship = 'father' | 'mother' | 'brother' | 'uncle' | 'wali' | 'other';

export interface GuardianInvitation {
  id: string;
  invite_code: string;
  relationship: Relationship;
  guardian_name: string | null;
  status: string;
  expires_at: string | null;
  created_at: string;
}

export interface GuardianLink {
  userId: string;
  displayName: string | null;
  relationship: Relationship;
  confirmed: boolean;
  createdAt: string;
}

export interface MyGuardians {
  guardians: GuardianLink[];
  invitation: GuardianInvitation | null;
  sharedMatches: { guardianUserId: string; matchId: string }[];
}

export interface GuardianPerson {
  id: string;
  display_name: string | null;
  dob: string | null;
  country: string | null;
  city: string | null;
  occupation: string | null;
  education_level: string | null;
}

export interface SharedMatch {
  id: string;
  stage: string;
  createdAt: string;
  ward: GuardianPerson | null;
  candidate: GuardianPerson | null;
}

export interface InviteInput {
  relationship: Relationship;
  name?: string;
  email?: string;
  phone?: string;
  note?: string;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.functions.invoke('guardian', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const guardianService = {
  /** Her guardians, any open invitation, and which connections she has shared. */
  getMyGuardians: () => call<MyGuardians>({ action: 'my-guardians' }),

  /** Invite a guardian — returns the one-time code she shares with them. */
  invite: async (input: InviteInput) => {
    const data = await call<{ invitation: GuardianInvitation }>({ action: 'invite', ...input });
    return data.invitation;
  },

  /** The invited person redeems the code and declares they are authorised. */
  accept: (code: string) =>
    call<{ ok: true; wardId: string }>({ action: 'accept', code, confirmed: true }),

  setMatchAccess: (matchId: string, guardianUserId: string, granted: boolean) =>
    call<{ ok: true; granted: boolean }>({
      action: granted ? 'grant-access' : 'revoke-access',
      matchId,
      guardianUserId,
    }),

  /** The guardian's view: only the connections shared with them. */
  getSharedMatches: async () => {
    const data = await call<{ matches: SharedMatch[] }>({ action: 'shared-matches' });
    return data.matches;
  },
};
