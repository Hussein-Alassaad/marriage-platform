import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, Send, Trash2 } from 'lucide-react';

import { Button } from '@/components/Button';
import { cn } from '@/utils/cn';
import { EASE_OUT } from '@/lib/motion';

interface VoiceRecorderProps {
  maxSeconds: number;
  disabled?: boolean;
  onSend: (audio: Blob, durationMs: number) => Promise<void>;
}

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Record → review → send. Nothing is uploaded until she chooses to send, and the
 * recording stops itself at the configured limit rather than failing on the server.
 */
export function VoiceRecorder({ maxSeconds, disabled, onSend }: VoiceRecorderProps) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState<{ blob: Blob; durationMs: number; url: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  // Release the mic and the object URL on unmount — a live mic is not a detail.
  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (clip) URL.revokeObjectURL(clip.url);
    };
  }, [clip]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType.split(';')[0] || 'audio/webm',
        });
        const durationMs = Date.now() - startedRef.current;
        stream.getTracks().forEach((track) => track.stop());
        setClip({ blob, durationMs, url: URL.createObjectURL(blob) });
        setRecording(false);
      };
      recorderRef.current = recorder;
      startedRef.current = Date.now();
      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = window.setInterval(() => {
        const seconds = (Date.now() - startedRef.current) / 1000;
        setElapsed(seconds);
        if (seconds >= maxSeconds) stop();
      }, 200);
    } catch {
      setError(t('voice.micDenied'));
    }
  };

  const stop = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const discard = () => {
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
    setElapsed(0);
  };

  const send = async () => {
    if (!clip) return;
    setSending(true);
    setError(null);
    try {
      await onSend(clip.blob, clip.durationMs);
      discard();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setError(
        message === 'voice_unavailable' || message === 'transcription_failed'
          ? t('voice.unavailable')
          : t('voice.sendError'),
      );
    } finally {
      setSending(false);
    }
  };

  // Review state: listen back, then send or throw it away.
  if (clip) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <audio src={clip.url} controls className="h-10 flex-1" />
          <Button
            variant="ghost"
            onClick={discard}
            disabled={sending}
            aria-label={t('voice.discard')}
            className="!px-3"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
          <Button onClick={send} disabled={sending} aria-label={t('voice.send')} className="!px-4">
            <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
          </Button>
        </div>
        {error ? <p className="text-danger px-1 text-xs">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button
          variant={recording ? 'destructive' : 'outline'}
          onClick={recording ? stop : start}
          disabled={disabled || sending}
          aria-label={recording ? t('voice.stop') : t('voice.record')}
          className="!px-4"
        >
          <Mic className="h-4 w-4" aria-hidden />
          {recording ? t('voice.stop') : t('voice.record')}
        </Button>

        <AnimatePresence>
          {recording ? (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="flex items-center gap-2"
            >
              <span className="bg-danger h-2 w-2 animate-pulse rounded-full" aria-hidden />
              <span className="text-ink font-mono text-sm tabular-nums">{mmss(elapsed)}</span>
              <span
                className={cn('text-xs', elapsed > maxSeconds - 15 ? 'text-danger' : 'text-faint')}
              >
                / {mmss(maxSeconds)}
              </span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      {error ? <p className="text-danger px-1 text-xs">{error}</p> : null}
    </div>
  );
}
