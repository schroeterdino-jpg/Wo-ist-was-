
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY fehlt in den Vercel-Umgebungsvariablen.' });
  }

  if (!text) {
    return res.status(400).json({ error: 'Kein Text zur Umwandlung übergeben.' });
  }

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'playai-tts',
        input: text,
        voice: 'Arista-PlayHT',
        response_format: 'mp3'
      })
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      return res.status(groqResponse.status).json({ error: errorText });
    }

    const audioBuffer = await groqResponse.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('Groq TTS Fehler:', error);
    return res.status(500).json({ error: 'Interner Serverfehler bei der Sprachgenerierung.' });
  }
}
