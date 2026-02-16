import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_REPORTS_API_KEY;

const getFirstName = (fullName) => {
  if (!fullName) return '';
  const firstName = fullName.trim().split(/\s+/)[0];
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
};

// Paso 1: Generar guion con Gemini
async function generateAudioScript(questions, userName) {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const nameToUse = getFirstName(userName);
  const personalTouch = nameToUse ? `Te diriges a ${nameToUse}.` : '';

  const questionsText = questions.map((q, i) =>
    `${i + 1}. ${q.question} | Alumno: ${q.userAnswer} | Correcta: ${q.correctAnswer}`
  ).join('\n');

  const prompt = `Eres un profesor de Derecho en España, cercano y majo, con acento y expresiones 100% de español peninsular.
Genera un guion breve (~250 palabras) para audio. ${personalTouch}

INSTRUCCIONES DE ESTILO:
- Habla SIEMPRE de TÚ, nunca de usted.
- Usa expresiones naturales españolas: "vale", "mira", "fíjate", "a ver", "venga", "oye", "vamos a ver", "ojo con esto", "que no se te olvide", "esto es clave", "¿vale?", "pues nada".
- Usa muletillas típicas: "bueno", "pues", "hombre/mujer", "en fin".
- NO uses expresiones latinoamericanas (nada de "dale", "listo", "chévere", "acá", "ustedes").
- Pronunciación española: usa "vosotros/as" si te refieres a un grupo, "z" y "c" como /θ/ (no importa en texto, pero el tono debe ser peninsular).
- Tono: como si estuvieras en una tutoría informal en la facultad, animando al alumno.
- Sin markdown, texto plano para leer en voz alta.
- Saludo breve y natural, explica cada fallo con la corrección de forma clara, y cierre motivador.
- No cites artículos de ley si no estás completamente seguro del número exacto.

Fallos del alumno:
${questionsText}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });

  return response.text;
}

// Paso 2: Convertir texto a audio con Gemini TTS
async function textToSpeech(script) {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: script,
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Orus',
          },
        },
      },
    },
  });

  const audioPart = response.candidates[0].content.parts[0];
  const pcmBase64 = audioPart.inlineData.data;
  const pcmBuffer = Buffer.from(pcmBase64, 'base64');

  return pcmToWav(pcmBuffer, 24000, 1, 16);
}

// Paso 3: Convertir PCM a WAV (agregar header)
function pcmToWav(pcmBuffer, sampleRate, numChannels, bitsPerSample) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const header = Buffer.alloc(headerSize);

  // RIFF header
  header.write('RIFF', 0);
  header.writeUInt32LE(totalSize - 8, 4);
  header.write('WAVE', 8);

  // fmt chunk
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// Handler principal
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { questions, userName } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de preguntas' });
    }

    // Limitar a 3 preguntas para que el audio no sea muy largo
    const limitedQuestions = questions.slice(0, 3);

    console.log(`🎙️ Generando audio para ${limitedQuestions.length} errores...`);

    // Paso 1: Generar guion
    console.log('📝 Generando guion con Gemini...');
    const script = await generateAudioScript(limitedQuestions, userName);
    console.log(`📝 Guion generado: ${script.length} caracteres`);

    // Paso 2: Convertir a audio
    console.log('🔊 Convirtiendo a audio con TTS...');
    const wavBuffer = await textToSpeech(script);
    console.log(`🔊 Audio generado: ${wavBuffer.length} bytes`);

    // Paso 3: Devolver como base64
    const audioBase64 = wavBuffer.toString('base64');

    return res.status(200).json({
      success: true,
      audioBase64: `data:audio/wav;base64,${audioBase64}`,
      questionsAnalyzed: limitedQuestions.length,
    });

  } catch (error) {
    console.error('❌ Error generando audio:', error);
    return res.status(500).json({
      error: 'Error al generar el audio',
      details: error.message
    });
  }
}
