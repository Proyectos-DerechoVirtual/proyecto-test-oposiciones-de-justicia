# 🚀 Guía de Despliegue - Edge Function de Sincronización

## ¿Qué hace esta Edge Function?

La Edge Function `sync-storage-questions` detecta **automáticamente** todos los archivos `.txt` que subas al bucket "Tests" de Supabase Storage y los sincroniza con la base de datos `questions_test`.

**Ventajas:**
- ✅ **Ya no necesitas el admin panel** para sincronizar (aunque sigue funcionando)
- ✅ **Sube archivos directamente a Supabase Storage** desde cualquier lugar
- ✅ **Haz clic en "Sincronizar" en el admin panel** y listo
- ✅ **500,000 invocaciones gratis al mes** (plan gratuito)
- ✅ **Procesa la estructura completa** de carpetas (Gestión/Gestión-1/test_tema_X.txt)

---

## 📋 Paso 1: Instalar Supabase CLI

Abre tu terminal (WSL Ubuntu) y ejecuta:

```bash
npm install -g supabase
```

Verifica la instalación:

```bash
supabase --version
```

---

## 🔐 Paso 2: Login en Supabase

```bash
supabase login
```

Esto abrirá tu navegador para autenticarte. Si no se abre automáticamente, copia el enlace que aparece en la terminal.

---

## 🔗 Paso 3: Obtener el Project Reference ID

1. Ve a tu dashboard de Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** (⚙️) → **General**
4. Copia el **"Reference ID"** (algo como `abcdefghijklmnop`)

---

## 🔗 Paso 4: Vincular tu Proyecto

Desde la raíz del proyecto (donde está package.json):

```bash
cd /home/brayan/test-oposiciones
supabase link --project-ref TU_PROJECT_REF
```

**Reemplaza `TU_PROJECT_REF` con el ID que copiaste.**

Ejemplo:
```bash
supabase link --project-ref abcdefghijklmnop
```

Si te pide la contraseña de la base de datos:
- Ve a **Settings** → **Database** en Supabase
- Usa la contraseña que configuraste al crear el proyecto
- Si no la recuerdas, puedes resetearla desde ahí

---

## 🚀 Paso 5: Desplegar la Edge Function

```bash
supabase functions deploy sync-storage-questions
```

Verás algo como:

```
Deploying sync-storage-questions (project ref: abcdefghijklmnop)
Bundled sync-storage-questions size: 15 kB
Deploying sync-storage-questions
✓ Deployed sync-storage-questions
```

**¡Listo!** La función ya está desplegada y lista para usar.

---

## ✅ Paso 6: Probar la Sincronización

### Opción A: Desde el Admin Panel (Recomendado)

1. Ve a tu app: https://test-oposiciones-justicia-nvm7rxdqp-brayan-romeros-projects.vercel.app
2. Haz clic en **"🔐 Panel Admin"**
3. Ingresa la contraseña: `admin123`
4. Ve a la pestaña **"🔄 Sincronizar"**
5. Haz clic en **"🔄 Iniciar Sincronización"**

Verás los logs en tiempo real mostrando cuántos archivos se procesaron.

### Opción B: Desde la Terminal (Para testing)

```bash
supabase functions invoke sync-storage-questions
```

---

## 📁 Estructura Esperada en Storage

La Edge Function busca archivos en esta estructura:

```
Tests/
├── Gestion/
│   ├── Gestion-1/
│   │   ├── test_tema_7.txt
│   │   ├── test_tema_10.txt
│   │   └── test_tema_13.txt
│   ├── Gestion-2/
│   │   └── test_tema_X.txt
│   └── Gestion-3/
│       └── test_tema_Y.txt
├── Tramitacion/
│   └── test_tema_Z.txt
├── Auxilio/
│   └── test_tema_W.txt
└── Otro/
    └── test_tema_V.txt
```

**Cada archivo debe seguir el formato:**

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

---

## 🔄 Flujo de Trabajo Recomendado

### Para añadir nuevas preguntas:

1. **Sube archivos a Supabase Storage** directamente desde el dashboard:
   - Ve a **Storage** → **Tests**
   - Crea la carpeta correspondiente (ej: `Gestion/Gestion-1`)
   - Arrastra los archivos `.txt`

2. **O usa el Admin Panel de la app:**
   - Ve a **"📤 Subir a Storage"**
   - Selecciona la carpeta destino
   - Sube archivos o carpetas completas

3. **Sincroniza con un clic:**
   - Ve a **"🔄 Sincronizar"**
   - Haz clic en **"🔄 Iniciar Sincronización"**
   - Listo! Las preguntas están en la base de datos

---

## 🔍 Ver Logs de la Edge Function

### En tiempo real:

```bash
supabase functions logs sync-storage-questions --follow
```

### Ver últimas invocaciones:

```bash
supabase functions logs sync-storage-questions
```

### Desde el Dashboard:

1. Ve a **Edge Functions** en Supabase
2. Selecciona `sync-storage-questions`
3. Ve a **Logs** o **Metrics**

---

## ⚙️ Configuración Automática de Sincronización (Opcional)

### Opción 1: Después de cada subida (Recomendado)

Ya está configurado en el admin panel. Cuando subes archivos, puedes hacer clic en "Sincronizar" inmediatamente.

### Opción 2: Sincronización Programada (Cron Job)

Puedes configurar Vercel Cron para que sincronice automáticamente cada X horas:

1. Crea `vercel.json` en la raíz del proyecto:

```json
{
  "crons": [{
    "path": "/api/sync-cron",
    "schedule": "0 */6 * * *"
  }]
}
```

2. Crea el archivo `api/sync-cron.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.functions.invoke('sync-storage-questions');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json(data);
}
```

Esto sincronizará automáticamente cada 6 horas.

---

## 🛠️ Troubleshooting

### Error: "Function not found"

```bash
# Verifica que esté desplegada
supabase functions list

# Re-despliega
supabase functions deploy sync-storage-questions
```

### Error: "Bucket not found"

- Verifica que el bucket se llame exactamente **"Tests"** (con 's' mayúscula)
- Verifica en **Storage** del dashboard de Supabase

### Error: "Row-level security policy"

- Ve a **Storage** → **Tests** → **Policies**
- Asegúrate de que esté configurado como **"Public bucket"**
- O crea una política que permita lectura/escritura

### La sincronización no procesa archivos

- Verifica que los archivos `.txt` sigan el formato correcto
- Revisa los logs: `supabase functions logs sync-storage-questions`
- Verifica que los archivos estén en la estructura correcta de carpetas

### Error: "Invalid key" al subir archivos

- Los nombres de archivos/carpetas no deben tener:
  - Espacios (se reemplazan automáticamente por guiones)
  - Tildes (se eliminan automáticamente)
  - Caracteres especiales

---

## 📊 Métricas y Límites

**Plan Gratuito de Supabase:**
- ✅ 500,000 invocaciones de Edge Functions al mes
- ✅ 2 segundos máximo de CPU por request
- ✅ 20MB tamaño máximo de función
- ✅ 1GB de Storage

**Para tu caso de uso:**
- Incluso sincronizando 10 veces al día durante 30 días = 300 invocaciones
- **Estás más que cubierto con el plan gratuito**

---

## 🎯 Resumen

1. ✅ Instalar CLI: `npm install -g supabase`
2. ✅ Login: `supabase login`
3. ✅ Vincular proyecto: `supabase link --project-ref TU_REF`
4. ✅ Desplegar: `supabase functions deploy sync-storage-questions`
5. ✅ Probar desde el admin panel

**¡Ya está!** Ahora puedes subir archivos directamente a Supabase Storage y sincronizar con un clic.
