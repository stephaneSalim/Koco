export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  const voiceId = 'sf8Bpb1IU97NI9BHSMRf';

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true
        }
      })
    }
  );

  console.log('ElevenLabs TTS status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ElevenLabs error:', errorText);
    return res.status(response.status).json({ error: errorText });
  }

  const audioBuffer = await response.arrayBuffer();
  const base64Audio = Buffer.from(audioBuffer).toString('base64');
  res.json({ audio: base64Audio, format: 'mp3' });
}
