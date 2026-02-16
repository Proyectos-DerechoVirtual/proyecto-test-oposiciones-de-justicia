import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import type { Question, Flashcard, GeneratedReport } from './lib/supabase';
import { updateFlashcardReview, saveFlashcardDeck, getUserGeneratedReports, deleteGeneratedReport } from './lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './App.css';

type Screen = 'home' | 'select' | 'test' | 'results' | 'loading' | 'stats' | 'admin' | 'leaderboard' | 'flashcardStudy' | 'flashcardsHome';
type TestType = 'aleatorio' | 'categoria' | 'falladas' | 'no_respondidas';

interface UserAnswers {
  [questionId: number]: number; // questionId -> selected option index
}

interface TemaWithSubtema {
  tema: number;
  subtema: string | null;
}

// Identificador único para cada tema (incluye oposición y categoría)
interface SelectedTemaKey {
  oposicion: string;
  categoria: string;
  tema: number;
}

// Nueva estructura de 3 niveles: Oposicion -> Categoria -> Tema
interface OposicionData {
  [oposicion: string]: {
    [categoria: string]: TemaWithSubtema[];
  };
}

interface TestResult {
  id: number;
  test_date: string;
  num_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  score: number;
  score_standar: number;
  time_spent_seconds: number;
  categoria: string | null;
  tema: number | null;
}

// Estadísticas de pregunta con datos de la pregunta
interface QuestionStatWithDetails {
  id: number;
  question_id: number;
  times_seen: number;
  times_correct: number;
  times_incorrect: number;
  times_skipped: number;
  last_answer_correct: boolean | null;
  last_answer_given: number | null;
  // Datos de la pregunta
  pregunta: string;
  opciones: string[];
  respuesta_correcta: number;
  tema: number;
  categoria: string;
  subtema: string | null;
}

type QuestionStatsFilter = 'all' | 'correct' | 'incorrect' | 'skipped';

/* Interface no usada - solo para funciones comentadas
interface ParsedQuestion {
  pregunta: string;
  opciones: string[];
  respuesta_correcta: number;
  explicacion_correcta: string;
  explicacion_errada: string;
  tema: number;
  categoria: string;
}
*/

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<UserAnswers>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [timeElapsed, setTimeElapsed] = useState<number>(0); // in seconds
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [savingResults, setSavingResults] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<number>(0);

  // Infografía states
  const [generatingInfografia, setGeneratingInfografia] = useState<boolean>(false);
  const [infografiaUrl, setInfografiaUrl] = useState<string | null>(null);
  const [infografiaError, setInfografiaError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean>(false);

  // Informe PDF states
  const [generatingReport, setGeneratingReport] = useState<boolean>(false);
  const [reportSent, setReportSent] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportPdfBase64, setReportPdfBase64] = useState<string | null>(null);
  const [reportEmailFailed, setReportEmailFailed] = useState<boolean>(false);

  // Flashcards states
  const [generatingFlashcards, setGeneratingFlashcards] = useState<boolean>(false);
  const [flashcardsGenerated, setFlashcardsGenerated] = useState<Flashcard[]>([]);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);
  const [studyingFlashcards, setStudyingFlashcards] = useState<Flashcard[]>([]);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState<number>(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState<boolean>(false);
  const [flashcardReportId, setFlashcardReportId] = useState<string | null>(null);
  const [flashcardStudyMateria, setFlashcardStudyMateria] = useState<string | null>(null);
  const [flashcardTotalInDeck, setFlashcardTotalInDeck] = useState<number>(0);
  const [noPendingFlashcardsMessage, setNoPendingFlashcardsMessage] = useState<string | null>(null);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [loadingFlashcardDecks, setLoadingFlashcardDecks] = useState<boolean>(false);

  // Audio states
  const [generatingAudio, setGeneratingAudio] = useState<boolean>(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Test selection states
  const [testType, setTestType] = useState<TestType>('aleatorio');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedTemas, setSelectedTemas] = useState<SelectedTemaKey[]>([]);
  const [availableOposiciones, setAvailableOposiciones] = useState<OposicionData>({});

  // Accordion states for flat menu
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Teachable user data
  const [teachableUserId, setTeachableUserId] = useState<string | null>(null);
  const [teachableUserEmail, setTeachableUserEmail] = useState<string | null>(null);
  const [teachableUserName, setTeachableUserName] = useState<string | null>(null);

  // Locked mode (iframe embedding)
  const [isLockedMode, setIsLockedMode] = useState<boolean>(false);
  const [lockedOposicion, setLockedOposicion] = useState<string | null>(null);
  const [lockedCategoria, setLockedCategoria] = useState<string | null>(null);

  // Stats data
  const [userStats, setUserStats] = useState<TestResult[]>([]);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);

  // Question stats data
  const [questionStats, setQuestionStats] = useState<QuestionStatWithDetails[]>([]);
  const [questionStatsFilter, setQuestionStatsFilter] = useState<QuestionStatsFilter>('all');
  const [loadingQuestionStats, setLoadingQuestionStats] = useState<boolean>(false);
  const [expandedQuestionId, setExpandedQuestionId] = useState<number | null>(null);

  // Pagination for stats table and question history
  const [showAllStats, setShowAllStats] = useState<boolean>(false);
  const [showAllQuestions, setShowAllQuestions] = useState<boolean>(false);
  const INITIAL_ITEMS_TO_SHOW = 5;

  // Failed/Skipped questions grouped by category for accordion
  const [failedQuestionsByCategory, setFailedQuestionsByCategory] = useState<{[key: string]: {id: number, pregunta: string, tema: string}[]}>({});
  const [skippedQuestionsByCategory, setSkippedQuestionsByCategory] = useState<{[key: string]: {id: number, pregunta: string, tema: string}[]}>({});
  const [selectedFailedQuestions, setSelectedFailedQuestions] = useState<number[]>([]);
  const [selectedSkippedQuestions, setSelectedSkippedQuestions] = useState<number[]>([]);
  const [loadingFailedQuestions, setLoadingFailedQuestions] = useState<boolean>(false);
  const [loadingSkippedQuestions, setLoadingSkippedQuestions] = useState<boolean>(false);

  // Ranking data
  const [userPercentile, setUserPercentile] = useState<number | null>(null);

  // Leaderboard data
  interface LeaderboardEntry {
    rank: number;
    userName: string;
    totalTests: number;
    totalCorrect: number;
    totalIncorrect: number;
    avgScore: number;
    wilsonScore: number; // Puntuación global usando Wilson Score
    lastFiveResults: ('correct' | 'incorrect' | 'neutral')[];
    topCategory: string; // Categoría con más aciertos
  }

  // Función para calcular Wilson Score (límite inferior del intervalo de confianza)
  const calculateWilsonScore = (correct: number, total: number, z: number = 1.96): number => {
    if (total === 0) return 0;
    const p = correct / total; // Proporción de aciertos
    const n = total;

    // Fórmula de Wilson Score (lower bound)
    const numerator = p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
    const denominator = 1 + (z * z) / n;

    return (numerator / denominator) * 100; // Convertir a porcentaje
  };
  const [allQualifiedUsers, setAllQualifiedUsers] = useState<LeaderboardEntry[]>([]); // All users with 20+ questions
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);

  // Sorting state for leaderboard
  type SortColumn = 'wilsonScore' | 'totalQuestions' | 'totalCorrect' | 'totalIncorrect' | 'avgScore' | 'topCategory';
  const [sortColumn, setSortColumn] = useState<SortColumn>('wilsonScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showAllLeaderboard, setShowAllLeaderboard] = useState<boolean>(false);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      // For category, default to A-Z (asc), for numbers default to highest first (desc)
      setSortDirection(column === 'topCategory' ? 'asc' : 'desc');
    }
  };

  // Sort ALL qualified users and return top 10 or all based on showAllLeaderboard
  const getSortedLeaderboard = () => {
    const sorted = [...allQualifiedUsers].sort((a, b) => {
      // Handle alphabetical sorting for topCategory
      if (sortColumn === 'topCategory') {
        const aStr = a.topCategory.toLowerCase();
        const bStr = b.topCategory.toLowerCase();
        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      }

      // Handle numeric sorting for other columns
      let aValue: number;
      let bValue: number;

      if (sortColumn === 'totalQuestions') {
        aValue = a.totalCorrect + a.totalIncorrect;
        bValue = b.totalCorrect + b.totalIncorrect;
      } else {
        aValue = a[sortColumn] as number;
        bValue = b[sortColumn] as number;
      }

      if (sortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    const sliced = showAllLeaderboard ? sorted : sorted.slice(0, 10);

    return sliced.map((entry, index) => ({
      ...entry,
      rank: index + 1 // Re-calculate rank based on new sort order
    }));
  };

  const [userLeaderboardPosition, setUserLeaderboardPosition] = useState<{
    position: number | null;
    totalQuestions: number;
    totalCorrect: number;
    totalIncorrect: number;
    avgScore: number;
    wilsonScore: number;
    meetsMinimum: boolean;
    totalParticipants: number;
  }>({ position: null, totalQuestions: 0, totalCorrect: 0, totalIncorrect: 0, avgScore: 0, wilsonScore: 0, meetsMinimum: false, totalParticipants: 0 });

  // Admin panel data
  const [adminAuthenticated, setAdminAuthenticated] = useState<boolean>(false);
  const [adminPassword, setAdminPassword] = useState<string>('');
  // const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  // const [uploading, setUploading] = useState<boolean>(false);
  // const [uploadProgress, setUploadProgress] = useState<string>('');

  // Storage states (solo usados para sincronización)
  // const [adminTab, setAdminTab] = useState<'direct' | 'storage' | 'sync' | 'manage'>('storage');
  // const [selectedFolder, setSelectedFolder] = useState<string>('Gestion/Gestion-1');
  // const [storageFiles, setStorageFiles] = useState<any[]>([]);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Iframe generator states
  const [iframeOposicion, setIframeOposicion] = useState<string>('');
  const [iframeCategoria, setIframeCategoria] = useState<string>('');
  const [iframeTemas, setIframeTemas] = useState<number[]>([]);
  const [generatedIframe, setGeneratedIframe] = useState<string>('');
  const [iframeOposiciones, setIframeOposiciones] = useState<OposicionData>({});

  // Read URL parameters from Teachable on app load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');
    const userEmail = urlParams.get('user_email');
    const userName = urlParams.get('user_name');
    const adminKey = urlParams.get('admin');

    // Locked mode parameters
    const modo = urlParams.get('modo');
    const oposicion = urlParams.get('oposicion');
    const categoria = urlParams.get('categoria');
    const tema = urlParams.get('tema');
    const temas = urlParams.get('temas'); // Multiple temas separated by comma

    if (userId) setTeachableUserId(userId);
    if (userEmail) setTeachableUserEmail(userEmail);
    if (userName) setTeachableUserName(userName);

    // Check if locked mode is enabled (supports both single 'tema' and multiple 'temas')
    if (modo === 'bloqueado' && oposicion && categoria) {
      let temasNumeros: number[] = [];

      if (temas) {
        // Multiple temas (comma-separated)
        temasNumeros = temas.split(',').map(t => parseInt(t.trim())).filter(t => !isNaN(t));
      } else if (tema) {
        // Single tema (backwards compatibility)
        temasNumeros = [parseInt(tema)];
      }

      if (temasNumeros.length > 0) {
        const decodedOposicion = decodeURIComponent(oposicion);
        const decodedCategoria = decodeURIComponent(categoria);

        // Convertir números a objetos SelectedTemaKey
        const temasArray: SelectedTemaKey[] = temasNumeros.map(temaNum => ({
          oposicion: decodedOposicion,
          categoria: decodedCategoria,
          tema: temaNum
        }));

        setIsLockedMode(true);
        setLockedOposicion(decodedOposicion);
        setLockedCategoria(decodedCategoria);
        setTestType('categoria');
        setSelectedTemas(temasArray);
        setScreen('select'); // Ir directo a la pantalla de selección en modo bloqueado
        console.log('Locked mode enabled:', { oposicion: decodedOposicion, categoria: decodedCategoria, temas: temasNumeros });
      }
    }

    // Check if admin mode is requested
    if (adminKey === 'true') {
      setScreen('admin');
    }

    console.log('Teachable params:', { userId, userEmail, userName });
  }, []);

  // Load available categories and temas when entering select screen
  useEffect(() => {
    if (screen === 'select') {
      loadCategoriesAndTemas();
    }
  }, [screen]);

  const loadCategoriesAndTemas = async () => {
    try {
      // PASO 1: Si hay user_id, consultar qué oposiciones puede ver
      let allowedOposiciones: string[] | null = null;

      if (teachableUserId || teachableUserEmail) {
        try {
          const apiUrl = `/api/get-user-courses?userId=${encodeURIComponent(teachableUserId || '')}&userEmail=${encodeURIComponent(teachableUserEmail || '')}`;
          const response = await fetch(apiUrl);
          const data = await response.json();

          console.log('Oposiciones permitidas para el usuario:', data);

          // Si tiene oposiciones específicas, filtrar. Si está vacío o allAccess, mostrar todo
          if (data.oposiciones && data.oposiciones.length > 0 && !data.allAccess) {
            allowedOposiciones = data.oposiciones;
          }
        } catch (apiError) {
          console.error('Error consultando oposiciones del usuario:', apiError);
          // Si falla, mostrar todas las oposiciones
        }
      }

      // PASO 2: Use RPC function for efficient loading (no limit issues) - NOW WITH 3 LEVELS
      const { data, error } = await supabase
        .rpc('get_distinct_oposicion_categoria_tema');

      if (error) {
        console.error('Error loading oposiciones with RPC:', error);
        throw error;
      }

      // Group temas by oposicion -> categoria (3 levels)
      const oposicionMap: OposicionData = {};

      data?.forEach((item: any) => {
        const oposicion = item.oposicion || 'General';
        const categoria = item.categoria || 'General';

        // FILTRAR: Si hay oposiciones permitidas, solo incluir esas
        if (allowedOposiciones && !allowedOposiciones.includes(oposicion)) {
          return; // Saltar esta oposición
        }

        // Inicializar oposicion si no existe
        if (!oposicionMap[oposicion]) {
          oposicionMap[oposicion] = {};
        }

        // Inicializar categoria dentro de oposicion si no existe
        if (!oposicionMap[oposicion][categoria]) {
          oposicionMap[oposicion][categoria] = [];
        }

        // Añadir tema con subtema
        oposicionMap[oposicion][categoria].push({
          tema: item.tema,
          subtema: item.subtema
        });
      });

      // Sort temas within each categoria
      Object.keys(oposicionMap).forEach(opos => {
        Object.keys(oposicionMap[opos]).forEach(cat => {
          oposicionMap[opos][cat].sort((a, b) => a.tema - b.tema);
        });
      });

      setAvailableOposiciones(oposicionMap);
    } catch (err) {
      console.error('Error loading oposiciones, categorias and temas:', err);
    }
  };

  const loadUserStats = async () => {
    if (!teachableUserId && !teachableUserEmail) {
      setError('Debes estar registrado para ver estadísticas');
      return;
    }

    setLoadingStats(true);
    try {
      // Obtener TODOS los registros del usuario usando paginación
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
          .from('results_test')
          .select('id, test_date, num_questions, correct_answers, incorrect_answers, score, score_standar, time_spent_seconds, categoria, tema')
          .order('test_date', { ascending: false })
          .range(from, to);

        // Filter by user ID or email
        if (teachableUserId) {
          query = query.eq('teachable_user_id', teachableUserId);
        } else if (teachableUserEmail) {
          query = query.eq('teachable_user_email', teachableUserEmail);
        }

        const { data: pageData, error: pageError } = await query;

        if (pageError) throw pageError;

        if (pageData && pageData.length > 0) {
          allData = [...allData, ...pageData];
          page++;
          hasMore = pageData.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      console.log('📊 User Stats Debug:', {
        totalRecords: allData.length,
        pages: page,
        userId: teachableUserId || teachableUserEmail
      });

      setUserStats(allData);
      setScreen('stats');

      // Cargar también las estadísticas de preguntas
      loadQuestionStats();
    } catch (err) {
      console.error('Error loading stats:', err);
      setError('Error al cargar estadísticas');
    } finally {
      setLoadingStats(false);
    }
  };

  const loadQuestionStats = async () => {
    const userId = teachableUserId || teachableUserEmail;
    if (!userId) return;

    setLoadingQuestionStats(true);
    try {
      // Obtener estadísticas del usuario
      const { data: statsData, error: statsError } = await supabase
        .from('user_question_stats')
        .select('id, question_id, times_seen, times_correct, times_incorrect, times_skipped, last_answer_correct, last_answer_given')
        .eq('user_id', userId)
        .order('times_incorrect', { ascending: false });

      if (statsError) throw statsError;

      if (!statsData || statsData.length === 0) {
        setQuestionStats([]);
        return;
      }

      // Obtener los IDs de las preguntas
      const questionIds = statsData.map(s => s.question_id);

      // Obtener los datos de las preguntas
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions_test')
        .select('id, pregunta, opciones, respuesta_correcta, tema, categoria, subtema')
        .in('id', questionIds);

      if (questionsError) throw questionsError;

      // Combinar estadísticas con datos de preguntas
      const combined: QuestionStatWithDetails[] = statsData.map(stat => {
        const question = questionsData?.find(q => q.id === stat.question_id);
        return {
          ...stat,
          pregunta: question?.pregunta || 'Pregunta no encontrada',
          opciones: question?.opciones || [],
          respuesta_correcta: question?.respuesta_correcta || 0,
          tema: question?.tema || 0,
          categoria: question?.categoria || '',
          subtema: question?.subtema || null
        };
      });

      setQuestionStats(combined);
    } catch (err) {
      console.error('Error loading question stats:', err);
    } finally {
      setLoadingQuestionStats(false);
    }
  };

  // Filtrar preguntas según el filtro seleccionado
  const getFilteredQuestionStats = () => {
    switch (questionStatsFilter) {
      case 'correct':
        return questionStats.filter(q => q.times_correct > 0);
      case 'incorrect':
        return questionStats.filter(q => q.times_incorrect > 0);
      case 'skipped':
        return questionStats.filter(q => q.times_skipped > 0);
      default:
        return questionStats;
    }
  };

  // Load failed questions grouped by category
  const loadFailedQuestionsByCategory = async () => {
    const userId = teachableUserId || teachableUserEmail;
    if (!userId) return;

    setLoadingFailedQuestions(true);
    try {
      // Get question IDs that were failed
      const { data: statsData, error: statsError } = await supabase
        .from('user_question_stats')
        .select('question_id')
        .eq('user_id', userId)
        .gt('times_incorrect', 0);

      if (statsError) throw statsError;
      if (!statsData || statsData.length === 0) {
        setFailedQuestionsByCategory({});
        return;
      }

      const questionIds = statsData.map(s => s.question_id);

      // Get question details
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions_test')
        .select('id, pregunta, categoria, tema')
        .in('id', questionIds);

      if (questionsError) throw questionsError;

      // Group by category
      const grouped: {[key: string]: {id: number, pregunta: string, tema: string}[]} = {};
      (questionsData || []).forEach((q: any) => {
        const cat = q.categoria || 'Sin categoría';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({ id: q.id, pregunta: q.pregunta, tema: q.tema });
      });

      setFailedQuestionsByCategory(grouped);
      // Select all by default
      setSelectedFailedQuestions(questionIds);
    } catch (err) {
      console.error('Error loading failed questions:', err);
    } finally {
      setLoadingFailedQuestions(false);
    }
  };

  // Load skipped questions grouped by category
  const loadSkippedQuestionsByCategory = async () => {
    const userId = teachableUserId || teachableUserEmail;
    if (!userId) return;

    setLoadingSkippedQuestions(true);
    try {
      // Get question IDs that were skipped
      const { data: statsData, error: statsError } = await supabase
        .from('user_question_stats')
        .select('question_id')
        .eq('user_id', userId)
        .gt('times_skipped', 0);

      if (statsError) throw statsError;
      if (!statsData || statsData.length === 0) {
        setSkippedQuestionsByCategory({});
        return;
      }

      const questionIds = statsData.map(s => s.question_id);

      // Get question details
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions_test')
        .select('id, pregunta, categoria, tema')
        .in('id', questionIds);

      if (questionsError) throw questionsError;

      // Group by category
      const grouped: {[key: string]: {id: number, pregunta: string, tema: string}[]} = {};
      (questionsData || []).forEach((q: any) => {
        const cat = q.categoria || 'Sin categoría';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push({ id: q.id, pregunta: q.pregunta, tema: q.tema });
      });

      setSkippedQuestionsByCategory(grouped);
      // Select all by default
      setSelectedSkippedQuestions(questionIds);
    } catch (err) {
      console.error('Error loading skipped questions:', err);
    } finally {
      setLoadingSkippedQuestions(false);
    }
  };

  // Load questions when testType changes
  useEffect(() => {
    if (testType === 'falladas') {
      loadFailedQuestionsByCategory();
    } else if (testType === 'no_respondidas') {
      loadSkippedQuestionsByCategory();
    }
  }, [testType, teachableUserId, teachableUserEmail]);

  // Load flashcard decks when entering flashcardsHome screen
  useEffect(() => {
    const loadFlashcardDecks = async () => {
      const userId = teachableUserId || teachableUserEmail;
      if (!userId || screen !== 'flashcardsHome') return;

      setLoadingFlashcardDecks(true);
      try {
        const reports = await getUserGeneratedReports(userId, 'flashcards');
        setGeneratedReports(reports);
      } catch (err) {
        console.error('Error loading flashcard decks:', err);
      } finally {
        setLoadingFlashcardDecks(false);
      }
    };

    loadFlashcardDecks();
  }, [screen, teachableUserId, teachableUserEmail]);

  // Load leaderboard data
  const loadLeaderboard = async () => {
    setLoadingLeaderboard(true);
    const MIN_QUESTIONS = 20; // Mínimo de preguntas para entrar en el ranking
    const currentUserEmail = teachableUserEmail || '';

    try {
      // Obtener todos los registros usando paginación para evitar límite de 1000
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data: pageData, error: pageError } = await supabase
          .from('results_test')
          .select('teachable_user_email, teachable_user_name, correct_answers, incorrect_answers, score_standar, test_date, categoria')
          .order('test_date', { ascending: false })
          .range(from, to);

        if (pageError) throw pageError;

        if (pageData && pageData.length > 0) {
          allData = [...allData, ...pageData];
          page++;
          hasMore = pageData.length === pageSize; // Si devuelve menos de pageSize, no hay más
        } else {
          hasMore = false;
        }
      }

      const data = allData;

      console.log('📊 Leaderboard Debug:', {
        totalRecords: data?.length || 0,
        pages: page,
        firstRecord: data?.[0],
        lastRecord: data?.[data.length - 1]
      });

      if (!data || data.length === 0) {
        setAllQualifiedUsers([]);
        setUserLeaderboardPosition({ position: null, totalQuestions: 0, totalCorrect: 0, totalIncorrect: 0, avgScore: 0, wilsonScore: 0, meetsMinimum: false, totalParticipants: 0 });
        return;
      }

      // Group by user and calculate stats
      const userStatsMap: { [key: string]: {
        email: string;
        userName: string;
        totalTests: number;
        totalCorrect: number;
        totalIncorrect: number;
        totalScore: number;
        recentResults: number[]; // scores of recent tests
        categoryStats: { [category: string]: number }; // correct answers by category
      }} = {};

      data.forEach((result: any) => {
        const email = result.teachable_user_email;
        if (!userStatsMap[email]) {
          userStatsMap[email] = {
            email: email,
            userName: result.teachable_user_name || email.split('@')[0],
            totalTests: 0,
            totalCorrect: 0,
            totalIncorrect: 0,
            totalScore: 0,
            recentResults: [],
            categoryStats: {}
          };
        }

        userStatsMap[email].totalTests++;
        userStatsMap[email].totalCorrect += result.correct_answers || 0;
        userStatsMap[email].totalIncorrect += result.incorrect_answers || 0;
        userStatsMap[email].totalScore += (result.score_standar || 0) * 100;

        // Track correct answers by category
        const categoria = result.categoria || 'Sin categoría';
        if (!userStatsMap[email].categoryStats[categoria]) {
          userStatsMap[email].categoryStats[categoria] = 0;
        }
        userStatsMap[email].categoryStats[categoria] += result.correct_answers || 0;

        // Keep only last 5 results
        if (userStatsMap[email].recentResults.length < 5) {
          userStatsMap[email].recentResults.push((result.score_standar || 0) * 100);
        }
      });

      // Convert to array with all users (for position calculation)
      const allUsersData = Object.entries(userStatsMap)
        .map(([email, stats]) => {
          const totalQuestions = stats.totalCorrect + stats.totalIncorrect;
          const avgScore = stats.totalTests > 0 ? stats.totalScore / stats.totalTests : 0;
          const wilsonScore = calculateWilsonScore(stats.totalCorrect, totalQuestions);

          // Find the category with most correct answers
          let topCategory = 'N/A';
          let maxCorrect = 0;
          Object.entries(stats.categoryStats).forEach(([cat, correct]) => {
            if (correct > maxCorrect) {
              maxCorrect = correct;
              topCategory = cat;
            }
          });

          return {
            email: email,
            userName: stats.userName,
            totalTests: stats.totalTests,
            totalCorrect: stats.totalCorrect,
            totalIncorrect: stats.totalIncorrect,
            totalQuestions: totalQuestions,
            avgScore: avgScore,
            wilsonScore: wilsonScore,
            lastFiveResults: stats.recentResults.map(score =>
              score >= 50 ? 'correct' as const : score > 0 ? 'incorrect' as const : 'neutral' as const
            ),
            topCategory: topCategory
          };
        });

      // Filter users who meet the minimum requirement and sort by Wilson Score
      const qualifiedUsers = allUsersData
        .filter(user => user.totalQuestions >= MIN_QUESTIONS)
        .sort((a, b) => b.wilsonScore - a.wilsonScore); // Ordenar por Wilson Score

      console.log('📊 Leaderboard Users:', {
        totalUniqueUsers: allUsersData.length,
        qualifiedUsers: qualifiedUsers.length,
        currentUserEmail: currentUserEmail,
        top5: qualifiedUsers.slice(0, 5).map(u => ({
          email: u.email,
          avgScore: u.avgScore.toFixed(1),
          wilsonScore: u.wilsonScore.toFixed(1),
          questions: u.totalQuestions
        }))
      });

      // Find current user's position
      const currentUserData = allUsersData.find(u => u.email === currentUserEmail);
      const currentUserTotalQuestions = currentUserData ? currentUserData.totalQuestions : 0;
      const currentUserMeetsMinimum = currentUserTotalQuestions >= MIN_QUESTIONS;

      let currentUserPosition: number | null = null;
      if (currentUserMeetsMinimum && currentUserData) {
        currentUserPosition = qualifiedUsers.findIndex(u => u.email === currentUserEmail) + 1;
        if (currentUserPosition === 0) currentUserPosition = null;
      }

      setUserLeaderboardPosition({
        position: currentUserPosition,
        totalQuestions: currentUserTotalQuestions,
        totalCorrect: currentUserData?.totalCorrect || 0,
        totalIncorrect: currentUserData?.totalIncorrect || 0,
        avgScore: currentUserData?.avgScore || 0,
        wilsonScore: currentUserData?.wilsonScore || 0,
        meetsMinimum: currentUserMeetsMinimum,
        totalParticipants: qualifiedUsers.length
      });

      // Store ALL qualified users (sorting and top 10 selection happens in getTop10Leaderboard)
      const leaderboardEntries: LeaderboardEntry[] = qualifiedUsers
        .map((entry, index) => ({
          rank: index + 1,
          userName: entry.userName,
          totalTests: entry.totalTests,
          totalCorrect: entry.totalCorrect,
          totalIncorrect: entry.totalIncorrect,
          avgScore: entry.avgScore,
          wilsonScore: entry.wilsonScore,
          lastFiveResults: entry.lastFiveResults,
          topCategory: entry.topCategory
        }));

      setAllQualifiedUsers(leaderboardEntries);
    } catch (err) {
      console.error('Error loading leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Load leaderboard on mount
  useEffect(() => {
    loadLeaderboard();
  }, []);

  // Cronómetro
  useEffect(() => {
    let interval: number | null = null;

    if (screen === 'test' && !isPaused) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [screen, isPaused]);

  // Rotación de mensajes de carga al guardar resultados
  useEffect(() => {
    if (!savingResults) return;

    setLoadingMessage(0);
    const interval = setInterval(() => {
      setLoadingMessage(prev => (prev + 1) % 4);
    }, 2000);

    return () => clearInterval(interval);
  }, [savingResults]);

  const startTest = async () => {
    setLoading(true);
    setError(null);
    setScreen('loading');

    try {
      let allIds: { id: number }[] = [];

      // If in locked mode, force the locked oposicion, categoria and temas
      if (isLockedMode && lockedOposicion && lockedCategoria && selectedTemas.length > 0) {
        // Extraer solo los números de tema del array de objetos
        const temasNumeros = selectedTemas.map(t => t.tema);
        const { data, error } = await supabase
          .from('questions_test')
          .select('id')
          .eq('oposicion', lockedOposicion)
          .eq('categoria', lockedCategoria)
          .in('tema', temasNumeros);

        if (error) throw error;
        allIds = data || [];
      } else if (testType === 'categoria' && selectedTemas.length > 0) {
        // Nuevo formato: cada tema tiene oposicion, categoria y tema
        // Hacer queries separadas para cada combinación única y combinar resultados
        const uniqueIds = new Set<number>();

        for (const temaKey of selectedTemas) {
          const { data, error } = await supabase
            .from('questions_test')
            .select('id')
            .eq('oposicion', temaKey.oposicion)
            .eq('categoria', temaKey.categoria)
            .eq('tema', temaKey.tema);

          if (error) throw error;
          data?.forEach(item => uniqueIds.add(item.id));
        }

        allIds = Array.from(uniqueIds).map(id => ({ id }));
      } else if (testType === 'falladas') {
        // Modo preguntas falladas: usar las preguntas seleccionadas del acordeón
        if (!teachableUserId && !teachableUserEmail) {
          throw new Error('Debes estar registrado para usar este modo');
        }

        if (selectedFailedQuestions.length === 0) {
          throw new Error('Selecciona al menos una pregunta fallada para repasar');
        }

        allIds = selectedFailedQuestions.map(id => ({ id }));
      } else if (testType === 'no_respondidas') {
        // Modo preguntas no respondidas: usar las preguntas seleccionadas del acordeón
        if (!teachableUserId && !teachableUserEmail) {
          throw new Error('Debes estar registrado para usar este modo');
        }

        if (selectedSkippedQuestions.length === 0) {
          throw new Error('Selecciona al menos una pregunta en blanco para repasar');
        }

        allIds = selectedSkippedQuestions.map(id => ({ id }));
      } else {
        // Modo aleatorio: traer todos
        const { data, error } = await supabase
          .from('questions_test')
          .select('id');

        if (error) throw error;
        allIds = data || [];
      }

      // Step 1: Get IDs that match the filters (ya hecho arriba)
      const idsError = null; // Para mantener compatibilidad con el código siguiente

      if (idsError) throw idsError;
      if (!allIds || allIds.length === 0) {
        throw new Error('No se encontraron preguntas con los filtros seleccionados');
      }

      // Step 2: Shuffle and select N questions
      const totalQuestions = Math.min(numQuestions, allIds.length);
      const shuffledIds = [...allIds].sort(() => Math.random() - 0.5);
      const selectedIds = shuffledIds.slice(0, totalQuestions).map(item => item.id);

      // Step 3: Fetch the selected questions
      const { data, error: fetchError } = await supabase
        .from('questions_test')
        .select('*')
        .in('id', selectedIds);

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        throw new Error('No se pudieron cargar las preguntas seleccionadas');
      }

      // Transform data from Supabase format to app format
      const transformedData = data.map((q: any) => ({
        id: q.id,
        question: q.pregunta,
        options: q.opciones,
        correctAnswer: q.respuesta_correcta,
        explanation: q.explicacion_correcta,
        wrongExplanation: q.explicacion_errada,
        tema: q.tema,
        category: q.categoria,
        subtema: q.subtema
      }));

      // Shuffle again for good measure
      const finalShuffled = [...transformedData].sort(() => Math.random() - 0.5);

      setTestQuestions(finalShuffled);
      setUserAnswers({});
      setTimeElapsed(0);
      setScreen('test');
    } catch (err) {
      console.error('Error loading questions:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar las preguntas');
      setScreen('select');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (questionId: number, optionIndex: number) => {
    setUserAnswers(prev => {
      // Si ya está seleccionada la misma opción, deseleccionar
      if (prev[questionId] === optionIndex) {
        const newAnswers = { ...prev };
        delete newAnswers[questionId];
        return newAnswers;
      }
      // Si no, seleccionar la nueva opción
      return {
        ...prev,
        [questionId]: optionIndex
      };
    });
  };

  const handleTemaToggle = (oposicion: string, categoria: string, tema: number) => {
    setSelectedTemas(prev => {
      const exists = prev.some(t =>
        t.oposicion === oposicion && t.categoria === categoria && t.tema === tema
      );
      if (exists) {
        return prev.filter(t =>
          !(t.oposicion === oposicion && t.categoria === categoria && t.tema === tema)
        );
      } else {
        return [...prev, { oposicion, categoria, tema }];
      }
    });
  };

  // Helper para verificar si un tema está seleccionado
  const isTemaSelected = (oposicion: string, categoria: string, tema: number): boolean => {
    return selectedTemas.some(t =>
      t.oposicion === oposicion && t.categoria === categoria && t.tema === tema
    );
  };

  const handleExitTest = () => {
    if (window.confirm('¿Estás seguro de que quieres salir? Perderás todo el progreso.')) {
      restartApp();
    }
  };

  const handleFinishTest = async () => {
    // Mostrar pantalla de carga
    setSavingResults(true);

    // Calculate user's percentile/ranking
    await calculateUserPercentile();

    // Save results to Supabase if user comes from Teachable
    if (teachableUserId || teachableUserEmail) {
      await saveResultsToSupabase();
      await saveQuestionStats(); // Guardar estadísticas por pregunta
    }

    setSavingResults(false);
    setScreen('results');
  };

  const calculateUserPercentile = async () => {
    try {
      const answeredCount = Object.keys(userAnswers).length;
      const correctAnswers = testQuestions.filter(q =>
        userAnswers[q.id] !== undefined && userAnswers[q.id] === (q.correctAnswer - 1)
      ).length;
      const incorrectAnswers = testQuestions.filter(q =>
        userAnswers[q.id] !== undefined && userAnswers[q.id] !== (q.correctAnswer - 1)
      ).length;

      // Calculate current user's score
      const totalScore = (correctAnswers * 1) - (incorrectAnswers * 0.33);
      const maxPossibleScore = answeredCount * 1;
      const currentScoreStandar = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;

      // Get all scores from database
      const { data, error } = await supabase
        .from('results_test')
        .select('score_standar')
        .not('score_standar', 'is', null);

      if (error) throw error;

      if (!data || data.length === 0) {
        // First test ever, user is at 100%
        setUserPercentile(100);
        return;
      }

      // Count how many scores are lower than current user's score
      const lowerScores = data.filter(result => result.score_standar < currentScoreStandar).length;

      // Calculate percentile
      const percentile = ((lowerScores / data.length) * 100);

      setUserPercentile(Math.round(percentile));
    } catch (err) {
      console.error('Error calculating percentile:', err);
      setUserPercentile(null);
    }
  };

  const saveResultsToSupabase = async () => {
    try {
      const answeredCount = Object.keys(userAnswers).length;
      const correctAnswers = testQuestions.filter(q =>
        userAnswers[q.id] !== undefined && userAnswers[q.id] === (q.correctAnswer - 1)
      ).length;
      const incorrectAnswers = testQuestions.filter(q =>
        userAnswers[q.id] !== undefined && userAnswers[q.id] !== (q.correctAnswer - 1)
      ).length;

      // Calcular score bruto
      const totalScore = (correctAnswers * 1) - (incorrectAnswers * 0.33);

      // Calcular score normalizado
      const maxPossibleScore = answeredCount * 1;
      const scoreStandar = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;

      const resultData = {
        teachable_user_id: teachableUserId || teachableUserEmail || 'guest',
        teachable_user_email: teachableUserEmail || 'no-email',
        teachable_user_name: teachableUserName,
        num_questions: answeredCount,
        correct_answers: correctAnswers,
        incorrect_answers: incorrectAnswers,
        score: totalScore,
        score_standar: scoreStandar,
        time_spent_seconds: timeElapsed,
        tema: selectedTemas.length > 0 ? selectedTemas[0].tema : null,
        categoria: selectedTemas.length > 0 ? selectedTemas[0].categoria : (selectedCategories.length > 0 ? selectedCategories[0] : null),
        questions_answered: userAnswers
      };

      const { error } = await supabase
        .from('results_test')
        .insert([resultData]);

      if (error) {
        console.error('Error saving results:', error);
      } else {
        console.log('Results saved successfully!');
      }
    } catch (err) {
      console.error('Error in saveResultsToSupabase:', err);
    }
  };

  // Guardar estadísticas por pregunta (user_question_stats)
  const saveQuestionStats = async () => {
    const userId = teachableUserId || teachableUserEmail;
    if (!userId) return; // Solo guardar si hay usuario identificado

    try {
      for (const question of testQuestions) {
        const userAnswer = userAnswers[question.id];
        const wasAnswered = userAnswer !== undefined;
        const isCorrect = wasAnswered && userAnswer === (question.correctAnswer - 1);
        const isIncorrect = wasAnswered && userAnswer !== (question.correctAnswer - 1);
        const wasSkipped = !wasAnswered;

        // Intentar obtener el registro existente
        const { data: existing } = await supabase
          .from('user_question_stats')
          .select('id, times_seen, times_correct, times_incorrect, times_skipped')
          .eq('user_id', userId)
          .eq('question_id', question.id)
          .single();

        if (existing) {
          // Actualizar registro existente
          await supabase
            .from('user_question_stats')
            .update({
              times_seen: existing.times_seen + 1,
              times_correct: existing.times_correct + (isCorrect ? 1 : 0),
              times_incorrect: existing.times_incorrect + (isIncorrect ? 1 : 0),
              times_skipped: existing.times_skipped + (wasSkipped ? 1 : 0),
              last_seen_at: new Date().toISOString(),
              last_answer_correct: wasAnswered ? isCorrect : null,
              last_answer_given: wasAnswered ? userAnswer : null
            })
            .eq('id', existing.id);
        } else {
          // Crear nuevo registro
          await supabase
            .from('user_question_stats')
            .insert({
              user_id: userId,
              user_email: teachableUserEmail,
              question_id: question.id,
              times_seen: 1,
              times_correct: isCorrect ? 1 : 0,
              times_incorrect: isIncorrect ? 1 : 0,
              times_skipped: wasSkipped ? 1 : 0,
              last_seen_at: new Date().toISOString(),
              last_answer_correct: wasAnswered ? isCorrect : null,
              last_answer_given: wasAnswered ? userAnswer : null
            });
        }
      }
      console.log('Question stats saved successfully!');
    } catch (err) {
      console.error('Error saving question stats:', err);
    }
  };

  const restartApp = () => {
    setScreen('home');
    setNumQuestions(10);
    setTestQuestions([]);
    setUserAnswers({});
    setTimeElapsed(0);
    setIsPaused(false);
    setUserPercentile(null);
    setInfografiaUrl(null);
    setInfografiaError(null);
    setEmailSent(false);

    // If in locked mode, maintain the locked settings (already in selectedTemas)
    if (isLockedMode && lockedCategoria) {
      setTestType('categoria');
      // selectedTemas already contains the locked temas, no need to reset
    } else {
      setTestType('aleatorio');
      setSelectedCategories([]);
      setSelectedTemas([]);
    }
  };

  // =========== FUNCIONES DE AUDIO ===========

  const generateAudio = async () => {
    setGeneratingAudio(true);
    setAudioError(null);
    setAudioBase64(null);

    try {
      // Filtrar solo preguntas falladas, máximo 3
      const preguntasFalladas = testQuestions
        .filter(q => userAnswers[q.id] !== undefined && userAnswers[q.id] !== q.correctAnswer)
        .slice(0, 3);

      if (preguntasFalladas.length === 0) {
        setAudioError('No tienes fallos que analizar.');
        setGeneratingAudio(false);
        return;
      }

      const questionsData = preguntasFalladas.map(q => ({
        question: q.question,
        options: q.options,
        userAnswer: q.options[userAnswers[q.id]],
        correctAnswer: q.options[q.correctAnswer]
      }));

      const response = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: questionsData,
          userName: teachableUserName || undefined
        })
      });

      const data = await response.json();

      if (data.success && data.audioBase64) {
        setAudioBase64(data.audioBase64);
      } else {
        setAudioError(data.error || 'Error al generar el audio');
      }
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Error al generar el audio');
    } finally {
      setGeneratingAudio(false);
    }
  };

  // =========== FUNCIONES DE FLASHCARDS ===========

  // Generar flashcards a partir de las preguntas falladas
  const generateFlashcards = async () => {
    // Obtener preguntas falladas
    const preguntasFalladas = testQuestions.filter(q => {
      const userAnswer = userAnswers[q.id];
      return userAnswer !== undefined && userAnswer !== q.correctAnswer;
    });

    if (preguntasFalladas.length === 0) {
      setFlashcardsError('No hay preguntas falladas para generar flashcards');
      return;
    }

    setGeneratingFlashcards(true);
    setFlashcardsError(null);

    try {
      // Preparar los errores para el prompt
      const erroresParaAnalizar = preguntasFalladas.map((q, idx) => {
        const userAnswer = userAnswers[q.id];
        return `ERROR ${idx + 1}:
Pregunta: ${q.question}
Opciones: ${q.options.map((opt, i) => `${i + 1}) ${opt}`).join(' | ')}
Respuesta del alumno: ${userAnswer !== undefined ? q.options[userAnswer] : 'No respondió'}
Respuesta correcta: ${q.options[q.correctAnswer]}
Tema: ${q.tema} - ${q.category}`;
      }).join('\n\n');

      const prompt = `Genera flashcards de estudio para oposiciones españolas basándote en estos errores del alumno.

REGLAS ESTRICTAS:
- NO incluyas texto explicativo, saludos ni comentarios
- Responde SOLO con el JSON, nada más
- Genera exactamente 3 flashcards por cada error
- El anverso es una pregunta clara y concisa
- El reverso es la respuesta correcta
- NO preguntes por números de artículos exactos

ERRORES:
${erroresParaAnalizar}

RESPUESTA (solo JSON, sin texto adicional):
{"flashcards":[{"anverso":"pregunta aquí","reverso":"respuesta aquí"}]}`;

      const response = await fetch('/api/generate-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        throw new Error('Error al generar flashcards');
      }

      const data = await response.json();

      // Obtener el usuario actual
      const userId = teachableUserId || teachableUserEmail;
      const userEmail = teachableUserEmail || '';

      if (!userId) {
        throw new Error('Debes estar logueado para generar flashcards');
      }

      // Crear título para el mazo
      const categoria = testQuestions[0]?.category || 'General';
      const fecha = new Date().toLocaleDateString('es-ES');
      const deckTitle = `Flashcards - ${categoria} - ${fecha}`;

      // Guardar en la base de datos
      const { data: savedData, error: saveError } = await saveFlashcardDeck(
        userId,
        userEmail,
        deckTitle,
        data.flashcards,
        null // testResultId - podría pasarse si tenemos el ID del resultado del test
      );

      if (saveError || !savedData) {
        console.error('Error guardando flashcards:', saveError);
        // Aún así mostrar las flashcards generadas (modo offline)
        const tempFlashcards: Flashcard[] = data.flashcards.map((fc: { anverso: string; reverso: string }, idx: number) => ({
          id: `temp-${Date.now()}-${idx}`,
          user_id: userId,
          report_id: null,
          anverso: fc.anverso,
          reverso: fc.reverso,
          nivel: 0,
          repeticiones_correctas: 0,
          ultima_revision: null,
          proxima_revision: null,
          created_at: new Date().toISOString()
        }));
        setFlashcardsGenerated(tempFlashcards);
      } else {
        // Usar las flashcards guardadas con IDs reales
        setFlashcardsGenerated(savedData.flashcards);
        console.log(`✅ ${savedData.flashcards.length} flashcards guardadas en el mazo ${savedData.reportId}`);
      }

    } catch (err) {
      console.error('Error generating flashcards:', err);
      setFlashcardsError(err instanceof Error ? err.message : 'Error al generar las flashcards');
    } finally {
      setGeneratingFlashcards(false);
    }
  };

  // Iniciar estudio de flashcards generadas
  const startStudyingGeneratedFlashcards = () => {
    if (flashcardsGenerated.length > 0) {
      setStudyingFlashcards(flashcardsGenerated);
      setCurrentFlashcardIndex(0);
      setFlashcardFlipped(false);
      setFlashcardTotalInDeck(flashcardsGenerated.length);
      setScreen('flashcardStudy');
      window.scrollTo(0, 0);
    }
  };

  // Estudiar flashcards desde un mazo
  const studyFlashcardsFromDeck = async (reportId: string, materia?: string | null) => {
    // Obtener todas las tarjetas del mazo
    const { data: allCards, error: cardsError } = await supabase
      .from('flashcards')
      .select('*')
      .eq('report_id', reportId)
      .order('proxima_revision', { ascending: true });

    if (cardsError || !allCards || allCards.length === 0) {
      setNoPendingFlashcardsMessage('No se pudieron cargar las tarjetas.');
      setTimeout(() => setNoPendingFlashcardsMessage(null), 3000);
      return;
    }

    const now = new Date();
    const total = allCards.length;

    // Ordenar: primero las pendientes, luego las demas
    const sortedCards = allCards.sort((a, b) => {
      const aIsDue = !a.proxima_revision || new Date(a.proxima_revision) <= now;
      const bIsDue = !b.proxima_revision || new Date(b.proxima_revision) <= now;
      if (aIsDue && !bIsDue) return -1;
      if (!aIsDue && bIsDue) return 1;
      const dateA = a.proxima_revision ? new Date(a.proxima_revision).getTime() : 0;
      const dateB = b.proxima_revision ? new Date(b.proxima_revision).getTime() : 0;
      return dateA - dateB;
    });

    // Iniciar estudio
    setStudyingFlashcards(sortedCards as Flashcard[]);
    setCurrentFlashcardIndex(0);
    setFlashcardFlipped(false);
    if (reportId) setFlashcardReportId(reportId);
    if (materia) setFlashcardStudyMateria(materia);
    setFlashcardTotalInDeck(total);
    setNoPendingFlashcardsMessage(null);
    setScreen('flashcardStudy');
    window.scrollTo(0, 0);
  };

  // Manejar respuesta de flashcard
  const handleFlashcardResponse = async (nivel: number) => {
    const currentCard = studyingFlashcards[currentFlashcardIndex];

    // Actualizar en la BD si tiene ID real
    if (currentCard.id && !currentCard.id.startsWith('temp-')) {
      await updateFlashcardReview(currentCard.id, nivel);
    }

    // Pasar a la siguiente tarjeta
    if (currentFlashcardIndex < studyingFlashcards.length - 1) {
      setCurrentFlashcardIndex(prev => prev + 1);
      setFlashcardFlipped(false);
    } else {
      // Fin del estudio - volver a resultados
      setScreen('results');
      setStudyingFlashcards([]);
      setCurrentFlashcardIndex(0);
      setFlashcardFlipped(false);
    }
  };

  // =========== FIN FUNCIONES DE FLASHCARDS ===========

  // Funciones disponibles para uso futuro (mazos guardados)
  void studyFlashcardsFromDeck;
  void setGeneratedReports;

  // =========== FUNCIÓN PARA AGREGAR LOGO A IMAGEN ===========
  const addLogoToImage = async (imageDataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageDataUrl); // Si no hay contexto, devolver imagen original
        return;
      }

      const mainImage = new Image();
      const logoImage = new Image();

      mainImage.onload = () => {
        // Configurar canvas con el tamaño de la imagen principal
        canvas.width = mainImage.width;
        canvas.height = mainImage.height;

        // Dibujar imagen principal
        ctx.drawImage(mainImage, 0, 0);

        // Cargar y dibujar logo
        logoImage.onload = () => {
          // Configuración del círculo con logo - ESQUINA SUPERIOR IZQUIERDA
          const circleRadius = Math.min(canvas.width, canvas.height) * 0.05; // 5% del tamaño menor
          const padding = circleRadius * 0.6;
          const centerX = circleRadius + padding;
          const centerY = circleRadius + padding;

          // Dibujar círculo blanco de fondo
          ctx.beginPath();
          ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
          ctx.fillStyle = 'white';
          ctx.fill();

          // Dibujar borde café
          ctx.strokeStyle = '#8B7355';
          ctx.lineWidth = circleRadius * 0.08;
          ctx.stroke();

          // Dibujar logo dentro del círculo
          const logoSize = circleRadius * 1.4;
          const logoX = centerX - logoSize / 2;
          const logoY = centerY - logoSize / 2;
          ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);

          // Convertir canvas a base64
          resolve(canvas.toDataURL('image/png'));
        };

        logoImage.onerror = () => {
          // Si el logo falla, devolver imagen original
          resolve(imageDataUrl);
        };

        logoImage.src = '/logo-empresa.png';
      };

      mainImage.onerror = () => {
        reject(new Error('Error al cargar la imagen'));
      };

      mainImage.src = imageDataUrl;
    });
  };

  // =========== INFOGRAFÍA FUNCTION ===========
  const generateInfografia = async () => {
    setGeneratingInfografia(true);
    setInfografiaError(null);
    setInfografiaUrl(null);
    setEmailSent(false);

    try {
      // Obtener solo las preguntas falladas (máximo 6 para mejor calidad)
      const preguntasFalladas = testQuestions
        .filter(q => userAnswers[q.id] !== undefined && userAnswers[q.id] !== (q.correctAnswer - 1))
        .slice(0, 6);

      // Si no hay fallos, mostrar mensaje de éxito
      if (preguntasFalladas.length === 0) {
        setInfografiaError('¡Felicidades! No tienes fallos que analizar. ¡Perfecto!');
        setGeneratingInfografia(false);
        return;
      }

      const analisisFallos = preguntasFalladas.map((q, idx) => {
        const respuestaUsuario = q.options[userAnswers[q.id]];
        const respuestaCorrecta = q.options[q.correctAnswer - 1];
        return `ERROR ${idx + 1}:
- Pregunta: "${q.question.substring(0, 50)}..."
- Respondiste: "${respuestaUsuario.substring(0, 30)}..."
- Correcta: "${respuestaCorrecta.substring(0, 30)}..."`;
      }).join('\n\n');

      const estructuraLayout = preguntasFalladas.length <= 3
        ? `- Divide la imagen en ${preguntasFalladas.length} COLUMNAS principales, una por cada error.`
        : `- Organiza los ${preguntasFalladas.length} errores en 2 FILAS: ${Math.ceil(preguntasFalladas.length / 2)} arriba y ${Math.floor(preguntasFalladas.length / 2)} abajo.`;

      const prompt = `Actúa como un preparador de oposiciones implacable pero útil y diseñador de infografías.
Genera una INFOGRAFÍA HORIZONTAL (formato panorámico 16:9).

TÍTULO PRINCIPAL:
- DEBE SER CORTO: máximo 4-5 palabras
- Ejemplos: "Tus ${preguntasFalladas.length} Errores Clave", "¡Ojo con Esto!", "Puntos Débiles"
- CENTRADO en la parte superior
- IMPORTANTE: Dejar ESPACIO LIBRE en la esquina superior izquierda (ahí irá un logo)

ESTRUCTURA HORIZONTAL (de izquierda a derecha):
${estructuraLayout}
- Cada sección contiene: icono/ilustración arriba, texto debajo.
- Usa un flujo visual con flechas o conectores entre secciones.
- Si hay más de 3 errores, usa un diseño en GRID de 2 filas para que todo sea legible.

ERRORES A ANALIZAR:
${analisisFallos}

CONTENIDO POR CADA ERROR:
- TÍTULO del error (concepto fallado) con icono ilustrativo
- "¡Ojo!": El concepto exacto donde fallaste
- "La trampa": El detalle que no viste
- "Recuerda": Truco o consejo visual rápido

ESTILO VISUAL:
- Formato HORIZONTAL PANORÁMICO (16:9 o más ancho).
- Fondo con degradado suave (beige/crema profesional).
- Cada sección con su propia ilustración/icono representativo del tema.
- Colores: Rojo/Naranja para errores, Verde/Azul para soluciones.
- Texto en ESPAÑOL, directo y coloquial ("Cuidado con esto", "Que no se te pase", "Fíjate bien").
- Usa flechas, círculos rodeando palabras clave y señales de advertencia.
- Iconos y pequeñas ilustraciones para cada concepto.
- Estilo tipo "Esquema Táctico" o "Apuntes Corregidos".
- TODO EL TEXTO DEBE SER COMPLETAMENTE LEGIBLE, sin cortes.
- Usa tipografía clara, tamaño adecuado y jerarquía visual.
- IMPORTANTE: Asegúrate de incluir TODOS los ${preguntasFalladas.length} errores en la infografía.
- IMPORTANTE: El título debe estar CENTRADO y dejar espacio libre en la esquina superior izquierda.`;

      // Usar Google Gemini 3 Pro Image API directamente
      // La API key se obtiene de variable de entorno o usa fallback
      const GEMINI_API_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || 'AIzaSyClZNwHI2CiE_4be0UIS4bgBiF9z1UpieM';

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

      // Buscar la imagen en la respuesta
      const parts = data.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((part: any) => part.inlineData);

      if (imagePart && imagePart.inlineData) {
        const base64Image = imagePart.inlineData.data;
        const mimeType = imagePart.inlineData.mimeType || 'image/png';

        // Superponer logo de la empresa en la esquina inferior derecha
        const finalImage = await addLogoToImage(`data:${mimeType};base64,${base64Image}`);
        setInfografiaUrl(finalImage);

        // Enviar automáticamente al email en segundo plano (fire-and-forget)
        if (teachableUserEmail) {
          // No esperamos la respuesta, se ejecuta en segundo plano
          fetch('/api/send-infografia-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: teachableUserEmail,
              imageBase64: finalImage,
              userName: teachableUserName || undefined,
            }),
          })
            .then((res) => res.json())
            .then(() => {
              setEmailSent(true);
              console.log('✅ Infografía enviada al email automáticamente');
            })
            .catch((emailErr) => {
              console.error('Error enviando email automáticamente:', emailErr);
              // No mostramos error al usuario, ya tiene la imagen visible
            });
        }
      } else {
        throw new Error('No se pudo generar la imagen');
      }
    } catch (err) {
      console.error('Error generating infografia:', err);
      setInfografiaError(err instanceof Error ? err.message : 'Error al generar la infografía');
    } finally {
      setGeneratingInfografia(false);
    }
  };

  const downloadInfografia = async () => {
    if (!infografiaUrl) return;

    try {
      // Fetch la imagen y convertir a blob para descargar
      const response = await fetch(infografiaUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `infografia-test-${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Limpiar el blob URL
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      // Fallback: abrir en nueva pestaña
      window.open(infografiaUrl, '_blank');
    }
  };

  // =========== REPORT PDF FUNCTIONS ===========

  const generateReport = async () => {
    setGeneratingReport(true);
    setReportError(null);
    setReportSent(false);
    setReportPdfBase64(null);
    setReportEmailFailed(false);

    // Scroll automático a la sección del informe
    setTimeout(() => {
      const reportSection = document.getElementById('report-section');
      if (reportSection) {
        reportSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    try {
      // Obtener email del usuario (de Teachable)
      const userEmail = teachableUserEmail;
      const userName = teachableUserName;

      if (!userEmail) {
        setReportError('Necesitas iniciar sesión para generar el informe.');
        setGeneratingReport(false);
        return;
      }

      // Obtener solo las preguntas falladas (máximo 5 para evitar timeout)
      const preguntasFalladas = testQuestions
        .filter(q => userAnswers[q.id] !== undefined && userAnswers[q.id] !== (q.correctAnswer - 1))
        .slice(0, 5);

      // Si no hay fallos, mostrar mensaje de éxito
      if (preguntasFalladas.length === 0) {
        setReportError('¡Felicidades! No tienes fallos que analizar. ¡Perfecto!');
        setGeneratingReport(false);
        return;
      }

      // Formatear preguntas para el API
      const questionsData = preguntasFalladas.map(q => ({
        question: q.question,
        options: q.options,
        userAnswer: q.options[userAnswers[q.id]],
        correctAnswer: q.options[q.correctAnswer - 1]
      }));

      const response = await fetch('/api/generate-report-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: questionsData,
          userEmail: userEmail,
          userName: userName || undefined
        })
      });

      const data = await response.json();

      if (data.success) {
        setReportSent(true);
        // Guardar PDF para descarga
        if (data.pdfBase64) {
          setReportPdfBase64(data.pdfBase64);
        }
        // Marcar si el email falló
        if (!data.emailSent) {
          setReportEmailFailed(true);
        }
      } else {
        setReportError(data.error || 'Error al generar el informe');
      }
    } catch (err) {
      console.error('Error generating report:', err);
      setReportError(err instanceof Error ? err.message : 'Error al generar el informe');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Función para descargar el PDF
  const downloadReportPdf = () => {
    if (!reportPdfBase64) {
      console.error('No hay PDF para descargar');
      return;
    }

    try {
      // Usar data URL directamente (más robusto)
      const dataUrl = `data:application/pdf;base64,${reportPdfBase64}`;

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `informe-estudio-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error descargando PDF:', err);
      // Fallback: abrir en nueva pestaña
      try {
        const dataUrl = `data:application/pdf;base64,${reportPdfBase64}`;
        window.open(dataUrl, '_blank');
      } catch {
        alert('Error al descargar el PDF. Por favor, inténtalo de nuevo.');
      }
    }
  };

  // =========== ADMIN FUNCTIONS ===========

  const handleAdminLogin = () => {
    // Simple password check - replace with secure method in production
    if (adminPassword === 'justicia2025') {
      setAdminAuthenticated(true);
    } else {
      alert('Contraseña incorrecta');
    }
  };

  /* FUNCIONES NO USADAS - COMENTADAS PARA SIMPLIFICAR EL ADMIN PANEL
  const parseTextFile = (content: string): ParsedQuestion[] => {
    const questions: ParsedQuestion[] = [];
    const lines = content.split('\n').filter(line => line.trim() !== '');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detect question start (e.g., "PREGUNTA:")
      if (line.startsWith('PREGUNTA:')) {
        const pregunta = line.replace('PREGUNTA:', '').trim();
        const opciones: string[] = [];
        let respuesta_correcta = 0;
        let explicacion_correcta = '';
        let explicacion_errada = '';
        let tema = 1;
        let categoria = 'General';

        // Parse options
        i++;
        while (i < lines.length && lines[i].startsWith('OPCION:')) {
          opciones.push(lines[i].replace('OPCION:', '').trim());
          i++;
        }

        // Parse correct answer
        if (i < lines.length && lines[i].startsWith('RESPUESTA_CORRECTA:')) {
          respuesta_correcta = parseInt(lines[i].replace('RESPUESTA_CORRECTA:', '').trim());
          i++;
        }

        // Parse correct explanation
        if (i < lines.length && lines[i].startsWith('EXPLICACION_CORRECTA:')) {
          explicacion_correcta = lines[i].replace('EXPLICACION_CORRECTA:', '').trim();
          i++;
        }

        // Parse wrong explanation
        if (i < lines.length && lines[i].startsWith('EXPLICACION_ERRADA:')) {
          explicacion_errada = lines[i].replace('EXPLICACION_ERRADA:', '').trim();
          i++;
        }

        // Parse tema
        if (i < lines.length && lines[i].startsWith('TEMA:')) {
          tema = parseInt(lines[i].replace('TEMA:', '').trim());
          i++;
        }

        // Parse categoria
        if (i < lines.length && lines[i].startsWith('CATEGORIA:')) {
          categoria = lines[i].replace('CATEGORIA:', '').trim();
          i++;
        }

        // Add question if valid
        if (pregunta && opciones.length >= 2) {
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

        i--; // Adjust for next iteration
      }
    }

    return questions;
  };
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploadProgress('Leyendo archivos...');
    const allParsedQuestions: ParsedQuestion[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        const text = await file.text();
        const parsed = parseTextFile(text);
        allParsedQuestions.push(...parsed);
      } catch (err) {
        console.error(`Error reading file ${file.name}:`, err);
      }
    }

    setParsedQuestions(allParsedQuestions);
    setUploadProgress(`${allParsedQuestions.length} preguntas parseadas de ${files.length} archivo(s)`);
  };
  const handleConfirmUpload = async () => {
    if (parsedQuestions.length === 0) {
      alert('No hay preguntas para subir');
      return;
    }

    if (!window.confirm(`¿Estás seguro de subir ${parsedQuestions.length} preguntas a la base de datos?`)) {
      return;
    }

    setUploading(true);
    setUploadProgress('Subiendo preguntas...');

    try {
      // Transform to database format
      const dbQuestions = parsedQuestions.map(q => ({
        pregunta: q.pregunta,
        opciones: q.opciones,
        respuesta_correcta: q.respuesta_correcta,
        explicacion_correcta: q.explicacion_correcta,
        explicacion_errada: q.explicacion_errada,
        tema: q.tema,
        categoria: q.categoria
      }));

      // Upload in batches of 100
      const batchSize = 100;
      let uploaded = 0;

      for (let i = 0; i < dbQuestions.length; i += batchSize) {
        const batch = dbQuestions.slice(i, i + batchSize);

        const { error } = await supabase
          .from('questions_test')
          .insert(batch);

        if (error) throw error;

        uploaded += batch.length;
        setUploadProgress(`Subidas ${uploaded}/${dbQuestions.length} preguntas...`);
      }

      setUploadProgress(`✓ ${uploaded} preguntas subidas exitosamente`);
      alert('¡Preguntas subidas exitosamente!');

      // Reset
      setParsedQuestions([]);
    } catch (err) {
      console.error('Error uploading questions:', err);
      setUploadProgress('Error al subir preguntas');
      alert('Error al subir preguntas. Ver consola.');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    handleFileUpload(files);
  };

  // =========== STORAGE FUNCTIONS ===========

  // Sanitize file path for Supabase Storage (no spaces, no special chars)
  const sanitizePath = (path: string): string => {
    return path
      // Remove accents/tildes
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Replace spaces with hyphens
      .replace(/\s+/g, '-')
      // Remove invalid characters
      .replace(/[^\w\-/.]/g, '')
      // Replace multiple hyphens with single
      .replace(/-+/g, '-');
  };

  const uploadToStorage = async (files: FileList | null, preserveStructure: boolean = false) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress('Subiendo archivos a Storage...');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Preserve folder structure if uploading a directory
        let filePath: string;

        if (preserveStructure && file.webkitRelativePath) {
          // Use the relative path from the folder
          filePath = `${selectedFolder}/${file.webkitRelativePath}`;
        } else {
          // Simple upload to selected folder
          filePath = `${selectedFolder}/${file.name}`;
        }

        // Sanitize the path (remove spaces, tildes, special chars)
        const sanitizedPath = sanitizePath(filePath);

        const { error } = await supabase.storage
          .from('Tests')
          .upload(sanitizedPath, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (error) {
          console.error(`Error subiendo ${file.name}:`, error);
          setUploadProgress(`Error subiendo ${file.name}: ${error.message}`);
        } else {
          setUploadProgress(`✓ ${sanitizedPath} subido correctamente`);
        }
      }

      setUploadProgress(`✓ ${files.length} archivo(s) subido(s) exitosamente`);
      await listStorageFiles();
    } catch (err) {
      console.error('Error uploading to storage:', err);
      setUploadProgress('Error al subir archivos');
    } finally {
      setUploading(false);
    }
  };

  const listStorageFiles = async () => {
    try {
      const { error } = await supabase.storage
        .from('Tests')
        .list('', {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) throw error;

      // Recursively list all files in subdirectories
      const allFiles: any[] = [];

      const listRecursive = async (path: string = '') => {
        const { data: items, error: err } = await supabase.storage
          .from('Tests')
          .list(path, {
            limit: 1000,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' }
          });

        if (err) throw err;

        for (const item of items || []) {
          const fullPath = path ? `${path}/${item.name}` : item.name;

          if (item.id) {
            // It's a file
            allFiles.push({
              ...item,
              fullPath: fullPath
            });
          } else {
            // It's a folder, recurse
            await listRecursive(fullPath);
          }
        }
      };

      await listRecursive();
      setStorageFiles(allFiles.filter(f => f.name.endsWith('.txt')));
    } catch (err) {
      console.error('Error listing storage files:', err);
    }
  };

  const deleteFromStorage = async (filePath: string) => {
    if (!window.confirm(`¿Estás seguro de eliminar ${filePath}?`)) {
      return;
    }

    try {
      const { error } = await supabase.storage
        .from('Tests')
        .remove([filePath]);

      if (error) throw error;

      setUploadProgress(`✓ ${filePath} eliminado`);
      await listStorageFiles();
    } catch (err) {
      console.error('Error deleting file:', err);
      setUploadProgress(`Error eliminando archivo`);
    }
  };
  FIN FUNCIONES NO USADAS */

  // =========== SYNC FROM STORAGE FUNCTION (ACTIVE) ===========
  const syncFromStorage = async () => {
    setSyncing(true);
    setSyncLogs(['🔄 Iniciando sincronización con Edge Function...']);

    try {
      // Invoke Supabase Edge Function para sincronizar
      const { data, error } = await supabase.functions.invoke('sync-storage-questions');

      if (error) {
        setSyncLogs(prev => [...prev, `❌ Error invocando función: ${error.message}`]);
        throw error;
      }

      // Mostrar los logs que devuelve la Edge Function
      if (data && data.logs) {
        setSyncLogs(prev => [...prev, ...data.logs]);
      }

      // Mostrar resumen
      if (data && data.success) {
        setSyncLogs(prev => [
          ...prev,
          '',
          '📊 Resumen de la sincronización:',
          `   • Total archivos encontrados: ${data.totalFiles}`,
          `   • Archivos procesados: ${data.filesProcessed}`,
          `   • Archivos con errores: ${data.filesWithErrors}`,
          `   • Total preguntas sincronizadas: ${data.totalQuestionsProcessed}`,
          '',
          '✅ Sincronización completada exitosamente'
        ]);
      }
    } catch (err: any) {
      console.error('Error syncing from storage:', err);
      setSyncLogs(prev => [
        ...prev,
        '',
        `❌ Error: ${err.message || err}`,
        '',
        '⚠️  Asegúrate de que la Edge Function esté desplegada en Supabase.',
        '📖 Lee el archivo supabase/README.md para instrucciones de despliegue.'
      ]);
    } finally {
      setSyncing(false);
    }
  };

  // =========== IFRAME GENERATOR FUNCTIONS ===========
  const loadIframeCategories = async () => {
    try {
      // Use RPC function for efficient loading (no limit issues) - NOW WITH 3 LEVELS
      const { data, error } = await supabase
        .rpc('get_distinct_oposicion_categoria_tema');

      if (error) {
        console.error('Error loading oposiciones for iframe:', error);
        return;
      }

      // Group temas by oposicion -> categoria (3 levels)
      const oposicionMap: OposicionData = {};

      data?.forEach((item: any) => {
        const oposicion = item.oposicion || 'General';
        const categoria = item.categoria || 'General';

        // Inicializar oposicion si no existe
        if (!oposicionMap[oposicion]) {
          oposicionMap[oposicion] = {};
        }

        // Inicializar categoria dentro de oposicion si no existe
        if (!oposicionMap[oposicion][categoria]) {
          oposicionMap[oposicion][categoria] = [];
        }

        // Añadir tema con subtema
        oposicionMap[oposicion][categoria].push({
          tema: item.tema,
          subtema: item.subtema
        });
      });

      // Sort temas within each categoria
      Object.keys(oposicionMap).forEach(opos => {
        Object.keys(oposicionMap[opos]).forEach(cat => {
          oposicionMap[opos][cat].sort((a, b) => a.tema - b.tema);
        });
      });

      setIframeOposiciones(oposicionMap);
    } catch (err) {
      console.error('Error in loadIframeCategories:', err);
    }
  };

  const generateIframe = () => {
    if (!iframeOposicion || !iframeCategoria || iframeTemas.length === 0) {
      alert('Por favor selecciona una oposición, categoría y al menos un tema');
      return;
    }

    // Generate JavaScript code that dynamically gets user info from Teachable
    const productionUrl = 'https://test-oposiciones-justicia.vercel.app';
    const encodedOposicion = encodeURIComponent(iframeOposicion);
    const encodedCategoria = encodeURIComponent(iframeCategoria);
    const temasString = iframeTemas.sort((a, b) => a - b).join(',');
    const containerId = iframeTemas.length === 1 ? `test-container-tema-${iframeTemas[0]}` : `test-container-temas-${temasString.replace(/,/g, '-')}`;

    const iframeCode = `<div id="${containerId}" style="width: 100%; max-width: 100%; padding: 0; margin: 0;"></div>

<script>
(function() {
  // Obtener datos del usuario actual de Teachable
  var userId = '';
  var userEmail = '';
  var userName = '';

  try {
    // Teachable expone currentUser() en JavaScript
    if (typeof currentUser === 'function') {
      var user = currentUser();
      userId = user.id || '';
      userEmail = user.email || '';
      userName = user.name || user.username || '';
    }
  } catch (e) {
    console.log('No se pudo obtener datos del usuario:', e);
  }

  // Si no hay usuario, usar valores por defecto
  if (!userId && !userEmail) {
    userId = 'guest';
    userEmail = 'guest@teachable.com';
    userName = 'Invitado';
  }

  // Crear la URL con los parámetros (modo bloqueado + user data + 3 niveles)
  var baseUrl = '${productionUrl}';
  var params = '?modo=bloqueado' +
               '&oposicion=${encodedOposicion}' +
               '&categoria=${encodedCategoria}' +
               '&temas=${temasString}' +
               '&user_id=' + encodeURIComponent(userId) +
               '&user_email=' + encodeURIComponent(userEmail) +
               '&user_name=' + encodeURIComponent(userName);

  var iframeSrc = baseUrl + params;

  // Crear el iframe
  var iframe = document.createElement('iframe');
  iframe.src = iframeSrc;
  iframe.style.maxWidth = '100%';
  iframe.style.width = '100vw';
  iframe.height = '1200px';
  iframe.frameBorder = '0';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '8px';
  iframe.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
  iframe.setAttribute('allow', 'fullscreen');

  // Insertar el iframe en el contenedor
  var container = document.getElementById('${containerId}');
  if (container) {
    container.appendChild(iframe);
  }

  // Debug: mostrar en consola
  console.log('Test Oposición: ${encodedOposicion}, Categoría: ${encodedCategoria}, Temas: [${temasString}]', {
    id: userId,
    email: userEmail,
    name: userName,
    url: iframeSrc
  });
})();
<\/script>`;

    setGeneratedIframe(iframeCode);
  };

  const copyIframeToClipboard = () => {
    if (!generatedIframe) {
      alert('Primero genera un script');
      return;
    }

    navigator.clipboard.writeText(generatedIframe).then(() => {
      alert('✓ Script copiado al portapapeles. Pégalo en el editor HTML de Teachable.');
    }).catch(err => {
      console.error('Error copying to clipboard:', err);
      alert('Error al copiar. Intenta copiar manualmente.');
    });
  };

  // Calculate statistics
  const answeredCount = Object.keys(userAnswers).length;
  const correctAnswers = testQuestions.filter(q =>
    userAnswers[q.id] !== undefined && userAnswers[q.id] === (q.correctAnswer - 1)
  ).length;
  const incorrectAnswers = testQuestions.filter(q =>
    userAnswers[q.id] !== undefined && userAnswers[q.id] !== (q.correctAnswer - 1)
  ).length;

  // Calculate score: +1 for correct, -0.33 for incorrect
  const totalScore = (correctAnswers * 1) - (incorrectAnswers * 0.33);
  const maxPossibleScore = answeredCount * 1;

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="app-container">
      {/* Pantalla de inicio */}
      {screen === 'home' && (
        <div className="screen home-screen">
          <div className="home-icon">
            <div style={{
              width: '180px',
              height: '180px',
              backgroundColor: 'white',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '35px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}>
              <img
                src="/logo.png"
                alt="Derecho Virtual Logo"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
            </div>
          </div>
          <h1>Test Derecho Virtual</h1>
          <p className="subtitle">Practica con preguntas específicas para prepararte para tus exámenes</p>
          {(teachableUserId || teachableUserEmail) && (
            <div className="teachable-welcome">
              ✓ Bienvenido, {teachableUserName || teachableUserEmail}
              <br />
              <small>Tus resultados se guardarán automáticamente</small>
            </div>
          )}
          <div className="home-buttons">
            <button className="primary-button" onClick={() => setScreen('select')}>
              Quiero hacer un test
            </button>
            {(teachableUserId || teachableUserEmail) && (
              <button className="secondary-button icon-button" onClick={loadUserStats} disabled={loadingStats}>
                <span className="button-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="12" width="4" height="9" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="10" y="8" width="4" height="13" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="17" y="4" width="4" height="17" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </span>
                {loadingStats ? 'Cargando...' : 'Ver Mis Estadísticas'}
              </button>
            )}
            <button className="secondary-button icon-button" onClick={() => { loadLeaderboard(); setScreen('leaderboard'); }}>
              <span className="button-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 15C15.866 15 19 11.866 19 8V3H5V8C5 11.866 8.13401 15 12 15Z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M5 3H3V6C3 7.65685 4.34315 9 6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M19 3H21V6C21 7.65685 19.6569 9 18 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M12 15V18" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 21H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M12 18V21" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </span>
              Mejores Alumnos
            </button>
            {(teachableUserId || teachableUserEmail) && (
              <button className="secondary-button icon-button flashcards-home-btn" onClick={() => setScreen('flashcardsHome')}>
                <span className="button-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="6" y="8" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </span>
                Mis Flashcards
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pantalla de carga */}
      {screen === 'loading' && (
        <div className="screen loading-screen">
          <div className="loading-spinner"></div>
          <p className="loading-text">Cargando preguntas...</p>
        </div>
      )}

      {/* Pantalla de selección de preguntas */}
      {screen === 'select' && (
        <div className="screen select-screen">
          <h2>Configurar Test</h2>
          {error && (
            <div className="error-message">
              <p>⚠️ {error}</p>
            </div>
          )}

          {/* Locked mode indicator */}
          {isLockedMode && lockedCategoria && selectedTemas.length > 0 && (
            <div className="locked-mode-indicator">
              <div className="locked-mode-header">
                <span className="locked-mode-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 11V7a4 4 0 118 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </span>
                <h3>Test de {selectedTemas.length === 1 ? `Tema ${selectedTemas[0].tema}` : `${selectedTemas.length} Temas`}</h3>
              </div>
              <p className="locked-mode-category">Categoría: {lockedCategoria}</p>
              {selectedTemas.length > 1 && (
                <p className="locked-mode-temas">Temas incluidos: {[...selectedTemas].sort((a, b) => a.tema - b.tema).map(t => t.tema).join(', ')}</p>
              )}
              <p className="locked-mode-hint">Ajusta el número de preguntas y comienza cuando estés listo</p>
            </div>
          )}

          {/* Número de preguntas */}
          <div className="question-counter-container">
            <p className="question-counter-label">¿De cuántas preguntas quieres hacer el test?</p>
            <div className="question-counter">
              <button
                className="counter-btn"
                onClick={() => setNumQuestions(Math.max(10, numQuestions - 5))}
                disabled={loading || numQuestions <= 10}
              >
                −
              </button>
              <span className="counter-value">{numQuestions}</span>
              <button
                className="counter-btn"
                onClick={() => setNumQuestions(Math.min(100, numQuestions + 5))}
                disabled={loading || numQuestions >= 100}
              >
                +
              </button>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              className="slider-modern"
              disabled={loading}
            />
          </div>

          {/* Tipo de test - OCULTO EN MODO BLOQUEADO */}
          {!isLockedMode && (
            <div className="test-type-container">
              <h3>Tipo de Test</h3>
              <div className="test-modes-section">
                <div
                  className={`review-mode-card ${testType === 'aleatorio' ? 'active' : ''}`}
                  onClick={() => setTestType('aleatorio')}
                >
                  <div className="review-mode-icon svg-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                      <circle cx="16" cy="16" r="1.5" fill="currentColor"/>
                      <circle cx="16" cy="8" r="1.5" fill="currentColor"/>
                      <circle cx="8" cy="16" r="1.5" fill="currentColor"/>
                    </svg>
                  </div>
                  <div className="review-mode-content">
                    <h4 className="review-mode-title">Aleatorio</h4>
                    <p className="review-mode-description">Preguntas aleatorias de todos los temas disponibles.</p>
                  </div>
                </div>
                <div
                  className={`review-mode-card ${testType === 'categoria' ? 'active' : ''}`}
                  onClick={() => setTestType('categoria')}
                >
                  <div className="review-mode-icon svg-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                      <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <div className="review-mode-content">
                    <h4 className="review-mode-title">Por Categoría/Tema</h4>
                    <p className="review-mode-description">Selecciona los temas específicos que quieres practicar.</p>
                  </div>
                </div>
              </div>

              {/* Modos de repaso - Solo para usuarios registrados */}
              {(teachableUserId || teachableUserEmail) && (
                <div className="review-modes-section">
                  <div
                    className={`review-mode-card ${testType === 'falladas' ? 'active' : ''}`}
                    onClick={() => setTestType('falladas')}
                  >
                    <div className="review-mode-icon svg-icon failed">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M15 9L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M9 9L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div className="review-mode-content">
                      <h4 className="review-mode-title">Preguntas falladas</h4>
                      <p className="review-mode-description">Repasa tus preguntas falladas y comprueba si ya las dominas.</p>
                    </div>
                  </div>
                  <div
                    className={`review-mode-card ${testType === 'no_respondidas' ? 'active' : ''}`}
                    onClick={() => setTestType('no_respondidas')}
                  >
                    <div className="review-mode-icon svg-icon blank">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </div>
                    <div className="review-mode-content">
                      <h4 className="review-mode-title">Preguntas en blanco</h4>
                      <p className="review-mode-description">¿Serás capaz de contestar las preguntas que has dejado en blanco?</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Acordeón de Preguntas Falladas */}
          {testType === 'falladas' && (teachableUserId || teachableUserEmail) && (
            <div className="category-selection-new">
              <h3>Selecciona las preguntas falladas que quieres repasar</h3>
              {loadingFailedQuestions ? (
                <p className="loading-text">Cargando preguntas falladas...</p>
              ) : Object.keys(failedQuestionsByCategory).length === 0 ? (
                <p className="no-questions-text">¡No tienes preguntas falladas! ¡Buen trabajo!</p>
              ) : (
                <>
                  <div className="select-all-container">
                    <label className="select-all-label">
                      <input
                        type="checkbox"
                        checked={selectedFailedQuestions.length === Object.values(failedQuestionsByCategory).flat().length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFailedQuestions(Object.values(failedQuestionsByCategory).flat().map(q => q.id));
                          } else {
                            setSelectedFailedQuestions([]);
                          }
                        }}
                      />
                      Seleccionar todas ({Object.values(failedQuestionsByCategory).flat().length} preguntas)
                    </label>
                  </div>
                  {Object.keys(failedQuestionsByCategory).sort().map(categoria => {
                    const categoriaId = `failed-${categoria.toLowerCase().replace(/\s+/g, '-')}`;
                    const questions = failedQuestionsByCategory[categoria];
                    const allSelected = questions.every(q => selectedFailedQuestions.includes(q.id));
                    const someSelected = questions.some(q => selectedFailedQuestions.includes(q.id));

                    return (
                      <div key={categoria} className="accordion-group">
                        <div
                          className={`accordion-header ${expandedGroups.includes(categoriaId) ? 'expanded' : ''}`}
                          onClick={() => {
                            setExpandedGroups(prev =>
                              prev.includes(categoriaId)
                                ? prev.filter(g => g !== categoriaId)
                                : [...prev, categoriaId]
                            );
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (e.target.checked) {
                                setSelectedFailedQuestions(prev => [...new Set([...prev, ...questions.map(q => q.id)])]);
                              } else {
                                setSelectedFailedQuestions(prev => prev.filter(id => !questions.map(q => q.id).includes(id)));
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="accordion-indicator"></span>
                          <span className="accordion-title">{categoria} ({questions.length})</span>
                          <span className="accordion-arrow">{expandedGroups.includes(categoriaId) ? '∧' : '∨'}</span>
                        </div>

                        {expandedGroups.includes(categoriaId) && (
                          <div className="accordion-items">
                            {questions.map(q => (
                              <label key={q.id} className="question-checkbox-item">
                                <input
                                  type="checkbox"
                                  checked={selectedFailedQuestions.includes(q.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedFailedQuestions(prev => [...prev, q.id]);
                                    } else {
                                      setSelectedFailedQuestions(prev => prev.filter(id => id !== q.id));
                                    }
                                  }}
                                />
                                <span className="question-preview">Tema {q.tema}: {q.pregunta.substring(0, 80)}...</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="selected-count">{selectedFailedQuestions.length} preguntas seleccionadas</p>
                </>
              )}
            </div>
          )}

          {/* Acordeón de Preguntas en Blanco */}
          {testType === 'no_respondidas' && (teachableUserId || teachableUserEmail) && (
            <div className="category-selection-new">
              <h3>Selecciona las preguntas en blanco que quieres repasar</h3>
              {loadingSkippedQuestions ? (
                <p className="loading-text">Cargando preguntas en blanco...</p>
              ) : Object.keys(skippedQuestionsByCategory).length === 0 ? (
                <p className="no-questions-text">¡No tienes preguntas en blanco!</p>
              ) : (
                <>
                  <div className="select-all-container">
                    <label className="select-all-label">
                      <input
                        type="checkbox"
                        checked={selectedSkippedQuestions.length === Object.values(skippedQuestionsByCategory).flat().length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSkippedQuestions(Object.values(skippedQuestionsByCategory).flat().map(q => q.id));
                          } else {
                            setSelectedSkippedQuestions([]);
                          }
                        }}
                      />
                      Seleccionar todas ({Object.values(skippedQuestionsByCategory).flat().length} preguntas)
                    </label>
                  </div>
                  {Object.keys(skippedQuestionsByCategory).sort().map(categoria => {
                    const categoriaId = `skipped-${categoria.toLowerCase().replace(/\s+/g, '-')}`;
                    const questions = skippedQuestionsByCategory[categoria];
                    const allSelected = questions.every(q => selectedSkippedQuestions.includes(q.id));
                    const someSelected = questions.some(q => selectedSkippedQuestions.includes(q.id));

                    return (
                      <div key={categoria} className="accordion-group">
                        <div
                          className={`accordion-header ${expandedGroups.includes(categoriaId) ? 'expanded' : ''}`}
                          onClick={() => {
                            setExpandedGroups(prev =>
                              prev.includes(categoriaId)
                                ? prev.filter(g => g !== categoriaId)
                                : [...prev, categoriaId]
                            );
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (e.target.checked) {
                                setSelectedSkippedQuestions(prev => [...new Set([...prev, ...questions.map(q => q.id)])]);
                              } else {
                                setSelectedSkippedQuestions(prev => prev.filter(id => !questions.map(q => q.id).includes(id)));
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="accordion-indicator"></span>
                          <span className="accordion-title">{categoria} ({questions.length})</span>
                          <span className="accordion-arrow">{expandedGroups.includes(categoriaId) ? '∧' : '∨'}</span>
                        </div>

                        {expandedGroups.includes(categoriaId) && (
                          <div className="accordion-items">
                            {questions.map(q => (
                              <label key={q.id} className="question-checkbox-item">
                                <input
                                  type="checkbox"
                                  checked={selectedSkippedQuestions.includes(q.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSkippedQuestions(prev => [...prev, q.id]);
                                    } else {
                                      setSelectedSkippedQuestions(prev => prev.filter(id => id !== q.id));
                                    }
                                  }}
                                />
                                <span className="question-preview">Tema {q.tema}: {q.pregunta.substring(0, 80)}...</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="selected-count">{selectedSkippedQuestions.length} preguntas seleccionadas</p>
                </>
              )}
            </div>
          )}

          {/* Selección de OPOSICIÓN -> CATEGORÍA -> TEMA (3 NIVELES) - OCULTO EN MODO BLOQUEADO */}
          {!isLockedMode && testType === 'categoria' && (
            <div className="category-selection-new">
              <h3>Selecciona Oposición, Categoría y Temas</h3>

              {/* NIVEL 1: Oposiciones */}
              {Object.keys(availableOposiciones)
                .sort()
                .map(oposicion => {
                  const oposicionId = `opos-${oposicion.toLowerCase().replace(/\s+/g, '-')}`;

                  return (
                    <div key={oposicion} className="accordion-group">
                      {/* Header de Oposición */}
                      <div
                        className={`accordion-header ${expandedGroups.includes(oposicionId) ? 'expanded' : ''}`}
                        onClick={() => {
                          setExpandedGroups(prev =>
                            prev.includes(oposicionId)
                              ? prev.filter(g => g !== oposicionId)
                              : [...prev, oposicionId]
                          );
                        }}
                      >
                        <span className="accordion-indicator"></span>
                        <span className="accordion-title">{oposicion}</span>
                        <span className="accordion-arrow">{expandedGroups.includes(oposicionId) ? '∧' : '∨'}</span>
                      </div>

                      {/* NIVEL 2: Categorías dentro de Oposición */}
                      {expandedGroups.includes(oposicionId) && (
                        <div className="accordion-items" style={{ paddingLeft: '15px' }}>
                          {Object.keys(availableOposiciones[oposicion])
                            .sort()
                            .map(categoria => {
                              const categoriaId = `${oposicionId}-cat-${categoria.toLowerCase().replace(/\s+/g, '-')}`;

                              return (
                                <div key={categoria} className="accordion-group">
                                  {/* Header de Categoría */}
                                  <div
                                    className={`accordion-header sub-level ${expandedGroups.includes(categoriaId) ? 'expanded' : ''}`}
                                    onClick={() => {
                                      setExpandedGroups(prev =>
                                        prev.includes(categoriaId)
                                          ? prev.filter(g => g !== categoriaId)
                                          : [...prev, categoriaId]
                                      );
                                    }}
                                  >
                                    <span className="accordion-indicator sub"></span>
                                    <span className="accordion-title">{categoria}</span>
                                    <span className="accordion-arrow">{expandedGroups.includes(categoriaId) ? '∧' : '∨'}</span>
                                  </div>

                                  {/* NIVEL 3: Temas dentro de Categoría */}
                                  {expandedGroups.includes(categoriaId) && (
                                    <div className="accordion-items" style={{ paddingLeft: '15px' }}>
                                      {availableOposiciones[oposicion][categoria]?.map(temaInfo => (
                                        <label key={`${oposicion}-${categoria}-${temaInfo.tema}`} className="tema-item">
                                          <input
                                            type="checkbox"
                                            checked={isTemaSelected(oposicion, categoria, temaInfo.tema)}
                                            onChange={() => handleTemaToggle(oposicion, categoria, temaInfo.tema)}
                                          />
                                          <span>
                                            Tema {temaInfo.tema}
                                            {temaInfo.subtema && <span className="subtema-label"> - {temaInfo.subtema}</span>}
                                          </span>
                                        </label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          <div className="button-group">
            {!isLockedMode && (
              <button className="secondary-button" onClick={() => setScreen('home')}>
                Volver
              </button>
            )}
            <button className="primary-button" onClick={startTest} disabled={loading}>
              Comenzar Test
            </button>
          </div>
        </div>
      )}

      {/* Pantalla de carga al guardar resultados */}
      {savingResults && (
        <div className="loading-container-animated">
          {/* Partículas flotantes */}
          <div className="particles">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="particle" style={{ animationDelay: `${i * 0.3}s` }}></div>
            ))}
          </div>

          {/* Círculos concéntricos animados */}
          <div className="loading-circles">
            <div className="circle circle-1"></div>
            <div className="circle circle-2"></div>
            <div className="circle circle-3"></div>

            {/* Logo en el centro */}
            <div className="loading-logo-container">
              <img src="/logo.png" alt="Loading" className="loading-logo" />
            </div>
          </div>

          {/* Mensajes rotativos */}
          <div className="loading-messages">
            {(() => {
              const messages = [
                { main: 'Corrigiendo respuestas...', sub: 'Revisando cada pregunta' },
                { main: 'Calculando puntuación...', sub: 'Aplicando penalización por errores' },
                { main: 'Guardando estadísticas...', sub: 'Actualizando tu historial' },
                { main: 'Preparando resultados...', sub: '¡Ya casi está!' }
              ];
              return (
                <>
                  <p className="loading-text-main">{messages[loadingMessage].main}</p>
                  <p className="loading-text-sub">{messages[loadingMessage].sub}</p>
                </>
              );
            })()}
          </div>

          {/* Barra de progreso indeterminada */}
          <div className="progress-bar-loading">
            <div className="progress-bar-fill-loading"></div>
          </div>
        </div>
      )}

      {/* Pantalla del test - NUEVO DISEÑO */}
      {screen === 'test' && testQuestions.length > 0 && !savingResults && (
        <div className="test-container">
          {/* Header fijo */}
          <header className="test-header">
            <div className="header-left">
              <button className="exit-button" onClick={handleExitTest}>
                <span className="exit-icon">←</span> Salir
              </button>
            </div>

            <div className="header-center">
              <div className="progress-indicator">
                <span className="answered-count">{answeredCount}</span>
                <span className="total-count">/{testQuestions.length}</span>
              </div>
              <div className="progress-bar-horizontal">
                <div
                  className="progress-fill-horizontal"
                  style={{ width: `${(answeredCount / testQuestions.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="header-right">
              <div className="timer">{formatTime(timeElapsed)}</div>
              <button
                className="pause-button"
                onClick={() => setIsPaused(!isPaused)}
              >
                {isPaused ? '▶' : '||'}
              </button>
              <button className="finish-button" onClick={handleFinishTest}>
                Terminar y corregir
              </button>
            </div>
          </header>

          {/* Contenido con scroll */}
          <div className="test-content">
            {testQuestions.map((question, index) => (
              <div key={question.id} className="question-block">
                <div className="question-header">
                  <span className="question-number">{String(index + 1).padStart(2, '0')}.</span>
                  <p className="question-text">{question.question}</p>
                </div>

                <div className="options-list">
                  {question.options.map((option, optIndex) => (
                    <button
                      key={optIndex}
                      className={`option-item ${userAnswers[question.id] === optIndex ? 'selected' : ''}`}
                      onClick={() => handleAnswerSelect(question.id, optIndex)}
                    >
                      <span className="option-letter">{String.fromCharCode(65 + optIndex)}</span>
                      <span className="option-content">{option.replace(/^[a-dA-D]\)\s*/, '')}</span>
                    </button>
                  ))}
                </div>

                <div className="question-footer">
                  <span className="question-theme">
                    Tema {question.tema}
                    {question.subtema && <span className="subtema-text"> - {question.subtema}</span>}. {question.category}
                  </span>
                </div>
              </div>
            ))}

            {/* Botón para terminar al final del formulario */}
            <div className="finish-bottom-container">
              <button className="finish-bottom-button" onClick={handleFinishTest}>
                Terminar y corregir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pantalla de Estadísticas */}
      {screen === 'stats' && (
        <div className="screen stats-screen">
          <h2>📊 Mis Estadísticas</h2>

          {/* 1. Usuario */}
          {(teachableUserId || teachableUserEmail) && (
            <div className="stats-user-info">
              <p><strong>Usuario:</strong> {teachableUserName || teachableUserEmail}</p>
              <p><strong>Total de intentos:</strong> {userStats.length}</p>
            </div>
          )}

          {userStats.length === 0 ? (
            <div className="no-stats">
              <p>📋 Aún no has realizado ningún test</p>
              <p>Completa un test para ver tus estadísticas aquí</p>
            </div>
          ) : (
            <>
            {/* 2. Visualización de preguntas Acertadas/Falladas */}
            <div className="stats-summary">
            {userStats.length > 0 && (
              <>
                <p className="summary-subtitle">¡Visualiza tus preguntas acertadas y falladas!</p>
                <div className="summary-cards-new two-cards">
                  {(() => {
                    const totalCorrect = userStats.reduce((sum, s) => sum + s.correct_answers, 0);
                    const totalIncorrect = userStats.reduce((sum, s) => sum + s.incorrect_answers, 0);
                    const totalAnswered = totalCorrect + totalIncorrect;
                    const correctPercent = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
                    const incorrectPercent = totalAnswered > 0 ? Math.round((totalIncorrect / totalAnswered) * 100) : 0;

                    return (
                      <>
                        <div className="summary-card-new correct">
                          <div className="card-left">
                            <div className="card-title">Acertadas <span className="card-icon">✓</span></div>
                            <div className="card-count">{totalCorrect} respuestas</div>
                          </div>
                          <div className="card-circle correct">
                            <svg viewBox="0 0 36 36">
                              <path
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="#e8e8e8"
                                strokeWidth="3"
                              />
                              <path
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="#4CAF50"
                                strokeWidth="3"
                                strokeDasharray={`${correctPercent}, 100`}
                              />
                            </svg>
                            <span className="circle-percent">{correctPercent}%</span>
                          </div>
                        </div>

                        <div className="summary-card-new incorrect">
                          <div className="card-left">
                            <div className="card-title">Falladas <span className="card-icon">✗</span></div>
                            <div className="card-count">{totalIncorrect} respuestas</div>
                          </div>
                          <div className="card-circle incorrect">
                            <svg viewBox="0 0 36 36">
                              <path
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="#e8e8e8"
                                strokeWidth="3"
                              />
                              <path
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="#E53935"
                                strokeWidth="3"
                                strokeDasharray={`${incorrectPercent}, 100`}
                              />
                            </svg>
                            <span className="circle-percent">{incorrectPercent}%</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Gráfica de evolución */}
                <div className="stats-chart-container">
                  <h3>Evolución de tu Rendimiento</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart
                      data={[...userStats].reverse().map((stat, index) => {
                        const date = new Date(stat.test_date);
                        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                        const fechaFormateada = `${date.getDate()}/${meses[date.getMonth()]}/${date.getFullYear().toString().slice(-2)}`;

                        return {
                          intento: `#${index + 1}`,
                          fecha: fechaFormateada,
                          scoreNumerico: Number(((stat.score_standar || 0) * 100).toFixed(1))
                        };
                      })}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis
                        dataKey="intento"
                        stroke="#666"
                        style={{ fontSize: '0.85rem' }}
                      />
                      <YAxis
                        stroke="#666"
                        style={{ fontSize: '0.85rem' }}
                        domain={[0, 100]}
                        label={{ value: 'Score (%)', angle: -90, position: 'insideLeft', style: { fill: '#666' } }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '2px solid #9B7653',
                          borderRadius: '8px',
                          padding: '10px'
                        }}
                        labelStyle={{ color: '#333', fontWeight: 'bold' }}
                        formatter={(value: any) => {
                          return [`${Number(value).toFixed(1)}%`, 'Score'];
                        }}
                        labelFormatter={(label: any, payload: any) => {
                          if (payload && payload[0]) {
                            return `${payload[0].payload.fecha}`;
                          }
                          return label;
                        }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: '20px' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="scoreNumerico"
                        stroke="#F5A623"
                        strokeWidth={2}
                        dot={{ fill: '#F5A623', r: 4, strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: '#E09000' }}
                        name="Rendimiento"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
            </div>

            {/* 4. Historial de Tests */}
            <div className="stats-table-section">
              <h3 className="section-title">
                <span className="section-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M9 21V9" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </span>
                Historial de Tests
              </h3>
              <div className="stats-table-wrapper">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>FECHA</th>
                      <th>PREGUNTAS</th>
                      <th>CORRECTAS</th>
                      <th>INCORRECTAS</th>
                      <th>PUNTOS</th>
                      <th>SCORE</th>
                      <th>TIEMPO</th>
                      <th>CATEGORÍA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllStats ? userStats : userStats.slice(0, INITIAL_ITEMS_TO_SHOW)).map((stat, index) => {
                      const date = new Date(stat.test_date);
                      const fechaFormateada = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}, ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                      const scorePercent = ((stat.score_standar || 0) * 100).toFixed(1);
                      const scoreColor = Number(scorePercent) >= 50 ? '#4CAF50' : '#E53935';
                      const minutos = Math.floor((stat.time_spent_seconds || 0) / 60);
                      const segundos = (stat.time_spent_seconds || 0) % 60;
                      const tiempoFormateado = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;

                      return (
                        <tr key={stat.id || index}>
                          <td>{fechaFormateada}</td>
                          <td>{stat.num_questions}</td>
                          <td className="correct-cell">{stat.correct_answers}</td>
                          <td className="incorrect-cell">{stat.incorrect_answers}</td>
                          <td>{stat.score?.toFixed(1) || '0.0'}/{stat.num_questions}</td>
                          <td style={{ color: scoreColor, fontWeight: 'bold' }}>{scorePercent}%</td>
                          <td>{tiempoFormateado}</td>
                          <td>{stat.categoria || 'Aleatorio'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {userStats.length > INITIAL_ITEMS_TO_SHOW && (
                <button
                  className="show-more-btn"
                  onClick={() => setShowAllStats(!showAllStats)}
                >
                  {showAllStats ? `Ver menos ∧` : `Ver todos (${userStats.length}) ∨`}
                </button>
              )}
            </div>
            </>
          )}

          {/* 5. Historial de Preguntas */}
          <div className="question-stats-section">
            <h3 className="section-title">
              <span className="section-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 10h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
              Historial de Preguntas
            </h3>

            {/* Filtros */}
            <div className="question-stats-filters">
              <button
                className={`filter-button ${questionStatsFilter === 'all' ? 'active' : ''}`}
                onClick={() => setQuestionStatsFilter('all')}
              >
                Todas ({questionStats.length})
              </button>
              <button
                className={`filter-button correct ${questionStatsFilter === 'correct' ? 'active' : ''}`}
                onClick={() => setQuestionStatsFilter('correct')}
              >
                ✓ Correctas ({questionStats.filter(q => q.times_correct > 0).length})
              </button>
              <button
                className={`filter-button incorrect ${questionStatsFilter === 'incorrect' ? 'active' : ''}`}
                onClick={() => setQuestionStatsFilter('incorrect')}
              >
                ✗ Incorrectas ({questionStats.filter(q => q.times_incorrect > 0).length})
              </button>
              <button
                className={`filter-button skipped ${questionStatsFilter === 'skipped' ? 'active' : ''}`}
                onClick={() => setQuestionStatsFilter('skipped')}
              >
                ⏭ No respondidas ({questionStats.filter(q => q.times_skipped > 0).length})
              </button>
            </div>

            {/* Lista de preguntas */}
            {loadingQuestionStats ? (
              <div className="loading-question-stats">Cargando preguntas...</div>
            ) : getFilteredQuestionStats().length === 0 ? (
              <div className="no-question-stats">
                <p>No hay preguntas en esta categoría</p>
              </div>
            ) : (
              <div className="question-stats-list">
                {(showAllQuestions ? getFilteredQuestionStats() : getFilteredQuestionStats().slice(0, INITIAL_ITEMS_TO_SHOW)).map((qStat) => (
                  <div
                    key={qStat.id}
                    className={`question-stat-card ${expandedQuestionId === qStat.id ? 'expanded' : ''}`}
                  >
                    <div
                      className="question-stat-header"
                      onClick={() => setExpandedQuestionId(expandedQuestionId === qStat.id ? null : qStat.id)}
                    >
                      <div className="question-stat-summary">
                        <span className="question-stat-tema">Tema {qStat.tema}</span>
                        <span className="question-stat-categoria">{qStat.categoria}</span>
                      </div>
                      <div className="question-stat-badges">
                        {qStat.times_correct > 0 && (
                          <span className="badge correct">✓ {qStat.times_correct}</span>
                        )}
                        {qStat.times_incorrect > 0 && (
                          <span className="badge incorrect">✗ {qStat.times_incorrect}</span>
                        )}
                        {qStat.times_skipped > 0 && (
                          <span className="badge skipped">⏭ {qStat.times_skipped}</span>
                        )}
                        <span className="badge seen">👁 {qStat.times_seen}</span>
                      </div>
                      <span className="expand-icon">{expandedQuestionId === qStat.id ? '▲' : '▼'}</span>
                    </div>

                    {expandedQuestionId === qStat.id && (
                      <div className="question-stat-details">
                        <p className="question-stat-text">{qStat.pregunta}</p>
                        <div className="question-stat-options">
                          {qStat.opciones.map((opcion, idx) => {
                            const isCorrectOption = idx === (qStat.respuesta_correcta - 1);
                            const isUserAnswer = qStat.last_answer_given !== null && idx === qStat.last_answer_given;
                            const isWrongUserAnswer = isUserAnswer && !isCorrectOption;

                            return (
                              <div
                                key={idx}
                                className={`question-stat-option ${isCorrectOption ? 'correct-option' : ''} ${isWrongUserAnswer ? 'wrong-option' : ''}`}
                              >
                                <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
                                <span className="option-text">{opcion.replace(/^[a-dA-D]\)\s*/, '')}</span>
                                <div className="option-indicators">
                                  {isUserAnswer && (
                                    <span className={`user-answer-indicator ${isCorrectOption ? 'correct' : 'incorrect'}`}>
                                      Tu respuesta
                                    </span>
                                  )}
                                  {isCorrectOption && (
                                    <span className="correct-indicator">✓ Correcta</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {qStat.last_answer_given === null && qStat.times_skipped > 0 && (
                          <div className="no-answer-notice">
                            ⏭ No respondiste esta pregunta la última vez
                          </div>
                        )}
                        <div className="question-stat-footer">
                          <span>Veces vista: {qStat.times_seen}</span>
                          <span>Aciertos: {qStat.times_correct}</span>
                          <span>Fallos: {qStat.times_incorrect}</span>
                          <span>% Acierto: {qStat.times_seen > 0 ? ((qStat.times_correct / qStat.times_seen) * 100).toFixed(0) : 0}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {getFilteredQuestionStats().length > INITIAL_ITEMS_TO_SHOW && (
                  <button
                    className="show-more-btn"
                    onClick={() => setShowAllQuestions(!showAllQuestions)}
                  >
                    {showAllQuestions ? `Ver menos ∧` : `Ver todos (${getFilteredQuestionStats().length}) ∨`}
                  </button>
                )}
              </div>
            )}
          </div>

          <button className="primary-button" onClick={() => setScreen('home')}>
            Volver al Inicio
          </button>
        </div>
      )}

      {/* Pantalla de resultados */}
      {screen === 'results' && (
        <div className="screen results-screen">
          <div className="results-header">
            <h2>Resultados</h2>
            <div className="results-legend">
              <span className="legend-item"><span className="legend-dot correct"></span> Acertadas</span>
              <span className="legend-item"><span className="legend-dot incorrect"></span> Falladas</span>
              <span className="legend-item"><span className="legend-dot blank"></span> En blanco</span>
              <span className="legend-item time-legend">⏱ {formatTime(timeElapsed)}</span>
            </div>
          </div>

          <div className="results-card">
            <div className="results-scores">
              <div className="score-block">
                <span className="score-label">Aciertos</span>
                <span className="score-value">{correctAnswers}/{testQuestions.length}</span>
              </div>
              <div className="score-block score-block-main">
                <span className="score-label">Score</span>
                <span className="score-value score-percentage">{maxPossibleScore > 0 ? ((totalScore / maxPossibleScore) * 100).toFixed(1) : 0}%</span>
              </div>
            </div>
            <div className="score-explanation">
              <div className="score-explanation-header">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="score-explanation-icon">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M12 7v1M12 11v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span>Cálculo del Score</span>
              </div>
              <div className="score-explanation-content">
                <p>El score se calcula con penalización por errores:</p>
                <div className="score-formula">
                  <span className="formula-item correct">+1 punto por acierto</span>
                  <span className="formula-item incorrect">-0.33 puntos por error</span>
                </div>
                <p className="score-detail">
                  Puntuación: ({correctAnswers} × 1) - ({incorrectAnswers} × 0.33) = <strong>{totalScore.toFixed(2)}</strong> puntos
                </p>
                <p className="score-detail">
                  Score: {totalScore.toFixed(2)} ÷ {answeredCount} preguntas × 100 = <strong>{maxPossibleScore > 0 ? ((totalScore / maxPossibleScore) * 100).toFixed(1) : 0}%</strong>
                </p>
              </div>
            </div>

            <div className="results-bars">
              <div className="bar-row">
                <span className="bar-percent">{testQuestions.length > 0 ? ((correctAnswers / testQuestions.length) * 100).toFixed(1) : 0}%</span>
                <div className="bar-track">
                  <div className="bar-fill correct" style={{ width: `${testQuestions.length > 0 ? (correctAnswers / testQuestions.length) * 100 : 0}%` }}></div>
                </div>
                <span className="bar-count">{correctAnswers}</span>
              </div>
              <div className="bar-row">
                <span className="bar-percent">{testQuestions.length > 0 ? ((incorrectAnswers / testQuestions.length) * 100).toFixed(1) : 0}%</span>
                <div className="bar-track">
                  <div className="bar-fill incorrect" style={{ width: `${testQuestions.length > 0 ? (incorrectAnswers / testQuestions.length) * 100 : 0}%` }}></div>
                </div>
                <span className="bar-count">{incorrectAnswers}</span>
              </div>
              <div className="bar-row">
                <span className="bar-percent">{testQuestions.length > 0 ? (((testQuestions.length - correctAnswers - incorrectAnswers) / testQuestions.length) * 100).toFixed(1) : 0}%</span>
                <div className="bar-track">
                  <div className="bar-fill blank" style={{ width: `${testQuestions.length > 0 ? ((testQuestions.length - correctAnswers - incorrectAnswers) / testQuestions.length) * 100 : 0}%` }}></div>
                </div>
                <span className="bar-count">{testQuestions.length - correctAnswers - incorrectAnswers}</span>
              </div>
            </div>
          </div>

          {/* Ranking Bar */}
          {userPercentile !== null && (
            <div className="ranking-container">
              <h3 className="ranking-title">
                <span className="ranking-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 15C15.866 15 19 11.866 19 8V3H5V8C5 11.866 8.13401 15 12 15Z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M5 3H3V6C3 7.65685 4.34315 9 6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M19 3H21V6C21 7.65685 19.6569 9 18 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M12 15V18" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 21H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M12 18V21" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </span>
                Tu Posición
              </h3>
              <p className="ranking-description">
                {userPercentile >= 90 ? (
                  <>¡Excelente! Tu puntuación es <strong>mejor que el {userPercentile}%</strong> de todos los intentos</>
                ) : userPercentile >= 70 ? (
                  <>¡Muy bien! Tu puntuación es <strong>mejor que el {userPercentile}%</strong> de todos los intentos</>
                ) : userPercentile >= 50 ? (
                  <>¡Buen trabajo! Tu puntuación es <strong>mejor que el {userPercentile}%</strong> de todos los intentos</>
                ) : userPercentile >= 30 ? (
                  <>Tu puntuación es <strong>mejor que el {userPercentile}%</strong> de todos los intentos</>
                ) : (
                  <>Tu puntuación es <strong>mejor que el {userPercentile}%</strong> de todos los intentos. ¡Sigue practicando!</>
                )}
              </p>
              <div className="ranking-bar-container">
                <div className="ranking-bar-background">
                  <div
                    className={`ranking-bar-fill ${userPercentile >= 90 ? 'excellent' : userPercentile >= 70 ? 'great' : userPercentile >= 50 ? 'good' : userPercentile >= 30 ? 'medium' : 'low'}`}
                    style={{ width: `${userPercentile}%` }}
                  >
                    <span className="ranking-bar-label">{userPercentile}%</span>
                  </div>
                </div>
                <div className="ranking-bar-markers">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          )}

          {/* Botones de acción: Infografía, Informe, Flashcards */}
          <div className="results-action-bar">
            {!infografiaUrl && (
              <button
                className="results-action-btn infografia"
                onClick={() => {
                  generateInfografia();
                  const section = document.getElementById('infografia-section');
                  if (section) setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                }}
                disabled={generatingInfografia}
              >
                {generatingInfografia ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" className="spin-icon"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="50" strokeLinecap="round"/></svg>
                    Generando...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="8.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.5"/><path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Generar Infografía
                  </>
                )}
              </button>
            )}
            {!reportSent && teachableUserEmail && (
              <button
                className="results-action-btn report"
                onClick={() => {
                  generateReport();
                  const section = document.getElementById('report-section');
                  if (section) setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                }}
                disabled={generatingReport}
              >
                {generatingReport ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" className="spin-icon"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="50" strokeLinecap="round"/></svg>
                    Generando...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Generar Informe
                  </>
                )}
              </button>
            )}
            {!flashcardsGenerated.length && (
              <button
                className="results-action-btn flashcards-btn"
                onClick={() => {
                  generateFlashcards();
                  const section = document.getElementById('flashcards-section');
                  if (section) setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                }}
                disabled={generatingFlashcards}
              >
                {generatingFlashcards ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" className="spin-icon"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="50" strokeLinecap="round"/></svg>
                    Generando...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><rect x="6" y="8" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/></svg>
                    Flashcards
                  </>
                )}
              </button>
            )}
            {!audioBase64 && (
              <button
                className="results-action-btn audio-btn"
                onClick={() => {
                  generateAudio();
                  const section = document.getElementById('audio-section');
                  if (section) setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
                }}
                disabled={generatingAudio}
              >
                {generatingAudio ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" className="spin-icon"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="50" strokeLinecap="round"/></svg>
                    Generando...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="1.5"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5"/></svg>
                    Audio Explicativo
                  </>
                )}
              </button>
            )}
          </div>

          <div className="explanations-container">
            <h3>Revisión de Respuestas</h3>
            {testQuestions.map((question, index) => {
              const userAnswer = userAnswers[question.id];
              if (userAnswer === undefined) return null;

              const isCorrect = userAnswer === (question.correctAnswer - 1);
              const correctIndex = question.correctAnswer - 1;
              const letters = ['A', 'B', 'C', 'D'];

              return (
                <div
                  key={question.id}
                  className="review-question-card"
                >
                  <div className="review-question-header">
                    <span className="review-question-number">{String(index + 1).padStart(2, '0')}.</span>
                    <span className="review-question-text">{question.question}</span>
                    <span className={`review-status ${isCorrect ? 'correct' : 'incorrect'}`}>
                      {isCorrect ? '✓ Correcta' : '✗ Incorrecta'}
                    </span>
                  </div>
                  <div className="review-options">
                    {question.options.map((option, optIndex) => {
                      const isUserAnswer = optIndex === userAnswer;
                      const isCorrectOption = optIndex === correctIndex;
                      const isWrongSelection = isUserAnswer && !isCorrect;

                      let optionClass = 'review-option';
                      if (isWrongSelection) optionClass += ' wrong-selected';
                      if (isCorrectOption) optionClass += ' correct-option';

                      return (
                        <div key={optIndex} className={optionClass}>
                          <span className="review-option-letter">{letters[optIndex]}</span>
                          <span className="review-option-text">{option.replace(/^[a-dA-D]\)\s*/, '')}</span>
                          {isWrongSelection && <span className="review-option-icon wrong">✗</span>}
                          {isCorrectOption && <span className="review-option-icon correct">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="review-explanation">
                    <strong>Explicación:</strong> {
                      isCorrect
                        ? question.explanation
                        : (question.explanation?.replace(/^¡[^!]*!\s*/g, '') || question.explanation)
                    }
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sección de Infografía */}
          <div id="infografia-section" className="infografia-section">
            <h3 className="infografia-title">
              <span className="infografia-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="8.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              Análisis de Fallos
            </h3>
            <p className="infografia-description">
              Genera una infografía con el análisis de tus errores: dónde fallaste, por qué te pillaron y cómo evitarlo la próxima vez.
              {teachableUserEmail && <><br/><span className="infografia-email-notice">📧 Se enviará automáticamente a tu correo ({teachableUserEmail})</span></>}
              <br/><span className="infografia-time-notice">⏱️ Tiempo de generación: ~2 minutos</span>
            </p>

            {!infografiaUrl && !generatingInfografia && (
              <button
                className="infografia-button icon-btn"
                onClick={generateInfografia}
              >
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <circle cx="8.5" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Generar Infografía
              </button>
            )}

            {generatingInfografia && (
              <div className="infografia-loading">
                <div className="infografia-spinner"></div>
                <p>Generando tu infografía personalizada...</p>
              </div>
            )}

            {infografiaError && (
              <div className="infografia-error">
                <p>❌ {infografiaError}</p>
                <button
                  className="infografia-retry-button"
                  onClick={generateInfografia}
                >
                  Reintentar
                </button>
              </div>
            )}

            {infografiaUrl && (
              <div className="infografia-preview">
                <img
                  src={infografiaUrl}
                  alt="Infografía de resultados"
                  className="infografia-image"
                />
                <div className="infografia-actions">
                  <button
                    className="infografia-download-button icon-btn"
                    onClick={downloadInfografia}
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Descargar Infografía
                  </button>
                </div>
                {teachableUserEmail && emailSent && (
                  <p className="email-success">✅ Infografía enviada automáticamente a {teachableUserEmail}</p>
                )}
                {teachableUserEmail && !emailSent && (
                  <p className="email-sending">📧 Enviando a {teachableUserEmail}...</p>
                )}
              </div>
            )}
          </div>

          {/* Sección de Informe PDF */}
          <div id="report-section" className="report-section">
            <h3 className="report-title">
              <span className="report-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              Informe de Estudio Personalizado
            </h3>
            <p className="report-description">
              Genera un informe PDF detallado con apuntes de estudio basados en tus errores: explicación del fallo, respuesta correcta, ejemplos prácticos y reglas mnemotécnicas (tiempo de generación: ~2 minutos). Se enviará automáticamente a tu correo.
            </p>

            {!reportSent && !generatingReport && (
              <button
                className="report-button icon-btn"
                onClick={generateReport}
                disabled={!teachableUserEmail}
              >
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Generar Informe PDF
              </button>
            )}

            {!teachableUserEmail && !generatingReport && !reportSent && (
              <p className="report-login-hint">Inicia sesión para generar tu informe personalizado</p>
            )}

            {generatingReport && (
              <div className="report-loading">
                <div className="report-spinner"></div>
                <p>Generando tu informe de estudio personalizado...</p>
                <p className="report-loading-hint">Esto puede tardar hasta 2 minutos</p>
              </div>
            )}

            {reportError && (
              <div className="report-error">
                <p>❌ {reportError}</p>
                <button
                  className="report-retry-button"
                  onClick={generateReport}
                >
                  Reintentar
                </button>
              </div>
            )}

            {reportSent && teachableUserEmail && (
              <div className={`report-success ${reportEmailFailed ? 'email-failed' : ''}`}>
                {reportEmailFailed ? (
                  <>
                    <p>⚠️ Informe generado, pero hubo un error al enviarlo por email</p>
                    <p className="report-success-hint">No te preocupes, puedes descargarlo directamente:</p>
                  </>
                ) : (
                  <>
                    <p>✅ Informe enviado a {teachableUserEmail}</p>
                    <p className="report-success-hint">Revisa tu bandeja de entrada (y spam) en unos minutos</p>
                  </>
                )}
                {reportPdfBase64 && (
                  <button className="report-download-button" onClick={downloadReportPdf}>
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Descargar Informe PDF
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sección de Audio Explicativo */}
          <div id="audio-section" className="audio-section">
            <h3 className="audio-title">
              <span className="audio-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </span>
              Audio Explicativo
            </h3>
            <p className="audio-description">
              Genera una narración en audio explicando tus errores: qué fallaste, por qué y cómo recordarlo.
              <br/><span className="audio-time-notice">⏱️ Tiempo de generación: ~1 minuto</span>
            </p>

            {!audioBase64 && !generatingAudio && !audioError && (
              <button className="audio-generate-button icon-btn" onClick={generateAudio}>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                Generar Audio
              </button>
            )}

            {generatingAudio && (
              <div className="audio-loading">
                <div className="audio-spinner"></div>
                <p>Generando tu audio explicativo...</p>
                <p className="audio-loading-hint">Esto puede tardar hasta 1 minuto</p>
              </div>
            )}

            {audioError && (
              <div className="audio-error">
                <p>{audioError}</p>
                <button className="audio-retry-button" onClick={generateAudio}>
                  Reintentar
                </button>
              </div>
            )}

            {audioBase64 && (
              <div className="audio-player-container">
                <audio
                  controls
                  src={audioBase64}
                  className="audio-player"
                  ref={(el) => { if (el) el.playbackRate = 1.25; }}
                >
                  Tu navegador no soporta audio
                </audio>
                <p className="audio-speed-hint">Reproduciéndose a velocidad 1.25x</p>
              </div>
            )}
          </div>

          {/* Sección de Flashcards */}
          <div id="flashcards-section" className="flashcards-section">
            <h3 className="flashcards-title">
              <span className="flashcards-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="6" y="8" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="white"/>
                  <line x1="10" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="1.5"/>
                  <line x1="10" y1="16" x2="16" y2="16" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
              </span>
              Flashcards de Repaso
            </h3>
            <p className="flashcards-description">
              Genera tarjetas de estudio basadas en tus errores para repasar con repetición espaciada (curva del olvido).
              <br/><span className="flashcards-time-notice">⏱️ Tiempo de generación: ~1 minuto</span>
            </p>

            {!flashcardsGenerated.length && !generatingFlashcards && !flashcardsError && (
              <button
                className="flashcards-button icon-btn"
                onClick={generateFlashcards}
              >
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="6" y="8" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="white"/>
                  <path d="M12 12v4M10 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Generar Flashcards
              </button>
            )}

            {generatingFlashcards && (
              <div className="flashcards-loading">
                <div className="flashcards-spinner"></div>
                <p>Generando tus flashcards personalizadas...</p>
              </div>
            )}

            {flashcardsError && (
              <div className="flashcards-error">
                <p>❌ {flashcardsError}</p>
                <button
                  className="flashcards-retry-button"
                  onClick={generateFlashcards}
                >
                  Reintentar
                </button>
              </div>
            )}

            {flashcardsGenerated.length > 0 && (
              <div className="flashcards-success">
                <p>✅ Se generaron {flashcardsGenerated.length} flashcards</p>
                <div className="flashcards-preview">
                  {flashcardsGenerated.slice(0, 2).map((fc, idx) => (
                    <div key={fc.id || idx} className="flashcard-preview-item">
                      <div className="flashcard-preview-front">
                        <span className="flashcard-preview-label">Pregunta</span>
                        <p>{fc.anverso.length > 60 ? fc.anverso.substring(0, 60) + '...' : fc.anverso}</p>
                      </div>
                    </div>
                  ))}
                  {flashcardsGenerated.length > 2 && (
                    <div className="flashcard-preview-more">
                      +{flashcardsGenerated.length - 2} más
                    </div>
                  )}
                </div>
                <button
                  className="flashcards-study-button"
                  onClick={startStudyingGeneratedFlashcards}
                >
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="5,3 19,12 5,21" fill="currentColor"/>
                  </svg>
                  Estudiar Ahora
                </button>
              </div>
            )}
          </div>

          <div className="results-actions">
            <button className="primary-button" onClick={restartApp}>
              Hacer otro test
            </button>
            {(teachableUserId || teachableUserEmail) && (
              <button className="secondary-button icon-button" onClick={loadUserStats}>
                <span className="button-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="12" width="4" height="9" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="10" y="8" width="4" height="13" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="17" y="4" width="4" height="17" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </span>
                Ver Mis Estadísticas
              </button>
            )}
          </div>

          {/* Sticky bar eliminado - botones ahora están inline arriba */}
        </div>
      )}

      {/* Pantalla de Leaderboard */}
      {screen === 'leaderboard' && (
        <div className="screen leaderboard-screen">
          <h2 className="section-title">
            <span className="section-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 15C15.866 15 19 11.866 19 8V3H5V8C5 11.866 8.13401 15 12 15Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 3H3V6C3 7.65685 4.34315 9 6 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M19 3H21V6C21 7.65685 19.6569 9 18 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M12 15V18" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 21H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M12 18V21" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </span>
            Mejores Alumnos
          </h2>

          {/* Posición del usuario actual */}
          {!loadingLeaderboard && (teachableUserEmail || teachableUserId) && (
            <div className="user-position-card">
              <div className="user-position-header">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="user-position-icon">
                  <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M4 20C4 16.6863 7.58172 14 12 14C16.4183 14 20 16.6863 20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span>Tu Posición</span>
              </div>
              {userLeaderboardPosition.meetsMinimum ? (
                <div className="user-position-content">
                  <div className="user-position-main">
                    <span className="user-position-number">#{userLeaderboardPosition.position}</span>
                    <span className="user-position-detail">de {userLeaderboardPosition.totalParticipants} participantes</span>
                  </div>
                  <div className="user-position-stats">
                    <div className="user-stat">
                      <span className="user-stat-label">P. Global</span>
                      <span className="user-stat-value wilson">{userLeaderboardPosition.wilsonScore.toFixed(1)}%</span>
                    </div>
                    <div className="user-stat">
                      <span className="user-stat-label">Score Prom.</span>
                      <span className="user-stat-value">{userLeaderboardPosition.avgScore.toFixed(1)}%</span>
                    </div>
                    <div className="user-stat">
                      <span className="user-stat-label">Preguntas</span>
                      <span className="user-stat-value">{userLeaderboardPosition.totalQuestions}</span>
                    </div>
                    <div className="user-stat">
                      <span className="user-stat-label">Aciertos</span>
                      <span className="user-stat-value correct">{userLeaderboardPosition.totalCorrect}</span>
                    </div>
                    <div className="user-stat">
                      <span className="user-stat-label">Errores</span>
                      <span className="user-stat-value incorrect">{userLeaderboardPosition.totalIncorrect}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="user-position-content not-qualified">
                  <span className="user-position-status">No aplica</span>
                  <span className="user-position-reason">
                    Necesitas responder mínimo 20 preguntas para entrar en el ranking.
                    <br />
                    Llevas {userLeaderboardPosition.totalQuestions} de 20 preguntas.
                  </span>
                </div>
              )}
            </div>
          )}

          {loadingLeaderboard ? (
            <p className="loading-text">Cargando ranking...</p>
          ) : allQualifiedUsers.length === 0 ? (
            <p className="no-data-text">Aún no hay alumnos con el mínimo de 20 preguntas respondidas</p>
          ) : (
            <div className="leaderboard-section">
              <p className="leaderboard-requirement">
                Mejores alumnos en proporción a las preguntas respondidas. Se requiere un mínimo de 20 preguntas.
                El ranking usa <strong>Wilson Score</strong> que considera tanto aciertos como volumen de práctica.
              </p>
              <div className="leaderboard-table-wrapper">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th className="rank-col">#</th>
                      <th className="user-col">Usuario</th>
                      <th className="wilson-col sortable" onClick={() => handleSort('wilsonScore')}>
                        P. Global
                        <span className={`sort-icon ${sortColumn === 'wilsonScore' ? 'active' : ''}`}>
                          {sortColumn === 'wilsonScore' ? (sortDirection === 'desc' ? '▼' : '▲') : '▼'}
                        </span>
                      </th>
                      <th className="category-col sortable" onClick={() => handleSort('topCategory')}>
                        Mejor Cat.
                        <span className={`sort-icon ${sortColumn === 'topCategory' ? 'active' : ''}`}>
                          {sortColumn === 'topCategory' ? (sortDirection === 'asc' ? 'A-Z' : 'Z-A') : 'A-Z'}
                        </span>
                      </th>
                      <th className="questions-col sortable" onClick={() => handleSort('totalQuestions')}>
                        Preguntas
                        <span className={`sort-icon ${sortColumn === 'totalQuestions' ? 'active' : ''}`}>
                          {sortColumn === 'totalQuestions' ? (sortDirection === 'desc' ? '▼' : '▲') : '▼'}
                        </span>
                      </th>
                      <th className="correct-col sortable" onClick={() => handleSort('totalCorrect')}>
                        ✓
                        <span className={`sort-icon ${sortColumn === 'totalCorrect' ? 'active' : ''}`}>
                          {sortColumn === 'totalCorrect' ? (sortDirection === 'desc' ? '▼' : '▲') : '▼'}
                        </span>
                      </th>
                      <th className="incorrect-col sortable" onClick={() => handleSort('totalIncorrect')}>
                        ✗
                        <span className={`sort-icon ${sortColumn === 'totalIncorrect' ? 'active' : ''}`}>
                          {sortColumn === 'totalIncorrect' ? (sortDirection === 'desc' ? '▼' : '▲') : '▼'}
                        </span>
                      </th>
                      <th className="avg-score-col sortable" onClick={() => handleSort('avgScore')}>
                        Score Prom.
                        <span className={`sort-icon ${sortColumn === 'avgScore' ? 'active' : ''}`}>
                          {sortColumn === 'avgScore' ? (sortDirection === 'desc' ? '▼' : '▲') : '▼'}
                        </span>
                      </th>
                      <th className="trend-col">Últimos 5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedLeaderboard().map((entry) => (
                      <tr key={entry.rank} className={entry.rank <= 3 ? `top-${entry.rank}` : ''}>
                        <td className="rank-cell">
                          {entry.rank === 1 && (
                            <span className="medal-icon gold">
                              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="8" r="6" fill="currentColor"/>
                                <path d="M8 14L6 22L12 19L18 22L16 14" fill="currentColor"/>
                              </svg>
                            </span>
                          )}
                          {entry.rank === 2 && (
                            <span className="medal-icon silver">
                              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="8" r="6" fill="currentColor"/>
                                <path d="M8 14L6 22L12 19L18 22L16 14" fill="currentColor"/>
                              </svg>
                            </span>
                          )}
                          {entry.rank === 3 && (
                            <span className="medal-icon bronze">
                              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="8" r="6" fill="currentColor"/>
                                <path d="M8 14L6 22L12 19L18 22L16 14" fill="currentColor"/>
                              </svg>
                            </span>
                          )}
                          {entry.rank > 3 && entry.rank}
                        </td>
                        <td className="user-cell">{entry.userName}</td>
                        <td className="wilson-cell">{entry.wilsonScore.toFixed(1)}%</td>
                        <td className="category-cell">{entry.topCategory}</td>
                        <td className="questions-cell">{entry.totalCorrect + entry.totalIncorrect}</td>
                        <td className="correct-cell">{entry.totalCorrect}</td>
                        <td className="incorrect-cell">{entry.totalIncorrect}</td>
                        <td className="avg-score-cell">{entry.avgScore.toFixed(1)}%</td>
                        <td className="trend-cell">
                          <div className="trend-dots">
                            {entry.lastFiveResults.map((result, idx) => (
                              <span key={idx} className={`trend-dot ${result}`}></span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {allQualifiedUsers.length > 10 && (
                <button
                  className="show-more-button"
                  onClick={() => setShowAllLeaderboard(!showAllLeaderboard)}
                >
                  {showAllLeaderboard
                    ? `Mostrar solo Top 10 ▲`
                    : `Ver todos (${allQualifiedUsers.length}) ▼`
                  }
                </button>
              )}
            </div>
          )}

          <button className="primary-button" onClick={() => setScreen('home')}>
            Volver al Inicio
          </button>
        </div>
      )}

      {/* Pantalla de Admin */}
      {screen === 'admin' && (
        <div className="screen admin-screen">
          <h2>🔐 Panel de Administración</h2>

          {!adminAuthenticated ? (
            <div className="admin-login">
              <p>Ingresa la contraseña de administrador:</p>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                placeholder="Contraseña"
                className="admin-password-input"
              />
              <button className="primary-button" onClick={handleAdminLogin}>
                Acceder
              </button>
            </div>
          ) : (
            <div className="admin-content">
              {/* Sincronización desde Storage */}
              <div className="tab-content">
                <h3>🔄 Sincronizar desde Storage</h3>
                <p className="admin-instructions">
                  Lee todos los archivos .txt del Storage de Supabase y actualiza la base de datos.
                </p>

                <button
                  className="primary-button"
                  onClick={syncFromStorage}
                  disabled={syncing}
                  style={{ width: '100%', maxWidth: '400px', margin: '2rem auto', display: 'block' }}
                >
                  {syncing ? '⏳ Sincronizando...' : '🔄 Iniciar Sincronización'}
                </button>

                {syncLogs.length > 0 && (
                  <div className="sync-logs">
                    <h4>📋 Logs de Sincronización:</h4>
                    <div className="log-container">
                      {syncLogs.map((log, index) => (
                        <div key={index} className="log-entry">{log}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Generador de scripts de embedding */}
              <div className="tab-content" style={{ marginTop: '3rem' }}>
                <h3>📋 Generador de Scripts por Tema</h3>
                <p className="admin-instructions">
                  Genera scripts de embedding específicos para cada tema para incrustar en Teachable.
                  Los alumnos verán un test bloqueado solo del tema seleccionado. Los scripts obtienen automáticamente los datos del usuario desde Teachable.
                </p>

                <button
                  className="secondary-button"
                  onClick={loadIframeCategories}
                  style={{ marginBottom: '1.5rem' }}
                >
                  Cargar Categorías y Temas
                </button>

                {Object.keys(iframeOposiciones).length > 0 && (
                  <div className="iframe-generator-form">
                    {/* NIVEL 1: Selector de Oposición */}
                    <div className="form-group">
                      <label htmlFor="iframe-oposicion">1. Selecciona Oposición:</label>
                      <select
                        id="iframe-oposicion"
                        value={iframeOposicion}
                        onChange={(e) => {
                          setIframeOposicion(e.target.value);
                          setIframeCategoria('');
                          setIframeTemas([]);
                          setGeneratedIframe('');
                        }}
                        className="admin-select"
                      >
                        <option value="">-- Selecciona una oposición --</option>
                        {Object.keys(iframeOposiciones).sort().map(opos => (
                          <option key={opos} value={opos}>{opos}</option>
                        ))}
                      </select>
                    </div>

                    {/* NIVEL 2: Selector de Categoría */}
                    {iframeOposicion && (
                      <div className="form-group">
                        <label htmlFor="iframe-categoria">2. Selecciona Categoría:</label>
                        <select
                          id="iframe-categoria"
                          value={iframeCategoria}
                          onChange={(e) => {
                            setIframeCategoria(e.target.value);
                            setIframeTemas([]);
                            setGeneratedIframe('');
                          }}
                          className="admin-select"
                        >
                          <option value="">-- Selecciona una categoría --</option>
                          {Object.keys(iframeOposiciones[iframeOposicion]).sort().map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* NIVEL 3: Selector de Temas (múltiple) */}
                    {iframeOposicion && iframeCategoria && (
                      <div className="form-group">
                        <label>3. Selecciona Temas (uno o varios):</label>
                        <div className="temas-checkbox-grid">
                          {iframeOposiciones[iframeOposicion][iframeCategoria]?.map(temaInfo => (
                            <label key={temaInfo.tema} className="tema-checkbox-item">
                              <input
                                type="checkbox"
                                checked={iframeTemas.includes(temaInfo.tema)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setIframeTemas(prev => [...prev, temaInfo.tema].sort((a, b) => a - b));
                                  } else {
                                    setIframeTemas(prev => prev.filter(t => t !== temaInfo.tema));
                                  }
                                  setGeneratedIframe('');
                                }}
                              />
                              <span>
                                Tema {temaInfo.tema}
                                {temaInfo.subtema && ` - ${temaInfo.subtema}`}
                              </span>
                            </label>
                          ))}
                        </div>
                        {iframeTemas.length > 0 && (
                          <p className="temas-selected-info">
                            {iframeTemas.length} tema{iframeTemas.length > 1 ? 's' : ''} seleccionado{iframeTemas.length > 1 ? 's' : ''}: {iframeTemas.join(', ')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Botón generar */}
                    {iframeOposicion && iframeCategoria && iframeTemas.length > 0 && (
                      <button
                        className="primary-button"
                        onClick={generateIframe}
                        style={{ marginTop: '1rem' }}
                      >
                        🔨 Generar Script de Embedding
                      </button>
                    )}

                    {/* Código generado */}
                    {generatedIframe && (
                      <div className="iframe-generated" style={{ marginTop: '2rem' }}>
                        <h4>✅ Script Generado:</h4>
                        <p className="iframe-info">
                          <strong>Categoría:</strong> {iframeCategoria}<br />
                          <strong>Tema{iframeTemas.length > 1 ? 's' : ''}:</strong> {iframeTemas.join(', ')}<br />
                          <strong>Nota:</strong> Este script obtiene automáticamente los datos del usuario desde Teachable
                        </p>
                        <textarea
                          value={generatedIframe}
                          readOnly
                          className="iframe-code-display"
                          rows={20}
                        />
                        <button
                          className="secondary-button"
                          onClick={copyIframeToClipboard}
                          style={{ marginTop: '1rem' }}
                        >
                          📋 Copiar al portapapeles
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                className="secondary-button"
                onClick={() => {
                  setScreen('home');
                  setAdminAuthenticated(false);
                  setAdminPassword('');
                }}
                style={{ marginTop: '2rem' }}
              >
                Volver al Inicio
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============ PANTALLA DE ESTUDIO DE FLASHCARDS ============ */}
      {screen === 'flashcardStudy' && studyingFlashcards.length > 0 && (
        <div className="screen flashcard-study-screen">
          {/* Header */}
          <div className="flashcard-study-header">
            <button
              className="flashcard-back-button"
              onClick={() => {
                setScreen('results');
                setStudyingFlashcards([]);
                setCurrentFlashcardIndex(0);
              }}
            >
              ← Volver
            </button>
            <div className="flashcard-category-badge">
              {generatedReports.find(r => r.id === flashcardReportId)?.report_title || flashcardStudyMateria || 'ESTUDIO'}
            </div>
          </div>

          {/* Progreso */}
          <div className="flashcard-progress">
            <div className="flashcard-progress-bar">
              <div
                className="flashcard-progress-fill"
                style={{ width: `${((currentFlashcardIndex + 1) / studyingFlashcards.length) * 100}%` }}
              />
            </div>
            <span className="flashcard-progress-text">
              {currentFlashcardIndex + 1} / {studyingFlashcards.length} pendientes
              {flashcardTotalInDeck > 0 && studyingFlashcards.length < flashcardTotalInDeck && (
                <span style={{ opacity: 0.6, marginLeft: '0.25rem' }}>
                  (de {flashcardTotalInDeck} total)
                </span>
              )}
            </span>
          </div>

          {/* Tarjeta */}
          <div className="flashcard-container">
            <div
              className={`flashcard ${flashcardFlipped ? 'flipped' : ''}`}
              onClick={() => setFlashcardFlipped(!flashcardFlipped)}
            >
              <div className="flashcard-inner">
                <div className="flashcard-front">
                  {/* Indicador de estado y aciertos */}
                  {studyingFlashcards[currentFlashcardIndex] && (() => {
                    const card = studyingFlashcards[currentFlashcardIndex];
                    const isDue = !card.proxima_revision || new Date(card.proxima_revision) <= new Date();
                    const nextReview = card.proxima_revision ? new Date(card.proxima_revision) : null;

                    return (
                      <div className={`flashcard-status-badge ${isDue ? 'due' : 'not-due'}`}>
                        {isDue ? (
                          <>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/>
                              <polyline points="12,6 12,12 16,14"/>
                            </svg>
                            <span>Pendiente</span>
                          </>
                        ) : (
                          <>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                              <polyline points="22,4 12,14.01 9,11.01"/>
                            </svg>
                            <span>
                              {nextReview && (
                                (() => {
                                  const diff = nextReview.getTime() - Date.now();
                                  const hours = Math.floor(diff / (1000 * 60 * 60));
                                  const days = Math.floor(hours / 24);
                                  if (days > 0) return `en ${days}d`;
                                  if (hours > 0) return `en ${hours}h`;
                                  return 'pronto';
                                })()
                              )}
                            </span>
                          </>
                        )}
                        {card.repeticiones_correctas > 0 && (
                          <span className="streak-count">• {card.repeticiones_correctas} racha</span>
                        )}
                      </div>
                    );
                  })()}
                  <span className="flashcard-type-label">PREGUNTA</span>
                  <p className="flashcard-content">
                    {studyingFlashcards[currentFlashcardIndex]?.anverso}
                  </p>
                  <button
                    className="flashcard-reveal-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFlashcardFlipped(true);
                    }}
                  >
                    DESCUBRIR RESPUESTA ↻
                  </button>
                </div>
                <div className="flashcard-back">
                  <span className="flashcard-type-label">RESPUESTA</span>
                  <p className="flashcard-content">
                    {studyingFlashcards[currentFlashcardIndex]?.reverso}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Botones de calificacion - solo visibles cuando esta volteada */}
          {flashcardFlipped && (
            <div className="flashcard-rating-buttons">
              <button
                className="flashcard-rating-btn rating-1"
                onClick={() => handleFlashcardResponse(1)}
              >
                <span className="rating-number">1</span>
                <span className="rating-label">FALLO</span>
              </button>
              <button
                className="flashcard-rating-btn rating-2"
                onClick={() => handleFlashcardResponse(2)}
              >
                <span className="rating-number">2</span>
                <span className="rating-label">DUDA</span>
              </button>
              <button
                className="flashcard-rating-btn rating-3"
                onClick={() => handleFlashcardResponse(3)}
              >
                <span className="rating-number">3</span>
                <span className="rating-label">JUSTO</span>
              </button>
              <button
                className="flashcard-rating-btn rating-4"
                onClick={() => handleFlashcardResponse(4)}
              >
                <span className="rating-number">4</span>
                <span className="rating-label">CLARO</span>
              </button>
              <button
                className="flashcard-rating-btn rating-5"
                onClick={() => handleFlashcardResponse(5)}
              >
                <span className="rating-number">5</span>
                <span className="rating-label">PRO</span>
              </button>
            </div>
          )}
        </div>
      )}
      {/* ============ FIN PANTALLA DE ESTUDIO DE FLASHCARDS ============ */}

      {/* ============ PANTALLA MIS FLASHCARDS ============ */}
      {screen === 'flashcardsHome' && (
        <div className="screen flashcards-home-screen">
          <h2 className="section-title">
            <span className="section-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <rect x="6" y="8" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </span>
            Mis Flashcards
          </h2>

          <div className="flashcards-home-content">
            {loadingFlashcardDecks ? (
              <div className="flashcards-loading">
                <div className="flashcards-spinner"></div>
                <p>Cargando tus mazos...</p>
              </div>
            ) : generatedReports.length === 0 ? (
              <div className="flashcards-empty-state">
                <div className="empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <rect x="6" y="8" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 12v2M10 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3>No tienes flashcards guardadas</h3>
                <p>Las flashcards se generan automáticamente cuando haces un test y tienes preguntas incorrectas.</p>
                <p className="flashcards-hint">Haz un test y genera flashcards desde la pantalla de resultados para empezar a estudiar con repetición espaciada.</p>
                <button className="primary-button" onClick={() => setScreen('select')}>
                  Hacer un Test
                </button>
              </div>
            ) : (
              <div className="flashcards-decks-list">
                {generatedReports.map((report) => (
                  <div key={report.id} className="flashcard-deck-item">
                    <div className="deck-info">
                      <h4>{report.report_title || 'Mazo sin título'}</h4>
                      <p className="deck-meta">
                        {report.num_questions} tarjetas · {new Date(report.created_at).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <div className="deck-actions">
                      <button
                        className="study-deck-btn"
                        onClick={() => studyFlashcardsFromDeck(report.id, report.report_title)}
                      >
                        Estudiar
                      </button>
                      <button
                        className="delete-deck-btn"
                        onClick={async () => {
                          if (confirm('¿Eliminar este mazo y todas sus tarjetas?')) {
                            await deleteGeneratedReport(report.id);
                            setGeneratedReports(prev => prev.filter(r => r.id !== report.id));
                          }
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button className="back-button" onClick={() => setScreen('home')}>
            ← Volver al Inicio
          </button>
        </div>
      )}
      {/* ============ FIN PANTALLA MIS FLASHCARDS ============ */}

      {/* Toast para mensajes de flashcards */}
      {noPendingFlashcardsMessage && (
        <div className="flashcard-toast success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <span>{noPendingFlashcardsMessage}</span>
          <button onClick={() => setNoPendingFlashcardsMessage(null)}>×</button>
        </div>
      )}
    </div>
  );
}

export default App;
