import { describe, expect, it } from 'vitest';

import {
  computeMarriageReadiness,
  computeProfileQuality,
  computeTrustScore,
  profileQualitySuggestions,
} from '@/services/profileService';

describe('computeMarriageReadiness', () => {
  it('is 0 when nothing is done', () => {
    expect(
      computeMarriageReadiness({
        profile_completion: 0,
        verification_status: 'unverified',
        marriage_goals: {},
        financial_readiness: {},
        lifestyle: {},
      }),
    ).toBe(0);
  });

  it('is 100 when every check passes', () => {
    expect(
      computeMarriageReadiness({
        profile_completion: 100,
        verification_status: 'verified',
        marriage_goals: { timeline: 'within_year' },
        financial_readiness: { savings: 'ready' },
        lifestyle: { religiosity: 'practicing' },
      }),
    ).toBe(100);
  });

  it('scales with partial readiness', () => {
    expect(
      computeMarriageReadiness({
        profile_completion: 100,
        verification_status: 'verified',
        marriage_goals: {},
        financial_readiness: {},
        lifestyle: {},
      }),
    ).toBe(40); // 2 of 5 checks
  });
});

describe('computeProfileQuality', () => {
  const empty = {
    profile_completion: 0,
    verification_status: 'unverified' as const,
    bio: null,
    marriage_goals: {},
    financial_readiness: {},
    lifestyle: {},
  };

  it('is 0 for a bare profile with no photos', () => {
    expect(computeProfileQuality(empty, 0)).toBe(0);
  });

  it('rewards photos, a real bio, and verification', () => {
    const v = computeProfileQuality(
      { ...empty, bio: 'a'.repeat(200), verification_status: 'verified', profile_completion: 100 },
      3,
    );
    // picture 100 + bio 100 + completion 100 + verification 100 + readiness(2/5=40) = 440/5 = 88
    expect(v).toBe(88);
  });
});

describe('profileQualitySuggestions', () => {
  it('suggests everything for a bare profile', () => {
    expect(
      profileQualitySuggestions({ education_level: null, bio: null, verification_status: 'unverified' }, 0),
    ).toEqual(['photo', 'verify', 'bio', 'education']);
  });

  it('suggests nothing once everything is filled', () => {
    expect(
      profileQualitySuggestions(
        { education_level: 'bachelor', bio: 'a'.repeat(150), verification_status: 'verified' },
        2,
      ),
    ).toEqual([]);
  });
});

describe('computeTrustScore', () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  it('is low for a brand-new, unverified, empty profile', () => {
    // verification 0 + completion 0 + conduct 100 (no violations) + age ~0 = 25
    expect(
      computeTrustScore({ profile_completion: 0, verification_status: 'unverified', created_at: daysAgo(0) }, 0),
    ).toBe(25);
  });

  it('is high for a verified, complete, violation-free, established account', () => {
    // verification 100 + completion 100 + conduct 100 + age 100 (90+ days) = 100
    expect(
      computeTrustScore({ profile_completion: 100, verification_status: 'verified', created_at: daysAgo(120) }, 0),
    ).toBe(100);
  });

  it('penalizes violations', () => {
    const base = { profile_completion: 100, verification_status: 'verified' as const, created_at: daysAgo(120) };
    expect(computeTrustScore(base, 1)).toBe(93); // conduct 70 instead of 100 -> (100+100+70+100)/4
    expect(computeTrustScore(base, 5)).toBe(78); // conduct 10 instead of 100 -> (100+100+10+100)/4
  });
});
