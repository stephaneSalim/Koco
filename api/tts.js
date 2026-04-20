export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { text } = req.body;
  const response = await fetch(
    'https://api.elevenlabs.io/v1/text-to-speech/sf8Bpb1IU97NI9BHSMRf',
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    }
  );
  console.log('TTS status:', response.status);
  const audioBuffer = await response.arrayBuffer();
  res.setHeader('Content-Type', 'audio/mpeg');
  res.send(Buffer.from(audioBuffer));
}
