# Supabase Edge Functions - Sincronización Automática

## 📋 Descripción

Esta Edge Function sincroniza automáticamente los archivos `.txt` del bucket "Tests" con la base de datos `questions_test`.

## 🚀 Despliegue

### 1. Instalar Supabase CLI

```bash
npm install -g supabase
```

### 2. Hacer Login en Supabase

```bash
supabase login
```

### 3. Vincular tu Proyecto

```bash
supabase link --project-ref TU_PROJECT_REF
```

**Para obtener tu PROJECT_REF:**
- Ve a tu dashboard de Supabase: https://supabase.com/dashboard
- Selecciona tu proyecto
- Ve a Settings → General
- Copia el "Reference ID"

### 4. Desplegar la Edge Function

```bash
supabase functions deploy sync-storage-questions
```

## 🔧 Configuración

### Variables de Entorno (Automáticas)

La función usa estas variables que Supabase proporciona automáticamente:
- `SUPABASE_URL` - URL de tu proyecto
- `SUPABASE_SERVICE_ROLE_KEY` - Key con permisos completos

## 📞 Formas de Activar la Función

### Opción 1: Manual (Desde tu Frontend)

Agrega un botón en el admin panel que llame a la función:

```typescript
const syncFromStorage = async () => {
  const { data, error } = await supabase.functions.invoke('sync-storage-questions');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sincronización exitosa:', data);
  }
};
```

### Opción 2: Webhook (Después de Subir Archivos)

Después de subir archivos al Storage, llama automáticamente a la función:

```typescript
const uploadFiles = async (files: FileList) => {
  // Subir archivos...
  await supabase.storage.from('Tests').upload(...);

  // Sincronizar automáticamente
  await supabase.functions.invoke('sync-storage-questions');
};
```

### Opción 3: Programada (Cron Job)

Configura un cron job externo (ej: GitHub Actions, Vercel Cron) que llame a la función cada X tiempo:

```bash
# Cada hora
curl -X POST \
  https://TU_PROJECT_REF.supabase.co/functions/v1/sync-storage-questions \
  -H "Authorization: Bearer TU_ANON_KEY"
```

### Opción 4: Trigger de Base de Datos

Puedes crear un trigger que llame a la función cuando detecte cambios en Storage (más avanzado).

## 📁 Estructura del Bucket "Tests"

La función espera esta estructura:

```
Tests/
├── Gestion/
│   ├── Gestion-1/
│   │   ├── test_tema_7.txt
│   │   ├── test_tema_10.txt
│   │   └── ...
│   ├── Gestion-2/
│   │   └── ...
│   └── Gestion-3/
│       └── ...
├── Tramitacion/
│   └── ...
├── Auxilio/
│   └── ...
└── Otro/
    └── ...
```

## 📝 Formato de Archivos .txt

Cada archivo debe seguir este formato:

```
Pregunta: [Texto de la pregunta]
1)[Opción 1]
2)[Opción 2]
3)[Opción 3]
4)[Opción 4]
Respuesta: [1-4]
Correcta: [Explicación si acierta]
Errada: [Explicación si falla]
###
Pregunta: [Siguiente pregunta...]
...
```

## 🔍 Verificar que Funciona

### 1. Ver Logs en Tiempo Real

```bash
supabase functions logs sync-storage-questions --follow
```

### 2. Invocar Manualmente desde CLI

```bash
supabase functions invoke sync-storage-questions
```

### 3. Ver en el Dashboard

- Ve a Functions en tu dashboard de Supabase
- Selecciona `sync-storage-questions`
- Revisa los logs y métricas

## ✅ Respuesta de la Función

La función devuelve un JSON con el resultado:

```json
{
  "success": true,
  "totalFiles": 25,
  "filesProcessed": 24,
  "filesWithErrors": 1,
  "totalQuestionsProcessed": 250,
  "logs": [
    "📄 Procesando: Gestion/Gestion-1/test_tema_10.txt",
    "✅ 12 preguntas de test_tema_10.txt sincronizadas",
    ...
  ]
}
```

## 🛠️ Troubleshooting

### Error: "Bucket not found"
- Verifica que el bucket se llame exactamente "Tests" (con 's' mayúscula)
- Verifica que el bucket exista en Storage

### Error: "Row-level security policy"
- Asegúrate de que el bucket "Tests" esté configurado como "Public bucket allow"
- O configura las políticas RLS apropiadas

### Error: "Invalid key"
- La función automáticamente sanitiza nombres de archivos
- Evita caracteres especiales en nombres de carpetas

### No se sincronizan las preguntas
- Verifica que los archivos .txt sigan el formato correcto
- Revisa los logs con `supabase functions logs`

## 📊 Límites del Plan Gratuito

- **500,000 invocaciones/mes** - Más que suficiente
- **2 segundos máximo de CPU por request**
- **20MB tamaño máximo de función**

## 🔄 Actualizar la Función

Si haces cambios en el código:

```bash
supabase functions deploy sync-storage-questions
```

Los cambios se aplican inmediatamente.
