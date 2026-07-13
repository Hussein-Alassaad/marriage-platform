// Reading secrets defensively.
//
// A secret pasted into a shell or an .env file very often arrives with surrounding
// quotes ("sk-ant-…") or a trailing newline, and the Anthropic API then rejects it
// with a 401 "invalid x-api-key" that looks exactly like a wrong key. Strip that noise
// so a paste artefact can't masquerade as a bad credential.

export function secret(name: string): string | undefined {
  const raw = Deno.env.get(name);
  if (!raw) return undefined;
  const cleaned = raw.trim().replace(/^['"]|['"]$/g, '').trim();
  return cleaned.length ? cleaned : undefined;
}
