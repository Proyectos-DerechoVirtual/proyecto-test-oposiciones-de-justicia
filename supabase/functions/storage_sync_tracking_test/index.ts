// Edge Function OPTIMIZADA - storage_sync_tracking_test con soporte para 3 niveles
// + Auto-populate de course_oposicion_mapping_test
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Función para parsear archivos .txt
function parseTextFile(content: string, fileName: string, folderPath: string, fullPath: string) {
  const questions = [];
  const blocks = content.split('###').filter((block) => block.trim());

  // Extraer tema y subtema del nombre del archivo
  // Formato esperado: test_tema_10_procedimiento_laboral.txt
  const temaMatch = fileName.match(/tema[_\s-]?(\d+)(?:[_\s-](.+?))?\.txt$/i);
  const tema = temaMatch ? parseInt(temaMatch[1]) : 0;

  // Extraer subtema (texto después del número hasta .txt)
  let subtema = '';
  if (temaMatch && temaMatch[2]) {
    subtema = temaMatch[2]
      .replace(/_/g, ' ')           // Guiones bajos → espacios
      .replace(/-/g, ' ')           // Guiones → espacios
      .replace(/\s+/g, ' ')         // Múltiples espacios → uno
      .trim()
      .split(' ')                   // Capitalizar primera letra de cada palabra
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // NUEVA LÓGICA: Extraer oposición, categoría y course_id de la ruta (3 niveles)
  // Formato esperado: oposicion-courseId/categoria-bloque-N/test_tema_X.txt
  // Ejemplo: gestion-1-2895236/gestion-1-bloque-1/test_tema_1.txt
  let oposicion = 'General';
  let categoria = 'General';
  let courseId = '';
  const pathParts = folderPath.split('/').filter((p) => p);

  // Función helper para extraer course_id y limpiar nombre
  const extractCourseIdAndCleanName = (folderName: string): { cleanName: string; courseId: string } => {
    // Regex para detectar course_id al final: -NNNNNN (6-10 dígitos)
    const courseIdMatch = folderName.match(/-(\d{6,10})$/);

    if (courseIdMatch) {
      const extractedId = courseIdMatch[1];
      const cleanName = folderName.replace(/-\d{6,10}$/, ''); // Quitar course_id
      return { cleanName, courseId: extractedId };
    }

    return { cleanName: folderName, courseId: '' };
  };

  if (pathParts.length >= 2) {
    // pathParts[0] = "gestion-1-2895236" (primer nivel con course_id)
    // pathParts[1] = "gestion-1-bloque-1" (segundo nivel SIN course_id)

    const level1 = extractCourseIdAndCleanName(pathParts[0]);
    const level2 = extractCourseIdAndCleanName(pathParts[1]);

    // Usar el course_id del primer nivel (oposición)
    courseId = level1.courseId || level2.courseId;

    oposicion = level1.cleanName
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    categoria = level2.cleanName
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  } else if (pathParts.length === 1) {
    // Solo hay un nivel de carpeta
    const level1 = extractCourseIdAndCleanName(pathParts[0]);
    courseId = level1.courseId;

    oposicion = level1.cleanName
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    categoria = 'General';
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
        categoria,
        oposicion,
        source_file: fullPath,
        subtema: subtema,
        courseId: courseId // NUEVO: course_id extraído de la carpeta
      });
    }
  }

  return questions;
}

// Función recursiva para listar archivos
async function listAllFiles(supabase: any, path = '') {
  const allFiles: any[] = [];
  const { data: items, error } = await supabase.storage.from('Tests').list(path, { limit: 1000 });

  if (error) {
    console.error(`Error listing ${path}:`, error);
    return allFiles;
  }

  for (const item of items || []) {
    const fullPath = path ? `${path}/${item.name}` : item.name;

    if (item.id && item.name.endsWith('.txt')) {
      allFiles.push({
        ...item,
        fullPath,
        updated_at: item.updated_at || item.created_at
      });
    } else if (!item.id) {
      const subFiles = await listAllFiles(supabase, fullPath);
      allFiles.push(...subFiles);
    }
  }

  return allFiles;
}

// NUEVA FUNCIÓN: Auto-populate course_oposicion_mapping_test con course_id REAL
async function updateCourseMappingTable(supabase: any, oposicionData: Map<string, string>) {
  const logs: string[] = [];

  try {
    for (const [oposicion, courseId] of oposicionData.entries()) {
      if (!courseId) {
        logs.push(`⚠️  Oposición "${oposicion}" no tiene course_id, se omite`);
        continue;
      }

      // Upsert en la tabla con el course_id REAL extraído de la carpeta
      const { error } = await supabase
        .from('course_oposicion_mapping_test')
        .upsert({
          course_id: courseId,
          course_name: `Curso ${oposicion}`,
          oposicion: oposicion
        }, {
          onConflict: 'course_id',
          ignoreDuplicates: false // Actualizar si ya existe
        });

      if (error) {
        // Si el error es porque ya existe, está bien
        if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
          logs.push(`⚠️  Error actualizando mapping para "${oposicion}" (${courseId}): ${error.message}`);
        }
      } else {
        logs.push(`✅ Mapping creado/actualizado: "${oposicion}" → course_id: ${courseId}`);
      }
    }
  } catch (err: any) {
    logs.push(`❌ Error en updateCourseMappingTable: ${err.message}`);
  }

  return logs;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔄 Iniciando sincronización INCREMENTAL con soporte de 3 niveles...');

    const logs: string[] = [];
    let totalQuestionsProcessed = 0;
    let filesProcessed = 0;
    let filesSkipped = 0;
    let filesWithErrors = 0;
    let filesDeleted = 0;
    const oposicionesEncontradas = new Map<string, string>(); // Rastrear oposicion -> courseId

    // 1. Listar todos los archivos del Storage
    const allFiles = await listAllFiles(supabase);
    logs.push(`📁 Encontrados ${allFiles.length} archivos en Storage`);

    // 2. Obtener tracking de archivos ya sincronizados
    const { data: trackingData } = await supabase
      .from('storage_sync_tracking_test')
      .select('file_path, file_updated_at');

    const tracking = new Map((trackingData || []).map((t: any) => [t.file_path, t.file_updated_at]));
    logs.push(`📊 ${tracking.size} archivos previamente sincronizados`);

    // 3. Detectar archivos eliminados del Storage
    const storageFilePaths = new Set(allFiles.map((f) => f.fullPath));
    const deletedFiles: string[] = [];

    for (const [trackedPath] of tracking) {
      if (!storageFilePaths.has(trackedPath)) {
        deletedFiles.push(trackedPath);
      }
    }

    // 4. Eliminar preguntas de archivos borrados
    for (const deletedPath of deletedFiles) {
      const { error: delError } = await supabase
        .from('questions_test')
        .delete()
        .eq('source_file', deletedPath);

      if (!delError) {
        await supabase.from('storage_sync_tracking_test').delete().eq('file_path', deletedPath);
        logs.push(`🗑️  Eliminadas preguntas de: ${deletedPath}`);
        filesDeleted++;
      }
    }

    // 5. Procesar solo archivos nuevos o modificados
    for (const file of allFiles) {
      try {
        const lastSync = tracking.get(file.fullPath);
        const fileUpdated = new Date(file.updated_at);

        // Saltar si no ha cambiado
        if (lastSync && new Date(lastSync) >= fileUpdated) {
          filesSkipped++;
          continue;
        }

        logs.push(`📄 ${lastSync ? 'Actualizando' : 'Procesando nuevo'}: ${file.fullPath}`);

        // Descargar archivo
        const { data, error } = await supabase.storage.from('Tests').download(file.fullPath);

        if (error) {
          logs.push(`❌ Error descargando: ${error.message}`);
          filesWithErrors++;
          continue;
        }

        const text = await data.text();
        const folderPath = file.fullPath.substring(0, file.fullPath.lastIndexOf('/'));
        const questions = parseTextFile(text, file.name, folderPath, file.fullPath);

        if (questions.length > 0) {
          // Rastrear oposiciones encontradas con sus course_ids
          questions.forEach((q: any) => {
            if (q.oposicion && q.oposicion !== 'General' && q.courseId) {
              oposicionesEncontradas.set(q.oposicion, q.courseId);
            }
          });

          // Primero eliminar preguntas viejas de este archivo
          await supabase.from('questions_test').delete().eq('source_file', file.fullPath);

          // Insertar nuevas preguntas (ignora duplicados automáticamente)
          const { error: dbError } = await supabase.from('questions_test').upsert(
            questions.map((q: any) => ({
              pregunta: q.pregunta,
              opciones: q.opciones,
              respuesta_correcta: q.respuesta_correcta,
              explicacion_correcta: q.explicacion_correcta,
              explicacion_errada: q.explicacion_errada,
              tema: q.tema,
              categoria: q.categoria,
              oposicion: q.oposicion,  // NUEVO CAMPO
              source_file: q.source_file,
              subtema: q.subtema
            })),
            { onConflict: 'pregunta,source_file', ignoreDuplicates: true }
          );

          if (dbError) {
            logs.push(`❌ Error insertando: ${dbError.message}`);
            filesWithErrors++;
          } else {
            // Actualizar tracking
            await supabase.from('storage_sync_tracking_test').upsert(
              {
                file_path: file.fullPath,
                file_updated_at: file.updated_at,
                questions_count: questions.length,
                last_synced_at: new Date().toISOString()
              },
              { onConflict: 'file_path' }
            );

            logs.push(`✅ ${questions.length} preguntas sincronizadas (Oposición: ${questions[0].oposicion}, Categoría: ${questions[0].categoria})`);
            totalQuestionsProcessed += questions.length;
            filesProcessed++;
          }
        } else {
          logs.push(`⚠️  Sin preguntas válidas`);
        }
      } catch (err: any) {
        logs.push(`❌ Error: ${err.message}`);
        filesWithErrors++;
      }
    }

    // 6. NUEVO: Actualizar tabla de mapeo de cursos
    logs.push(`\n🔄 Actualizando tabla de mapeo de cursos...`);
    const mappingLogs = await updateCourseMappingTable(supabase, oposicionesEncontradas);
    logs.push(...mappingLogs);

    const summary = {
      success: true,
      totalFiles: allFiles.length,
      filesProcessed,
      filesSkipped,
      filesWithErrors,
      filesDeleted,
      totalQuestionsProcessed,
      oposicionesEncontradas: Object.fromEntries(oposicionesEncontradas), // Convert Map to object
      logs
    };

    console.log('✅ Sincronización completada:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
