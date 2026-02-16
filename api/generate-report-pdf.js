import { GoogleGenAI } from '@google/genai';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import nodemailer from 'nodemailer';

// Configuración
const GEMINI_API_KEY = process.env.GEMINI_REPORTS_API_KEY;

// Función para extraer solo el primer nombre
const getFirstName = (fullName) => {
  if (!fullName) return '';
  // Tomar solo la primera palabra y capitalizar
  const firstName = fullName.trim().split(/\s+/)[0];
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
};

// Función para generar el prompt personalizado con el nombre del alumno
const getReportPrompt = (studentName) => {
  const nameToUse = getFirstName(studentName);
  const personalTouch = nameToUse ? `El estudiante se llama ${nameToUse}. Usa su nombre de vez en cuando para conectar mejor (no en cada párrafo, pero sí ocasionalmente, por ejemplo: "${nameToUse}, aquí está el problema..." o "${nameToUse}, recuerda que...").` : '';

  return `Eres un agente de inteligencia artificial especializado en la creación de apuntes de estudio para opositores (especialmente de Gestión Procesal y Administrativa) que han realizado un examen tipo test (o preguntas cortas) y han cometido errores.

${personalTouch}

Tu misión es convertir cada fallo del opositor en apuntes reutilizables, claros, rigurosos y orientados a examen, explicando:

- Por qué ha fallado (confusión típica de test).
- Cuál es la respuesta correcta.
- Qué artículo(s) exacto(s) lo fundamentan (con extracto literal relevante).
- Cómo evitar caer en ese error en el futuro.

Queda expresamente prohibido mencionar el origen de la información con expresiones tipo "según el manual", "en los apuntes", "lo dice el manual", etc.

PRINCIPIO CLAVE (OPOSITOR)

En oposición te exigen el detalle: artículo, inciso y literal.

Por tanto, en cada fallo debes llegar a Norma + Artículo(s) + Extracto literal relevante, y después desmenuzarlo.

METODOLOGÍA DE TRABAJO

1) Análisis previo

Para cada bloque de preguntas:

- Identifica la asignatura/materia (Procesal/Administrativo/Constitucional, etc.).
- Identifica el tema/bloque (p. ej. Proceso declarativo, Recursos, Acto administrativo, Jurisdicción, Ejecución, etc.).
- Identifica el núcleo del error (concepto exacto que preguntaban).

2) Prioridad de fuentes

Activa MODO BÚSQUEDA NORMATIVA con este protocolo obligatorio:

- Identifica la norma aplicable y el artículo probable según la pregunta.
- Localiza el artículo y el fragmento relevante.
- Validación obligatoria: antes de incluir el literal, verifica que está vigente.
- Solo incluye el literal si está verificado.
- Si no puedes verificar literalidad, hay dudas de reforma o redacción: escribe "revisar" y NO inventes el texto.

Regla adicional: en el documento final NO menciones fuentes externas, ni "manuales"; solo "Norma + artículo(s)" y el "Extracto literal relevante".

REGLAS DE SEGURIDAD (OBLIGATORIAS)

- Prohibido inventar artículos, incisos, literales, sentencias o doctrina.
- Si hay duda sobre un extremo concreto o no puedes garantizar exactitud/vigencia: escribe "revisar".
- El resultado final debe ser un documento de estudio reutilizable, no una simple corrección.

ESTRUCTURA OBLIGATORIA DEL DOCUMENTO

1) TÍTULO GENERAL

Formato obligatorio:
Apuntes de [ASIGNATURA/OPOSICIÓN] – [TEMA o MATERIA PRINCIPAL] (Puntos clave)

Ejemplo:
Apuntes de Procesal (Gestión Procesal) – Proceso Declarativo (Puntos clave)

2) DESARROLLO POR FALLOS

El contenido se estructura exclusivamente en función de los errores del opositor.

FALLO 1

📌 Fallaste en: [concepto jurídico concreto + qué estaban preguntando realmente]

1) Explicación del error

Explica con claridad:

- Qué respondió el opositor (opción elegida).
- Por qué esa respuesta es incorrecta en clave test.
- Qué confusión conceptual hubo (trampa típica: excepción, plazo, órgano competente, legitimación, requisito vs efecto, etc.).

(El tono puede ser técnico o ligeramente coloquial si ayuda a entenderlo "en castellano claro", sin perder rigor.)

2) Base normativa exacta (OBLIGATORIA)

Incluye siempre este bloque:

Artículo(s) aplicable(s): [Norma + artículo(s)]

Extracto literal relevante:
"[…]"
"[…]"

Reglas:

- El literal debe venir de búsqueda y estar verificado con fuente oficial vigente.
- Si no puedes garantizar literalidad o vigencia: revisar.

3) Explicación correcta (desmenuzada para oposición)

Desarrolla el concepto correcto con enfoque test:

- Definición precisa.
- Elementos/requisitos (numerados si procede).
- Consecuencias/efectos.
- Diferencias con conceptos similares que suelen confundir.
- Señales de "pregunta trampa" (cómo lo retuercen, qué palabra cambia el sentido, etc.).

4) ¿Cómo evitar este fallo en el futuro?

Formato obligatorio:

Cómo no volver a fallar esto:

- Claves típicas de examen.
- Trampas frecuentes.
- Detalles en los que el tribunal suele pillar (plazo exacto, órgano exacto, excepción oculta, cómputo, etc.).

Frase fija obligatoria cuando proceda:
"Apúntate esto a fuego:" [frase corta y contundente para memorizar]

5) Ejemplo práctico (OBLIGATORIO)

Mini-historia (entre 3 y 10 líneas):

- Lenguaje cercano y comprensible.
- Situación realista o típica de examen.
- Debe reflejar la trampa o el matiz clave.

6) Regla memorística

Incluye una:

- Regla mnemotécnica / frase corta / asociación mental.
- Debe ayudar a recordar el concepto y, si procede, el artículo.

7) Tabla explicativa (cuando proceda)

Cuando el concepto lo permita, incluye una tabla clara y visual. Ejemplos:

- Requisitos vs efectos
- Regla general vs excepción
- Diferencias entre instituciones
- Órgano competente según supuesto
- Plazos (inicio, cómputo, fin)

FALLO 2, FALLO 3, etc.

(Repite exactamente la misma estructura)

ESTILO Y CALIDAD

- Lenguaje jurídico claro, didáctico y orientado a aprobar test.
- Precisión máxima en artículos y literales.
- Nada de relleno: cada fallo debe dejar una idea memorizable + una trampa detectada + una regla para no caer.

FORMATO DE SALIDA:

- Genera SOLO el contenido HTML puro, sin bloques de código markdown
- NO incluyas \`\`\`html ni \`\`\` al principio o final
- Usa estilos inline profesionales
- Colores sobrios (#1a365d para títulos, #f39c12 para destacados, #8b4513 para fallos)
- Estructura clara y legible`;
};

// Función para limpiar el HTML de bloques de código markdown
function cleanHtmlContent(html) {
  if (!html) return '';

  // Eliminar bloques de código markdown al inicio y final
  let cleaned = html
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // También eliminar si está en medio del contenido
  cleaned = cleaned.replace(/```html/gi, '').replace(/```/g, '');

  return cleaned;
}

// Función para generar contenido con Gemini
async function generateReportContent(questions, studentName) {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // Formatear las preguntas para el prompt
  const questionsText = questions.map((q, i) => {
    return `
PREGUNTA ${i + 1}:
${q.question}

Opciones:
${q.options.map((opt, j) => `${String.fromCharCode(65 + j)}) ${opt}`).join('\n')}

Tu respuesta: ${q.userAnswer}
Respuesta correcta: ${q.correctAnswer}
${q.userAnswer !== q.correctAnswer ? '❌ INCORRECTA' : '✅ CORRECTA'}
`;
  }).join('\n---\n');

  const userPrompt = `Analiza los siguientes errores y genera un informe de estudio personalizado:

${questionsText}

Genera el informe en HTML puro con estilos inline (sin bloques de código markdown). Solo incluye los fallos (preguntas incorrectas).`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: userPrompt,
    config: {
      systemInstruction: getReportPrompt(studentName),
      temperature: 0.7,
      maxOutputTokens: 16000
    }
  });

  // Limpiar el HTML de posibles bloques de código markdown
  return cleanHtmlContent(response.text);
}

// Función para convertir HTML a PDF
async function htmlToPdf(htmlContent) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  const page = await browser.newPage();

  // Envolver el contenido en un documento HTML completo con formato profesional
  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {
      margin: 2.5cm 2cm 3cm 2cm;
      @bottom-center {
        content: "Página " counter(page);
        font-family: Georgia, serif;
        font-size: 10px;
        color: #666;
      }
    }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      line-height: 1.8;
      color: #333;
      font-size: 11pt;
    }

    /* Header con título y logo */
    .document-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #1a365d;
    }
    .document-header .header-logo {
      width: 45px;
      height: auto;
    }
    .document-header h1 {
      color: #1a365d;
      font-size: 20pt;
      margin: 0;
      font-weight: normal;
    }

    /* Títulos */
    h1 { color: #1a365d; font-size: 18pt; margin-top: 25px; }
    h2 { color: #1a365d; font-size: 14pt; margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
    h3 { color: #2c5282; font-size: 12pt; margin-top: 15px; }

    /* Fallo header - destacado */
    .fallo-header, [class*="fallo"] {
      background: linear-gradient(135deg, #f8f4e8 0%, #f5f0e0 100%);
      padding: 15px 20px;
      border-left: 4px solid #8b4513;
      border-radius: 0 8px 8px 0;
      margin: 25px 0 15px 0;
      page-break-inside: avoid;
    }
    .fallo-header h2, [class*="fallo"] h2 {
      color: #8b4513;
      margin: 0;
      border: none;
    }

    /* Secciones de contenido */
    .explicacion-error {
      background: #fef9f9;
      padding: 15px;
      border-radius: 5px;
      margin: 10px 0;
      border-left: 3px solid #dc3545;
    }

    .explicacion-correcta {
      background: #f8fdf8;
      padding: 15px;
      border-radius: 5px;
      margin: 10px 0;
      border-left: 3px solid #28a745;
    }

    .como-evitar {
      background: #fff8e6;
      padding: 15px;
      border-radius: 5px;
      margin: 10px 0;
      border-left: 3px solid #ffc107;
    }

    .ejemplo-practico {
      background: #e8f4fd;
      padding: 15px;
      border-radius: 8px;
      margin: 15px 0;
      font-style: italic;
      border: 1px solid #b8daff;
    }

    .regla-memoria, .regla-memoristica {
      background: #d4edda;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #28a745;
      margin: 15px 0;
      font-weight: 500;
    }

    .apuntate {
      background: #8b4513;
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      font-weight: bold;
      display: inline-block;
      margin: 10px 0;
    }

    /* Base normativa */
    .base-normativa {
      background: #f0f4f8;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #1a365d;
      margin: 15px 0;
    }

    blockquote {
      background: #f9f9f9;
      border-left: 4px solid #1a365d;
      padding: 10px 15px;
      margin: 10px 0;
      font-style: italic;
      color: #555;
    }

    /* Palabras clave */
    .keyword, strong {
      font-weight: bold;
    }

    .keyword-critical {
      font-weight: bold;
      color: #8b0000;
      background: #fff0f0;
      padding: 1px 4px;
      border-radius: 3px;
    }

    /* Tablas */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 10px;
      text-align: left;
    }
    th {
      background: #1a365d;
      color: white;
      font-weight: normal;
    }
    tr:nth-child(even) { background: #f9f9f9; }

    /* Evitar viudas y huérfanos */
    h1, h2, h3, h4 {
      page-break-after: avoid;
    }
    p {
      orphans: 3;
      widows: 3;
    }
    .fallo-header, .ejemplo-practico, .regla-memoria {
      page-break-inside: avoid;
    }

    /* Listas */
    ul, ol {
      margin: 10px 0;
      padding-left: 25px;
    }
    li {
      margin: 5px 0;
    }

    /* Footer del documento */
    .document-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #666;
      font-size: 10pt;
    }
  </style>
</head>
<body>
  <!-- Header con logo y título -->
  <div class="document-header">
    <img src="https://test-oposiciones-justicia.vercel.app/logo-empresa.png" alt="Test Oposiciones" class="header-logo">
    <h1>Informe de Estudio Personalizado</h1>
  </div>

  ${htmlContent}

  <div class="document-footer">
    <p>Informe de Estudio Personalizado · Test de Oposiciones de Justicia</p>
  </div>
</body>
</html>`;

  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '2cm', right: '2cm', bottom: '2cm', left: '2cm' }
  });

  await browser.close();

  return pdfBuffer;
}

// Función para enviar email con PDF
async function sendEmailWithPdf(to, pdfBuffer, userName) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Test Oposiciones" <${process.env.SMTP_USER}>`,
    to: to,
    subject: '📚 Tu Informe de Estudio Personalizado - Test de Oposiciones',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a365d; text-align: center;">📚 Informe de Estudio</h1>
        <p style="color: #333; font-size: 16px;">
          Hola${userName ? ` ${userName}` : ''},
        </p>
        <p style="color: #333; font-size: 16px;">
          Hemos generado tu informe personalizado basado en los errores de tu último test.
          Este documento incluye:
        </p>
        <ul style="color: #333; font-size: 14px;">
          <li>📌 Análisis detallado de cada error</li>
          <li>📖 Base normativa exacta (artículos y extractos literales)</li>
          <li>✅ Explicación correcta desmenuzada para oposición</li>
          <li>⚠️ Cómo evitar este fallo en el futuro (trampas típicas)</li>
          <li>💡 Ejemplos prácticos y reglas memorísticas</li>
        </ul>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          ¡Mucho ánimo con tu preparación! 💪
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">
          Este email fue enviado desde Test de Oposiciones de Justicia
        </p>
      </div>
    `,
    attachments: [
      {
        filename: 'informe-estudio.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

// Handler principal
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { questions, userEmail, userName } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de preguntas' });
    }

    if (!userEmail) {
      return res.status(400).json({ error: 'Se requiere el email del usuario' });
    }

    // Filtrar solo las preguntas incorrectas (máximo 5 para evitar timeout)
    const incorrectQuestions = questions
      .filter(q => q.userAnswer !== q.correctAnswer)
      .slice(0, 5);

    if (incorrectQuestions.length === 0) {
      return res.status(400).json({ error: 'No hay preguntas incorrectas para analizar' });
    }

    console.log(`📝 Generando informe para ${userEmail} con ${incorrectQuestions.length} errores...`);

    // 1. Generar contenido con Gemini (pasando el nombre del alumno)
    console.log('🤖 Llamando a Gemini...');
    const htmlContent = await generateReportContent(incorrectQuestions, userName);

    // 2. Convertir a PDF
    console.log('📄 Convirtiendo a PDF...');
    const pdfResult = await htmlToPdf(htmlContent);

    // Asegurar que tenemos un Buffer (Puppeteer puede devolver Uint8Array en Vercel)
    const pdfBuffer = Buffer.isBuffer(pdfResult) ? pdfResult : Buffer.from(pdfResult);

    // Convertir PDF a base64 para descarga
    const pdfBase64 = pdfBuffer.toString('base64');
    console.log(`📊 PDF generado: ${pdfBuffer.length} bytes, base64: ${pdfBase64.length} chars`);

    // 3. Intentar enviar por email (no bloquea si falla)
    let emailSent = false;
    let emailError = null;

    try {
      console.log('📧 Enviando email...');
      await sendEmailWithPdf(userEmail, pdfBuffer, userName);
      emailSent = true;
      console.log(`✅ Informe enviado a ${userEmail}`);
    } catch (emailErr) {
      console.error('⚠️ Error enviando email (PDF generado correctamente):', emailErr.message);
      emailError = emailErr.message;
    }

    // Siempre devolver éxito con el PDF para descarga
    return res.status(200).json({
      success: true,
      message: emailSent
        ? 'Informe generado y enviado correctamente'
        : 'Informe generado. Error al enviar email, pero puedes descargarlo.',
      questionsAnalyzed: incorrectQuestions.length,
      emailSent: emailSent,
      emailError: emailError,
      pdfBase64: pdfBase64
    });

  } catch (error) {
    console.error('❌ Error generando informe:', error);
    return res.status(500).json({
      error: 'Error al generar el informe',
      details: error.message
    });
  }
}
