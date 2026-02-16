import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  wrongExplanation: string;
  tema: number;
  category: string;
  subtema?: string | null;
}

// ============ FLASHCARDS ============

export interface Flashcard {
  id: string;
  user_id: string;
  report_id: string | null; // Referencia al "mazo" en generated_reports
  anverso: string;
  reverso: string;
  nivel: number; // 0=nuevo, 1=fallo, 2=duda, 3=justo, 4=claro, 5=pro
  repeticiones_correctas: number;
  ultima_revision: string | null;
  proxima_revision: string | null;
  created_at: string;
}

export interface GeneratedReport {
  id: string;
  user_id: string;
  report_type: 'infografia' | 'reporte_pdf' | 'flashcards';
  storage_path: string;
  file_name: string;
  test_result_id: number | null;
  questions_analyzed: unknown | null;
  num_questions: number | null;
  created_at: string;
  user_email: string | null;
  report_title: string | null;
}

// ============ CURVA ESTRICTA DE REPETICION ESPACIADA ============
//
// REGLAS CRITICAS:
// 1. Cualquier fallo reinicia la tarjeta a 10 minutos
// 2. No existe salto directo a intervalos largos
// 3. Las tarjetas no pasan a intervalos largos hasta superar varios ciclos correctos
// 4. El intervalo depende del HISTORIAL de aciertos consecutivos, no solo del nivel actual
//
// NIVELES DE RESPUESTA:
// 1 = FALLO: No supo o respondio mal
// 2 = DUDA: Respondio con mucho esfuerzo/incertidumbre
// 3 = JUSTO: Respondio correctamente pero con esfuerzo
// 4 = CLARO: Respondio sin problemas
// 5 = PRO: Respondio instantaneamente, dominada

// Intervalos base en minutos
const INTERVALS = {
  FALLO: 10,              // 10 minutos
  DUDA: 720,              // 12 horas
  JUSTO: 1440,            // 24 horas
  // Para CLARO/PRO, el intervalo depende de aciertos consecutivos:
  CONSECUTIVO_1: 1440,    // 1 acierto -> 24 horas
  CONSECUTIVO_2: 4320,    // 2 aciertos -> 3 dias
  CONSECUTIVO_3: 10080,   // 3 aciertos -> 7 dias
  CONSECUTIVO_4: 20160,   // 4+ aciertos -> 14 dias
};

// Calcular intervalo segun curva estricta
const calcularIntervaloEstricto = (nivel: number, aciertosPrevios: number): { minutos: number; nuevosAciertos: number } => {
  // FALLO: Reiniciar TODO
  if (nivel === 1) {
    return { minutos: INTERVALS.FALLO, nuevosAciertos: 0 };
  }

  // DUDA: 12 horas, NO incrementa aciertos (respuesta debil)
  if (nivel === 2) {
    return { minutos: INTERVALS.DUDA, nuevosAciertos: aciertosPrevios }; // Mantiene aciertos pero no incrementa
  }

  // JUSTO: 24 horas, NO incrementa aciertos (todavia necesita refuerzo)
  if (nivel === 3) {
    return { minutos: INTERVALS.JUSTO, nuevosAciertos: aciertosPrevios }; // Mantiene pero no incrementa
  }

  // CLARO o PRO (nivel 4-5): Incrementa aciertos y usa curva estricta
  const nuevosAciertos = aciertosPrevios + 1;

  let minutos: number;
  if (nuevosAciertos === 1) {
    minutos = INTERVALS.CONSECUTIVO_1;  // 24 horas
  } else if (nuevosAciertos === 2) {
    minutos = INTERVALS.CONSECUTIVO_2;  // 3 dias
  } else if (nuevosAciertos === 3) {
    minutos = INTERVALS.CONSECUTIVO_3;  // 7 dias
  } else {
    minutos = INTERVALS.CONSECUTIVO_4;  // 14 dias (maximo)
  }

  return { minutos, nuevosAciertos };
};

// Crear "mazo" de flashcards (registro en generated_reports + tarjetas individuales)
export const saveFlashcardDeck = async (
  userId: string,
  userEmail: string,
  reportTitle: string,
  flashcards: { anverso: string; reverso: string }[],
  testResultId: number | null = null
): Promise<{ data: { reportId: string; flashcards: Flashcard[] } | null; error: Error | null }> => {
  try {
    // 1. Crear registro del "mazo" en generated_reports
    const fileName = `flashcards-${Date.now()}.json`;

    const { data: reportData, error: reportError } = await supabase
      .from('generated_reports')
      .insert({
        user_id: userId,
        user_email: userEmail,
        report_type: 'flashcards',
        report_title: reportTitle,
        storage_path: '',
        file_name: fileName,
        test_result_id: testResultId,
        num_questions: flashcards.length
      })
      .select()
      .single();

    if (reportError || !reportData) {
      console.error('Error creating flashcard deck:', reportError);
      return { data: null, error: reportError || new Error('Failed to create deck') };
    }

    // 2. Crear las flashcards individuales
    const flashcardsToInsert = flashcards.map(fc => ({
      user_id: userId,
      report_id: reportData.id,
      anverso: fc.anverso,
      reverso: fc.reverso,
      nivel: 0,
      repeticiones_correctas: 0,
      proxima_revision: new Date().toISOString()
    }));

    const { data: flashcardsData, error: flashcardsError } = await supabase
      .from('flashcards')
      .insert(flashcardsToInsert)
      .select();

    if (flashcardsError) {
      console.error('Error saving flashcards:', flashcardsError);
      // Rollback: eliminar el registro del mazo
      await supabase.from('generated_reports').delete().eq('id', reportData.id);
      return { data: null, error: flashcardsError };
    }

    return {
      data: {
        reportId: reportData.id,
        flashcards: flashcardsData || []
      },
      error: null
    };
  } catch (err) {
    console.error('Error in saveFlashcardDeck:', err);
    return { data: null, error: err as Error };
  }
};

// Obtener flashcards por report_id (mazo) - TODAS
export const getFlashcardsByReportId = async (reportId: string): Promise<Flashcard[]> => {
  const { data, error } = await supabase
    .from('flashcards')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching flashcards:', error);
    return [];
  }

  return data || [];
};

// Obtener flashcards PENDIENTES de revision por report_id (mazo)
export const getFlashcardsDueByReportId = async (reportId: string): Promise<{ due: Flashcard[]; total: number }> => {
  const now = new Date().toISOString();

  // Primero obtenemos todas para el conteo total
  const { data: allData, error: allError } = await supabase
    .from('flashcards')
    .select('*')
    .eq('report_id', reportId);

  if (allError) {
    console.error('Error fetching flashcards:', allError);
    return { due: [], total: 0 };
  }

  const total = allData?.length || 0;

  // Filtramos las pendientes (proxima_revision <= ahora)
  const due = (allData || []).filter(fc => {
    if (!fc.proxima_revision) return true;
    return new Date(fc.proxima_revision) <= new Date(now);
  });

  // Ordenar por proxima revision (las mas urgentes primero)
  due.sort((a, b) => {
    const dateA = a.proxima_revision ? new Date(a.proxima_revision).getTime() : 0;
    const dateB = b.proxima_revision ? new Date(b.proxima_revision).getTime() : 0;
    return dateA - dateB;
  });

  return { due, total };
};

// Obtener todas las flashcards del usuario
export const getAllUserFlashcards = async (userId: string): Promise<Flashcard[]> => {
  const { data, error } = await supabase
    .from('flashcards')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user flashcards:', error);
    return [];
  }

  return data || [];
};

// Obtener flashcards pendientes de revision
export const getFlashcardsDueForReview = async (userId: string): Promise<Flashcard[]> => {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('flashcards')
    .select('*')
    .eq('user_id', userId)
    .lte('proxima_revision', now)
    .order('proxima_revision', { ascending: true });

  if (error) {
    console.error('Error fetching due flashcards:', error);
    return [];
  }

  return data || [];
};

// Actualizar flashcard despues de revision - CURVA ESTRICTA
export const updateFlashcardReview = async (
  flashcardId: string,
  nivel: number // 1=fallo, 2=duda, 3=justo, 4=claro, 5=pro
): Promise<{ error: Error | null }> => {
  try {
    // Obtener flashcard actual
    const { data: currentCard, error: fetchError } = await supabase
      .from('flashcards')
      .select('*')
      .eq('id', flashcardId)
      .single();

    if (fetchError || !currentCard) {
      return { error: fetchError || new Error('Flashcard not found') };
    }

    // CURVA ESTRICTA: Calcular proxima revision segun historial
    const { minutos, nuevosAciertos } = calcularIntervaloEstricto(
      nivel,
      currentCard.repeticiones_correctas
    );

    const proximaRevision = new Date(Date.now() + minutos * 60 * 1000);

    // Log para debugging
    console.log(`[Flashcard ${flashcardId}] Nivel: ${nivel}, Aciertos previos: ${currentCard.repeticiones_correctas} -> Nuevos: ${nuevosAciertos}, Proxima revision en: ${minutos} min`);

    const { error } = await supabase
      .from('flashcards')
      .update({
        nivel,
        repeticiones_correctas: nuevosAciertos,
        ultima_revision: new Date().toISOString(),
        proxima_revision: proximaRevision.toISOString()
      })
      .eq('id', flashcardId);

    if (error) {
      console.error('Error updating flashcard:', error);
      return { error };
    }

    return { error: null };
  } catch (err) {
    console.error('Error in updateFlashcardReview:', err);
    return { error: err as Error };
  }
};

// Eliminar una flashcard individual
export const deleteFlashcard = async (flashcardId: string): Promise<{ error: Error | null }> => {
  const { error } = await supabase
    .from('flashcards')
    .delete()
    .eq('id', flashcardId);

  if (error) {
    console.error('Error deleting flashcard:', error);
    return { error };
  }

  return { error: null };
};

// Obtener reportes generados del usuario (mazos de flashcards)
export const getUserGeneratedReports = async (userId: string, reportType?: string): Promise<GeneratedReport[]> => {
  let query = supabase
    .from('generated_reports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (reportType) {
    query = query.eq('report_type', reportType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching generated reports:', error);
    return [];
  }

  return data || [];
};

// Eliminar un mazo completo (generated_report + sus flashcards)
export const deleteGeneratedReport = async (reportId: string): Promise<{ error: Error | null }> => {
  try {
    // Las flashcards se eliminan automaticamente por CASCADE
    const { error } = await supabase
      .from('generated_reports')
      .delete()
      .eq('id', reportId);

    if (error) {
      console.error('Error deleting report:', error);
      return { error };
    }

    return { error: null };
  } catch (err) {
    console.error('Error in deleteGeneratedReport:', err);
    return { error: err as Error };
  }
};
