export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { audioBase64, mimeType } = req.body;
  if (!audioBase64) return res.status(400).json({ error: 'audioBase64 required' });

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

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ElevenLabs STT error:', errorText);
    return res.status(response.status).json({ error: errorText });
  }

  const data = await response.json();
  res.json({ text: data.text || '' });
}
