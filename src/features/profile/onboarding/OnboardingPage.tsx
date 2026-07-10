import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { FormField } from '@/components/FormField';
import { Alert } from '@/components/Alert';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { OptionSelect, LanguagesField } from '@/features/profile/ProfileFields';
import { PhotoManager } from '@/features/profile/PhotoManager';
import { cn } from '@/utils/cn';
import { EASE_EXPO } from '@/lib/motion';
import { ROUTES } from '@/app/routes';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { useSettings } from '@/hooks/useSettings';
import type { JsonMap, ProfilePatch, ProfileRecord } from '@/services/profileService';

interface FormState {
  display_name: string;
  dob: string;
  gender: string;
  nationality: string;
  country: string;
  city: string;
  languages: string[];
  education_level: string;
  university: string;
  major: string;
  graduation_year: string;
  occupation: string;
  industry: string;
  employment_status: string;
  mg_timeline: string;
  mg_children: string;
  mg_relocate: string;
  ls_religiosity: string;
  ls_smoking: string;
  fv_involvement: string;
  fr_savings: string;
  bio: string;
  photo_privacy_mode: string;
}

const EMPTY: FormState = {
  display_name: '', dob: '', gender: '', nationality: '', country: '', city: '', languages: [],
  education_level: '', university: '', major: '', graduation_year: '', occupation: '', industry: '',
  employment_status: '', mg_timeline: '', mg_children: '', mg_relocate: '', ls_religiosity: '',
  ls_smoking: '', fv_involvement: '', fr_savings: '', bio: '', photo_privacy_mode: '2',
};

function fromProfile(p: ProfileRecord): FormState {
  const s = (v: unknown) => (v == null ? '' : String(v));
  const j = (m: JsonMap, k: string) => (m && m[k] ? m[k] : '');
  return {
    display_name: s(p.display_name), dob: s(p.dob), gender: s(p.gender), nationality: s(p.nationality),
    country: s(p.country), city: s(p.city), languages: p.languages ?? [],
    education_level: s(p.education_level), university: s(p.university), major: s(p.major),
    graduation_year: s(p.graduation_year), occupation: s(p.occupation), industry: s(p.industry),
    employment_status: s(p.employment_status),
    mg_timeline: j(p.marriage_goals, 'timeline'), mg_children: j(p.marriage_goals, 'children'),
    mg_relocate: j(p.marriage_goals, 'relocate'), ls_religiosity: j(p.lifestyle, 'religiosity'),
    ls_smoking: j(p.lifestyle, 'smoking'), fv_involvement: j(p.family_values, 'involvement'),
    fr_savings: j(p.financial_readiness, 'savings'), bio: s(p.bio),
    photo_privacy_mode: s(p.photo_privacy_mode || 2),
  };
}

const clean = (m: JsonMap): JsonMap => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== ''));

function toPatch(f: FormState, lockedGender: boolean): ProfilePatch {
  const patch: ProfilePatch = {
    display_name: f.display_name || null,
    nationality: f.nationality || null,
    country: f.country || null,
    city: f.city || null,
    languages: f.languages,
    education_level: f.education_level || null,
    university: f.university || null,
    major: f.major || null,
    graduation_year: f.graduation_year ? Number(f.graduation_year) : null,
    occupation: f.occupation || null,
    industry: f.industry || null,
    employment_status: f.employment_status || null,
    marriage_goals: clean({ timeline: f.mg_timeline, children: f.mg_children, relocate: f.mg_relocate }),
    lifestyle: clean({ religiosity: f.ls_religiosity, smoking: f.ls_smoking }),
    family_values: clean({ involvement: f.fv_involvement }),
    financial_readiness: clean({ savings: f.fr_savings }),
    bio: f.bio || null,
    photo_privacy_mode: Number(f.photo_privacy_mode) || 2,
  };
  // Never send gender/dob when already set (gender may be locked; dob immutable UX).
  if (!lockedGender && f.gender) patch.gender = f.gender as 'man' | 'woman';
  if (f.dob) patch.dob = f.dob;
  return patch;
}

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { number } = useSettings();
  const minAge = number('min_age', 18);
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [initialized, setInitialized] = useState(false);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !initialized) {
      setForm(fromProfile(profile));
      setInitialized(true);
    }
  }, [profile, initialized]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const genderSet = Boolean(profile?.gender);
  const dobSet = Boolean(profile?.dob);
  const rtl = typeof document !== 'undefined' && document.dir === 'rtl';

  const steps = useMemo(
    () => [
      { key: 'basics', title: t('onboarding.steps.basics') },
      { key: 'background', title: t('onboarding.steps.background') },
      { key: 'goals', title: t('onboarding.steps.goals') },
      { key: 'values', title: t('onboarding.steps.values') },
      { key: 'about', title: t('onboarding.steps.about') },
      { key: 'photos', title: t('onboarding.steps.photos') },
    ],
    [t],
  );

  const validateBasics = (): string | null => {
    if (form.display_name.trim().length < 2) return t('validation.displayName');
    if (!genderSet && !form.gender) return t('validation.gender');
    if (!dobSet) {
      if (!form.dob) return t('validation.required');
      const age = Math.floor((Date.now() - new Date(form.dob).getTime()) / (365.25 * 864e5));
      if (age < minAge) return t('validation.minAge', { minAge });
    }
    return null;
  };

  const persist = async () => {
    if (!profile) return true;
    try {
      setError(null);
      await updateProfile.mutateAsync({ patch: toPatch(form, genderSet), current: profile });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const next = async () => {
    if (step === 0) {
      const v = validateBasics();
      if (v) return setError(v);
    }
    if (!(await persist())) return;
    if (step === steps.length - 1) {
      navigate(ROUTES.profile, { replace: true });
      return;
    }
    setDir(1);
    setStep((s) => s + 1);
  };

  const back = () => {
    setError(null);
    setDir(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  if (isLoading || !initialized) return <FullScreenLoader />;

  const slide = 40 * (rtl ? -1 : 1);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">{t('onboarding.eyebrow')}</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">{steps[step].title}</h1>
        <div className="mt-4 flex items-center gap-2">
          {steps.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i === step ? 'w-6 bg-brand-500' : i < step ? 'w-2 bg-brand-400' : 'w-2 bg-line-strong',
              )}
            />
          ))}
        </div>
      </div>

      <Card>
        {error ? (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        ) : null}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: dir * slide }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -slide }}
            transition={{ duration: 0.28, ease: EASE_EXPO }}
            className="flex flex-col gap-4"
          >
            {step === 0 ? (
              <>
                <FormField label={t('profile.fields.displayName')} htmlFor="display_name">
                  <Input id="display_name" value={form.display_name} onChange={(e) => set('display_name', e.target.value)} />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label={t('profile.fields.gender')} htmlFor="gender">
                    {genderSet ? (
                      <Input id="gender" value={t(`gender.${form.gender}`)} readOnly disabled />
                    ) : (
                      <OptionSelectGender value={form.gender} onChange={(v) => set('gender', v)} />
                    )}
                  </FormField>
                  <FormField label={t('profile.fields.dob')} htmlFor="dob">
                    <Input id="dob" type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} readOnly={dobSet} disabled={dobSet} />
                  </FormField>
                </div>
                {genderSet ? <p className="text-xs text-muted">{t('profile.genderLockedNote')}</p> : null}
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField label={t('profile.fields.nationality')} htmlFor="nationality">
                    <Input id="nationality" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
                  </FormField>
                  <FormField label={t('profile.fields.country')} htmlFor="country">
                    <Input id="country" value={form.country} onChange={(e) => set('country', e.target.value)} />
                  </FormField>
                  <FormField label={t('profile.fields.city')} htmlFor="city">
                    <Input id="city" value={form.city} onChange={(e) => set('city', e.target.value)} />
                  </FormField>
                </div>
                <FormField label={t('profile.fields.languages')} htmlFor="languages">
                  <LanguagesField value={form.languages} onChange={(v) => set('languages', v)} />
                </FormField>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label={t('profile.fields.educationLevel')} htmlFor="education_level">
                    <OptionSelect id="education_level" group="education" value={form.education_level} onChange={(v) => set('education_level', v)} />
                  </FormField>
                  <FormField label={t('profile.fields.graduationYear')} htmlFor="graduation_year">
                    <Input id="graduation_year" type="number" inputMode="numeric" value={form.graduation_year} onChange={(e) => set('graduation_year', e.target.value)} />
                  </FormField>
                  <FormField label={t('profile.fields.university')} htmlFor="university">
                    <Input id="university" value={form.university} onChange={(e) => set('university', e.target.value)} />
                  </FormField>
                  <FormField label={t('profile.fields.major')} htmlFor="major">
                    <Input id="major" value={form.major} onChange={(e) => set('major', e.target.value)} />
                  </FormField>
                  <FormField label={t('profile.fields.occupation')} htmlFor="occupation">
                    <Input id="occupation" value={form.occupation} onChange={(e) => set('occupation', e.target.value)} />
                  </FormField>
                  <FormField label={t('profile.fields.industry')} htmlFor="industry">
                    <Input id="industry" value={form.industry} onChange={(e) => set('industry', e.target.value)} />
                  </FormField>
                  <FormField label={t('profile.fields.employmentStatus')} htmlFor="employment_status">
                    <OptionSelect id="employment_status" group="employment" value={form.employment_status} onChange={(v) => set('employment_status', v)} />
                  </FormField>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={t('profile.fields.timeline')} htmlFor="mg_timeline">
                  <OptionSelect id="mg_timeline" group="timeline" value={form.mg_timeline} onChange={(v) => set('mg_timeline', v)} />
                </FormField>
                <FormField label={t('profile.fields.children')} htmlFor="mg_children">
                  <OptionSelect id="mg_children" group="children" value={form.mg_children} onChange={(v) => set('mg_children', v)} />
                </FormField>
                <FormField label={t('profile.fields.relocate')} htmlFor="mg_relocate">
                  <OptionSelect id="mg_relocate" group="relocate" value={form.mg_relocate} onChange={(v) => set('mg_relocate', v)} />
                </FormField>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={t('profile.fields.religiosity')} htmlFor="ls_religiosity">
                  <OptionSelect id="ls_religiosity" group="religiosity" value={form.ls_religiosity} onChange={(v) => set('ls_religiosity', v)} />
                </FormField>
                <FormField label={t('profile.fields.smoking')} htmlFor="ls_smoking">
                  <OptionSelect id="ls_smoking" group="smoking" value={form.ls_smoking} onChange={(v) => set('ls_smoking', v)} />
                </FormField>
                <FormField label={t('profile.fields.familyInvolvement')} htmlFor="fv_involvement">
                  <OptionSelect id="fv_involvement" group="family" value={form.fv_involvement} onChange={(v) => set('fv_involvement', v)} />
                </FormField>
                <FormField label={t('profile.fields.savings')} htmlFor="fr_savings">
                  <OptionSelect id="fr_savings" group="savings" value={form.fr_savings} onChange={(v) => set('fr_savings', v)} />
                </FormField>
              </div>
            ) : null}

            {step === 4 ? (
              <FormField label={t('profile.fields.bio')} htmlFor="bio">
                <textarea
                  id="bio"
                  value={form.bio}
                  onChange={(e) => set('bio', e.target.value)}
                  rows={6}
                  maxLength={600}
                  className="w-full rounded-md border border-line bg-surface p-3.5 text-[15px] text-ink placeholder:text-faint focus-visible:border-brand-400 focus-visible:outline-none focus-visible:[box-shadow:0_0_0_3px_rgba(52,211,153,0.15)]"
                  placeholder={t('profile.fields.bioPlaceholder')}
                />
              </FormField>
            ) : null}

            {step === 5 ? (
              <div className="flex flex-col gap-5">
                <PhotoManager profile={profile ?? null} />
                <FormField label={t('profile.fields.photoPrivacy')} htmlFor="photo_privacy_mode">
                  <OptionSelect id="photo_privacy_mode" group="photoPrivacy" value={form.photo_privacy_mode} onChange={(v) => set('photo_privacy_mode', v)} />
                </FormField>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={back} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
            {t('common.back')}
          </Button>
          <Button onClick={next} disabled={updateProfile.isPending}>
            {step === steps.length - 1 ? (
              <>
                {t('onboarding.finish')}
                <Check className="h-4 w-4" aria-hidden />
              </>
            ) : (
              <>
                {t('common.next')}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** Gender select (only shown before verification locks it). */
function OptionSelectGender({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <Select id="gender" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('page.register.genderPlaceholder')}</option>
      <option value="man">{t('gender.man')}</option>
      <option value="woman">{t('gender.woman')}</option>
    </Select>
  );
}
