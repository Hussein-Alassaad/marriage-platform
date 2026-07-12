import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Film, ImagePlus } from 'lucide-react';

import { Button } from '@/components/Button';

interface MediaComposerProps {
  onSend: (file: File, kind: 'image' | 'video') => Promise<void>;
  disabled?: boolean;
}

/**
 * Family-stage attachments. Images are checked by the AI before they are stored;
 * videos are held for human review, so we tell the sender that up front rather than
 * letting them think it was delivered.
 */
export function MediaComposer({ onSend, disabled }: MediaComposerProps) {
  const { t } = useTranslation();
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const pick = async (file: File | undefined, kind: 'image' | 'video') => {
    if (!file) return;
    setBusy(true);
    setNotice(null);
    try {
      await onSend(file, kind);
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setNotice(
        message === 'too_large'
          ? t('media.tooLarge')
          : message === 'unsupported_type'
            ? t('media.unsupported')
            : t('media.sendError'),
      );
    } finally {
      setBusy(false);
      if (imageRef.current) imageRef.current.value = '';
      if (videoRef.current) videoRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          ref={imageRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0], 'image')}
        />
        <input
          ref={videoRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0], 'video')}
        />
        <Button variant="outline" onClick={() => imageRef.current?.click()} disabled={disabled || busy}>
          <ImagePlus className="h-4 w-4" aria-hidden />
          {t('media.sendImage')}
        </Button>
        <Button variant="outline" onClick={() => videoRef.current?.click()} disabled={disabled || busy}>
          <Film className="h-4 w-4" aria-hidden />
          {t('media.sendVideo')}
        </Button>
      </div>
      <p className="px-1 text-xs text-faint">{t('media.reviewNote')}</p>
      {notice ? <p className="px-1 text-xs text-danger">{notice}</p> : null}
    </div>
  );
}
