import { requireUser, consumeQuota } from './_lib/auth.js';

const MAX_AUDIO_BASE64 = 4 * 1024 * 1024; // ~3 Mo d'audio, limite du body Vercel

export default async function handler(req, res) {
  const ctx = await requireUser(req, res);
  if (!ctx) return;

  const { audioBase64, mimeType } = req.body;
  if (!audioBase64) return res.status(400).json({ error: 'audioBase64 required' });
  if (audioBase64.length > MAX_AUDIO_BASE64) return res.status(413).json({ error: 'audio too long' });

  if (!(await consumeQuota(ctx, res, 'stt'))) return;

  const buffer = Buffer.from(audioBase64, 'base64');
  const blob = new Blob([buffer], { type: mimeType || 'audio/webm' });

  const formData = new FormData();
  formData.append('file', blob, 'audio.webm');
  formData.append('model_id', 'scribe_v1');
  formData.append('language_code', 'ko');


  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
    body: formData
  });

  console.log('ElevenLabs STT status:', response.status);
  const responseText = await response.text();

  if (!response.ok) {
    return res.status(response.status).json({ error: responseText });
  }

  const data = JSON.parse(responseText);
  res.json({ text: data.text || '' });
}
