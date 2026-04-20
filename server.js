const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Middleware to verify Supabase authentication
async function verifyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token d\'authentification manquant' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // For now, we'll trust the client token since Supabase handles JWT validation
    // In production, you should validate the JWT properly
    req.user = { token }; // You can decode and verify the JWT here

    next();
  } catch (error) {
    console.error('Erreur de vérification auth:', error);
    res.status(401).json({ error: 'Token invalide' });
  }
}

app.post('/api/chat', verifyAuth, async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Erreur proxy:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Aucun texte fourni' });
    }

    const response = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM',
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
            similarity_boost: 0.75
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs TTS error:', response.status, errorText);
      return res.status(response.status).json({ error: 'Erreur ElevenLabs TTS', details: errorText });
    }

    const audioBuffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    console.error('Erreur TTS proxy :', error);
    res.status(500).json({ error: 'Erreur serveur TTS' });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy lancé sur http://localhost:${PORT}`);
});

module.exports = app;