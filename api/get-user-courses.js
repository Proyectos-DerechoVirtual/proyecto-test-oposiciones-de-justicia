/**
 * Vercel Serverless Function
 * Endpoint: /api/get-user-courses
 *
 * Obtiene las oposiciones disponibles para un usuario según sus enrollments en Teachable
 */

import { createClient } from '@supabase/supabase-js';

// CORS headers para permitir requests desde el frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  try {
    const { userId, userEmail } = req.query;

    // Validar que tengamos al menos un identificador
    if (!userId && !userEmail) {
      return res.status(400).json({
        error: 'Se requiere userId o userEmail',
        ...corsHeaders
      });
    }

    // Variables de entorno (configuradas en Vercel)
    const TEACHABLE_API_KEY = process.env.TEACHABLE_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

    if (!TEACHABLE_API_KEY) {
      console.error('TEACHABLE_API_KEY no configurada');
      return res.status(500).json({
        error: 'Configuración incompleta del servidor',
        ...corsHeaders
      });
    }

    console.log('Consultando enrollments para usuario:', { userId, userEmail });

    // Paso 1: Obtener datos del usuario desde Teachable API
    let courses = [];

    try {
      // API de Teachable - Endpoint correcto
      const teachableUrl = `https://developers.teachable.com/v1/users/${userId}`;

      const teachableResponse = await fetch(teachableUrl, {
        headers: {
          'apiKey': TEACHABLE_API_KEY,
          'Accept': 'application/json'
        }
      });

      if (!teachableResponse.ok) {
        const errorText = await teachableResponse.text();
        console.error('Error de Teachable API:', teachableResponse.status, teachableResponse.statusText, errorText);
        throw new Error(`Teachable API error: ${teachableResponse.status}`);
      }

      const userData = await teachableResponse.json();

      // La respuesta viene directamente como objeto con courses array
      // FILTRAR: Solo cursos activos (is_active_enrollment: true)
      const allCourses = userData.courses || [];
      courses = allCourses.filter(c => c.is_active_enrollment === true);

      console.log(`Usuario tiene ${allCourses.length} cursos totales, ${courses.length} activos:`, courses.map(c => `${c.course_name} (${c.course_id})`));
    } catch (error) {
      console.error('Error consultando Teachable:', error);
      // Continuamos sin courses para devolver todas las oposiciones como fallback
    }

    // Paso 2: Extraer course_ids de los cursos
    const courseIds = courses.map(c => c.course_id.toString());
    console.log('Course IDs:', courseIds);

    // Si no hay enrollments, devolver array vacío o todas las oposiciones
    if (courseIds.length === 0) {
      console.log('Usuario sin enrollments, devolviendo todas las oposiciones');
      return res.status(200).json({
        oposiciones: [], // Array vacío = mostrar todas
        allAccess: true,
        ...corsHeaders
      });
    }

    // Paso 3: Consultar Supabase para mapear course_id → oposicion
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: mappings, error: supabaseError } = await supabase
      .from('course_oposicion_mapping_test')
      .select('course_id, oposicion')
      .in('course_id', courseIds);

    if (supabaseError) {
      console.error('Error consultando Supabase:', supabaseError);
      throw supabaseError;
    }

    // Paso 4: Extraer oposiciones únicas
    const oposiciones = [...new Set(mappings?.map(m => m.oposicion) || [])];

    console.log('Oposiciones permitidas:', oposiciones);

    return res.status(200).json({
      oposiciones,
      allAccess: false,
      courseIds,
      ...corsHeaders
    });

  } catch (error) {
    console.error('Error en get-user-courses:', error);
    return res.status(500).json({
      error: error.message || 'Error interno del servidor',
      oposiciones: [], // En caso de error, devolver vacío para mostrar todo
      allAccess: true,
      ...corsHeaders
    });
  }
}
