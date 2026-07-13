import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Film, ImagePlus } from 'lucide-react';

import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';

interface MediaComposerProps {
  onSendImage: (file: File) => Promise<void>;
  disabled?: boolean;
}

/**
 * Family-stage attachments. Photos are checked by Claude's vision before they are
 * stored, so they behave like any other message.
 *
 * Video is deliberately absent from this release: no model can watch a video, so there
 * is no scalable way to moderate one, and shipping an unmoderated media channel is not
 * an option on this platform. The button stays visible but disabled and clearly marked,
 * rather than being hidden — people should know it's coming, not wonder if it's broken.
 */
export function MediaComposer({ onSendImage, disabled }: MediaComposerProps) {
  const { t } = useTranslation();
  const imageRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setNotice(null);
    try {
      await onSendImage(file);
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
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={imageRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <Button variant="outline" onClick={() => imageRef.current?.click()} disabled={disabled || busy}>
          <ImagePlus className="h-4 w-4" aria-hidden />
          {t('media.sendImage')}
        </Button>

        <span className="inline-flex items-center gap-2">
          <Button variant="outline" disabled title={t('media.videoSoon')}>
            <Film className="h-4 w-4" aria-hidden />
            {t('media.sendVideo')}
          </Button>
          <Badge variant="neutral">{t('common.comingSoon')}</Badge>
        </span>
      </div>

      <p className="px-1 text-xs text-faint">{t('media.reviewNote')}</p>
      {notice ? <p className="px-1 text-xs text-danger">{notice}</p> : null}
    </div>
  );
}
