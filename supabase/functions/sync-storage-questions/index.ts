// Edge Function para sincronizar archivos .txt del bucket "Tests" con la base de datos
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Question {
  pregunta: string;
  opciones: string[];
  respuesta_correcta: number;
  explicacion_correcta: string;
  explicacion_errada: string;
  tema: number;
  categoria: string;
}

// Función para parsear archivos .txt con el formato específico
function parseTextFile(content: string, fileName: string, folderPath: string): Question[] {
  const questions: Question[] = [];
  const blocks = content.split('###').filter(block => block.trim());

  // Extraer tema del nombre del archivo (ej: "test_tema_10.txt" -> 10)
  const temaMatch = fileName.match(/tema[_\s-]?(\d+)/i);
  const tema = temaMatch ? parseInt(temaMatch[1]) : 0;

  // Extraer categoría de la ruta (ej: "Gestion/Gestion-1" -> "Gestión 1")
  let categoria = 'General';
  const pathParts = folderPath.split('/').filter(p => p);

  if (pathParts.length >= 2) {
    const mainCat = pathParts[0]; // "Gestion"
    const subCat = pathParts[1]; // "Gestion-1"

    // Convertir "Gestion-1" a "Gestión 1"
    categoria = subCat
      .replace(/Gestion-(\d+)/i, 'Gestión $1')
      .replace(/Tramitacion/i, 'Tramitación')
      .replace(/Auxilio/i, 'Auxilio')
      .replace(/-/g, ' ');
  }

  for (const block of blocks) {
    const lines = block.trim().split('\n');

    let pregunta = '';
    const opciones: string[] = [];
    let respuesta_correcta = 0;
    let explicacion_correcta = '';
    let explicacion_errada = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('Pregunta:')) {
        pregunta = line.replace('Pregunta:', '').trim();
      } else if (/^\d+\)/.test(line)) {
        opciones.push(line.replace(/^\d+\)/, '').trim());
      } else if (line.startsWith('Respuesta:')) {
        respuesta_correcta = parseInt(line.replace('Respuesta:', '').trim());
      } else if (line.startsWith('Correcta:')) {
        explicacion_correcta = line.replace('Correcta:', '').trim();
      } else if (line.startsWith('Errada:')) {
        explicacion_errada = line.replace('Errada:', '').trim();
      }
    }

    if (pregunta && opciones.length === 4 && respuesta_correcta > 0) {
      questions.push({
        pregunta,
        opciones,
        respuesta_correcta,
        explicacion_correcta,
        explicacion_errada,
        tema,
        categoria
      });
    }
  }

  return questions;
}

// Función recursiva para listar todos los archivos en el bucket
async function listAllFiles(supabase: any, path: string = ''): Promise<any[]> {
  const allFiles: any[] = [];

  const { data: items, error } = await supabase.storage
    .from('Tests')
    .list(path, { limit: 1000 });

  if (error) {
    console.error(`Error listing ${path}:`, error);
    return allFiles;
  }

  for (const item of items || []) {
    const fullPath = path ? `${path}/${item.name}` : item.name;

    // Si es un archivo .txt, agregarlo
    if (item.id && item.name.endsWith('.txt')) {
      allFiles.push({ ...item, fullPath });
    }
    // Si es una carpeta (no tiene id), explorarla recursivamente
    else if (!item.id) {
      const subFiles = await listAllFiles(supabase, fullPath);
      allFiles.push(...subFiles);
    }
  }

  return allFiles;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Iniciando sincronización desde Storage...');

    // 1. Listar todos los archivos .txt del bucket recursivamente
    const allFiles = await listAllFiles(supabase);
    console.log(`📁 Encontrados ${allFiles.length} archivos .txt`);

    const logs: string[] = [];
    let totalQuestionsProcessed = 0;
    let filesProcessed = 0;
    let filesWithErrors = 0;

    // 2. Procesar cada archivo
    for (const file of allFiles) {
      try {
        logs.push(`📄 Procesando: ${file.fullPath}`);
        console.log(`Processing: ${file.fullPath}`);

        // Descargar el archivo
        const { data, error } = await supabase.storage
          .from('Tests')
          .download(file.fullPath);

        if (error) {
          logs.push(`❌ Error descargando ${file.fullPath}: ${error.message}`);
          filesWithErrors++;
          continue;
        }

        // Convertir a texto
        const text = await data.text();

        // Extraer carpeta padre (ej: "Gestion/Gestion-1/test_tema_10.txt" -> "Gestion/Gestion-1")
        const folderPath = file.fullPath.substring(0, file.fullPath.lastIndexOf('/'));

        // Parsear preguntas
        const questions = parseTextFile(text, file.name, folderPath);

        if (questions.length > 0) {
          // Insertar en la base de datos
          const { error: dbError } = await supabase
            .from('questions_test')
            .upsert(
              questions.map(q => ({
                pregunta: q.pregunta,
                opciones: q.opciones,
                respuesta_correcta: q.respuesta_correcta,
                explicacion_correcta: q.explicacion_correcta,
                explicacion_errada: q.explicacion_errada,
                tema: q.tema,
                categoria: q.categoria
              })),
              {
                onConflict: 'pregunta',
                ignoreDuplicates: false
              }
            );

          if (dbError) {
            logs.push(`❌ Error insertando ${file.name}: ${dbError.message}`);
            filesWithErrors++;
          } else {
            logs.push(`✅ ${questions.length} preguntas de ${file.name} sincronizadas`);
            totalQuestionsProcessed += questions.length;
            filesProcessed++;
          }
        } else {
          logs.push(`⚠️  No se encontraron preguntas válidas en ${file.name}`);
        }
      } catch (err) {
        logs.push(`❌ Error procesando ${file.fullPath}: ${err.message}`);
        filesWithErrors++;
      }
    }

    const summary = {
      success: true,
      totalFiles: allFiles.length,
      filesProcessed,
      filesWithErrors,
      totalQuestionsProcessed,
      logs
    };

    console.log('✅ Sincronización completada:', summary);

    return new Response(
      JSON.stringify(summary),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error en sincronización:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
