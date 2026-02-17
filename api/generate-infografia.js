const GEMINI_API_KEY = process.env.GEMINI_REPORTS_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Se requiere un prompt' });
    }

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'API key no configurada' });
    }

    console.log('🖼️ Generando infografía con Gemini...');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseModalities: ['IMAGE']
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Error de API: ${response.status} - ${errorData.error?.message || 'Error desconocido'}`);
    }

    const data = await response.json();

    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part) => part.inlineData);

    if (imagePart && imagePart.inlineData) {
      console.log('🖼️ Infografía generada correctamente');
      return res.status(200).json({
        success: true,
        imageBase64: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || 'image/png',
      });
    } else {
      throw new Error('No se pudo generar la imagen');
    }

  } catch (error) {
    console.error('❌ Error generando infografía:', error);
    return res.status(500).json({
      error: 'Error al generar la infografía',
      details: error.message
    });
  }
}
