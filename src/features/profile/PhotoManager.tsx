import { useRef, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ImagePlus, Loader2, Star, Trash2 } from 'lucide-react';

import { Alert } from '@/components/Alert';
import { Skeleton } from '@/components/Skeleton';
import { cn } from '@/utils/cn';
import { profileService, type ProfileRecord } from '@/services/profileService';
import { useSession } from '@/hooks/useSession';
import { useUpdateProfile } from '@/hooks/useProfile';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/** Manage the user's private profile photos (own storage folder + signed URLs). */
export function PhotoManager({ profile }: { profile: ProfileRecord | null }) {
  const { t } = useTranslation();
  const { user } = useSession();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const primaryPath = (profile?.privacy?.primaryPhoto as string | undefined) ?? undefined;

  const photosQuery = useQuery({
    queryKey: ['profile-photos', userId, primaryPath],
    enabled: Boolean(userId),
    queryFn: () => profileService.listPhotos(userId as string, primaryPath),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['profile-photos', userId] });

  const upload = useMutation({
    mutationFn: (file: File) => profileService.uploadPhoto(userId as string, file),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (path: string) => profileService.deletePhoto(path),
    onSuccess: (_data, path) => {
      if (path === primaryPath) {
        void updateProfile.mutateAsync({
          patch: { privacy: { ...profile?.privacy, primaryPhoto: null } },
          current: profile,
        });
      }
      invalidate();
    },
  });

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (!ALLOWED.includes(file.type)) return setError(t('profile.photos.errorType'));
    if (file.size > MAX_BYTES) return setError(t('profile.photos.errorSize'));
    upload.mutate(file);
  };

  const setPrimary = (path: string) =>
    updateProfile.mutate({
      patch: { privacy: { ...profile?.privacy, primaryPhoto: path } },
      current: profile,
    });

  const photos = photosQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      {error ? <Alert>{error}</Alert> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photosQuery.isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-xl" />
            ))
          : photos.map((photo) => (
              <div
                key={photo.path}
                className={cn(
                  'group bg-bg-3 relative aspect-square overflow-hidden rounded-xl border',
                  photo.isPrimary ? 'border-[color:var(--color-border-accent)]' : 'border-line',
                )}
              >
                <img src={photo.url} alt="" className="h-full w-full object-cover" />
                {photo.isPrimary ? (
                  <span className="bg-brand-600 text-on-brand absolute start-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                    {t('profile.photos.primary')}
                  </span>
                ) : null}
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                  {!photo.isPrimary ? (
                    <button
                      type="button"
                      onClick={() => setPrimary(photo.path)}
                      aria-label={t('profile.photos.makePrimary')}
                      className="grid h-8 w-8 place-items-center rounded-md bg-white/15 text-white backdrop-blur hover:bg-white/25"
                    >
                      <Star className="h-4 w-4" aria-hidden />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => remove.mutate(photo.path)}
                    aria-label={t('profile.photos.delete')}
                    className="hover:bg-danger/70 grid h-8 w-8 place-items-center rounded-md bg-white/15 text-white backdrop-blur"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            ))}

        {/* Upload tile */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="border-line-strong text-muted hover:text-brand-600 grid aspect-square place-items-center rounded-xl border border-dashed transition-colors hover:border-[color:var(--color-border-accent)]"
        >
          {upload.isPending ? (
            <Loader2 className="h-6 w-6 animate-[spin_0.7s_linear_infinite]" aria-hidden />
          ) : (
            <span className="flex flex-col items-center gap-1.5 text-xs font-medium">
              <ImagePlus className="h-6 w-6" aria-hidden />
              {t('profile.photos.add')}
            </span>
          )}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onPick}
      />
      <p className="text-muted text-xs">{t('profile.photos.hint')}</p>
    </div>
  );
}
