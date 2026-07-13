// Shared speech-to-text — a pluggable provider, because Claude has no audio input.
// Voice notes must be transcribed BEFORE they can be moderated (Part D: record →
// transcribe → moderate → deliver), so the platform needs one STT provider.
//
// Configure with Edge Function secrets (never in the frontend, never committed):
//   supabase secrets set STT_PROVIDER=openai   STT_API_KEY=sk-...
//   supabase secrets set STT_PROVIDER=deepgram STT_API_KEY=...
//   supabase secrets set STT_PROVIDER=custom   STT_API_KEY=... STT_URL=https://...
// Optional: STT_MODEL (defaults per provider).
//
// Until a provider is configured, `isConfigured()` is false and the voice sender
// refuses to store anything — an un-moderatable voice note must never be delivered.

import { secret } from './env.ts';

export interface SttConfig {
  provider: string;
  apiKey: string;
  model: string;
  url: string;
}

export function sttConfig(): SttConfig | null {
  const provider = (secret('STT_PROVIDER') ?? '').toLowerCase();
  const apiKey = secret('STT_API_KEY') ?? '';
  if (!provider || !apiKey) return null;

  if (provider === 'openai') {
    return {
      provider,
      apiKey,
      model: Deno.env.get('STT_MODEL') ?? 'whisper-1',
      url: Deno.env.get('STT_URL') ?? 'https://api.openai.com/v1/audio/transcriptions',
    };
  }
  if (provider === 'deepgram') {
    return {
      provider,
      apiKey,
      model: Deno.env.get('STT_MODEL') ?? 'nova-2',
      url: Deno.env.get('STT_URL') ?? 'https://api.deepgram.com/v1/listen',
    };
  }
  // `custom`: any endpoint that accepts the OpenAI multipart shape.
  const url = Deno.env.get('STT_URL');
  if (!url) return null;
  return { provider, apiKey, model: Deno.env.get('STT_MODEL') ?? '', url };
}

export const isConfigured = () => sttConfig() !== null;

/**
 * Transcribe an audio blob. Throws on any failure — the caller must fail closed
 * (no transcript ⇒ no moderation ⇒ the voice note is not delivered).
 */
export async function transcribe(audio: Blob, filename: string, language?: string): Promise<string> {
  const cfg = sttConfig();
  if (!cfg) throw new Error('stt_not_configured');

  if (cfg.provider === 'deepgram') {
    const params = new URLSearchParams({ model: cfg.model, smart_format: 'true' });
    if (language) params.set('language', language);
    const res = await fetch(`${cfg.url}?${params}`, {
      method: 'POST',
      headers: { Authorization: `Token ${cfg.apiKey}`, 'Content-Type': audio.type || 'audio/webm' },
      body: audio,
    });
    if (!res.ok) throw new Error(`stt_failed_${res.status}`);
    const data = await res.json();
    const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
    if (typeof transcript !== 'string') throw new Error('stt_no_transcript');
    return transcript.trim();
  }

  // openai / custom: multipart, OpenAI's transcription shape.
  const form = new FormData();
  form.append('file', audio, filename);
  if (cfg.model) form.append('model', cfg.model);
  if (language) form.append('language', language);
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`stt_failed_${res.status}`);
  const data = await res.json();
  const transcript = data?.text;
  if (typeof transcript !== 'string') throw new Error('stt_no_transcript');
  return transcript.trim();
}
