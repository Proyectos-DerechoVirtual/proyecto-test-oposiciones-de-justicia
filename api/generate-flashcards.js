import { GoogleGenAI } from '@google/genai';

// Configuración
const GEMINI_API_KEY = process.env.GEMINI_REPORTS_API_KEY;

// Handler principal
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Se requiere el prompt' });
    }

    console.log('🃏 Generando flashcards con Gemini...');

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.5,
        maxOutputTokens: 8000,
        responseMimeType: "application/json"
      }
    });

    // Obtener el texto de la respuesta
    let responseText = response.text;

    console.log('Respuesta raw (primeros 300 chars):', responseText.substring(0, 300));

    // Limpiar posibles bloques de código markdown
    responseText = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    // Parsear el JSON
    let flashcardsData;
    try {
      flashcardsData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Error parseando JSON directo:', parseError.message);
      console.log('Intentando extraer JSON del texto...');

      // Intentar encontrar el objeto JSON completo
      // Buscar desde el primer { hasta el último }
      const firstBrace = responseText.indexOf('{');
      const lastBrace = responseText.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonString = responseText.substring(firstBrace, lastBrace + 1);
        try {
          flashcardsData = JSON.parse(jsonString);
        } catch (e) {
          console.error('Error parseando JSON extraído:', e.message);

          // Último intento: buscar el array de flashcards directamente
          const arrayMatch = responseText.match(/"flashcards"\s*:\s*\[([\s\S]*?)\]/);
          if (arrayMatch) {
            try {
              const arrayContent = '[' + arrayMatch[1] + ']';
              const flashcardsArray = JSON.parse(arrayContent);
              flashcardsData = { flashcards: flashcardsArray };
            } catch (e2) {
              throw new Error('No se pudo parsear la respuesta como JSON válido');
            }
          } else {
            throw new Error('No se encontró el array de flashcards en la respuesta');
          }
        }
      } else {
        throw new Error('No se encontró estructura JSON válida en la respuesta');
      }
    }

    // Si Gemini devuelve un array directo [...], envolverlo en {flashcards: [...]}
    if (Array.isArray(flashcardsData)) {
      flashcardsData = { flashcards: flashcardsData };
    }

    if (!flashcardsData.flashcards || !Array.isArray(flashcardsData.flashcards)) {
      throw new Error('La respuesta no contiene un array de flashcards válido');
    }

    // Validar que cada flashcard tenga anverso y reverso
    const validFlashcards = flashcardsData.flashcards.filter(fc =>
      fc && typeof fc.anverso === 'string' && typeof fc.reverso === 'string'
    );

    if (validFlashcards.length === 0) {
      throw new Error('No se generaron flashcards válidas');
    }

    console.log(`✅ Generadas ${validFlashcards.length} flashcards válidas`);

    return res.status(200).json({
      success: true,
      flashcards: validFlashcards
    });

  } catch (error) {
    console.error('❌ Error generando flashcards:', error);
    return res.status(500).json({
      error: 'Error al generar flashcards',
      details: error.message
    });
  }
}
