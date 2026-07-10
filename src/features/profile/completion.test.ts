import { describe, expect, it } from 'vitest';

import { computeCompletion } from '@/services/profileService';

const base = {
  display_name: null,
  dob: null,
  gender: null,
  country: null,
  city: null,
  nationality: null,
  languages: [] as string[],
  education_level: null,
  occupation: null,
  employment_status: null,
  bio: null,
  marriage_goals: {},
  lifestyle: {},
  family_values: {},
  financial_readiness: {},
};

describe('computeCompletion', () => {
  it('is 0 for an empty profile', () => {
    expect(computeCompletion(base)).toBe(0);
  });

  it('is 100 when every group is filled', () => {
    expect(
      computeCompletion({
        display_name: 'A',
        dob: '1996-01-01',
        gender: 'man',
        country: 'X',
        city: 'Y',
        nationality: 'Z',
        languages: ['ar'],
        education_level: 'bachelor',
        occupation: 'Engineer',
        employment_status: 'employed',
        bio: 'hello',
        marriage_goals: { timeline: 'within_year' },
        lifestyle: { religiosity: 'practicing' },
        family_values: { involvement: 'high' },
        financial_readiness: { savings: 'ready' },
      }),
    ).toBe(100);
  });

  it('ignores empty jsonb values', () => {
    expect(computeCompletion({ ...base, marriage_goals: { timeline: '' } })).toBe(0);
  });

  it('scales with partial completion', () => {
    const v = computeCompletion({ ...base, display_name: 'A', dob: '1996-01-01', gender: 'woman' });
    expect(v).toBe(20); // 3 of 15 checks
  });
});
