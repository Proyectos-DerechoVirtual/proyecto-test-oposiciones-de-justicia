# 🎯 IMPLEMENTACIÓN: Filtrado de Oposiciones por Curso de Teachable

## 📋 Resumen

Esta implementación permite que cada estudiante **solo vea las oposiciones de los cursos en los que está inscrito** en Teachable.

**Ejemplo:**
- Estudiante inscrito en "Curso Auxilio" → Solo ve temas de "Auxilio"
- Estudiante inscrito en "Curso Gestión 1" y "Gestión 2" → Ve ambas oposiciones
- Estudiante sin user_id (acceso directo) → Ve todas las oposiciones

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────┐
│  TEACHABLE                                      │
│  - Estudiante accede al curso                  │
│  - Script pasa user_id a la app                │
└─────────────────────────────────────────────────┘
                    ↓ user_id=123
┌─────────────────────────────────────────────────┐
│  FRONTEND (React App)                           │
│  - Llama: /api/get-user-courses?userId=123     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  BACKEND PROXY (Vercel Serverless Function)    │
│  - Consulta Teachable API con API_KEY          │
│  - Obtiene enrollments del usuario             │
│  - Devuelve: ["Oposicion Justicia"]            │
└─────────────────────────────────────────────────┘
           ↓                    ↓
┌────────────────────┐  ┌──────────────────────────┐
│  TEACHABLE API     │  │  SUPABASE                │
│  (enrollments)     │  │  course_oposicion_map... │
└────────────────────┘  └──────────────────────────┘
```

---

## 🚀 PASOS DE IMPLEMENTACIÓN

### **PASO 1: Ejecutar SQL en Supabase**

Ve a **Supabase Dashboard → SQL Editor** y ejecuta:

```sql
-- Tabla para mapear course_id de Teachable → oposicion
CREATE TABLE public.course_oposicion_mapping_test (
  id SERIAL PRIMARY KEY,
  course_id TEXT NOT NULL UNIQUE,
  course_name TEXT,
  oposicion TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_course_id_test ON course_oposicion_mapping_test(course_id);
```

✅ **Verificación:** La tabla debería crearse sin errores.

---

### **PASO 2: Obtener tus Course IDs de Teachable**

1. **Ve a Teachable Admin → Courses**
   - URL: https://derechovirtual.teachable.com/admin-app/courses

2. **Para cada curso que quieras mapear:**
   - Click en el curso
   - La URL será: `https://derechovirtual.teachable.com/admin-app/courses/COURSE_ID/...`
   - **COURSE_ID** es el número en la URL (ej: `2895236`)

3. **Anota los Course IDs:**
   ```
   Curso "Auxilio"    → Course ID: 2895236
   Curso "Gestión 1"  → Course ID: XXXX
   Curso "Gestión 2"  → Course ID: YYYY
   ```

---

### **PASO 3: Poblar la tabla con tus cursos**

En **Supabase → SQL Editor**, ejecuta:

```sql
-- REEMPLAZA con los Course IDs reales de tus cursos
INSERT INTO course_oposicion_mapping_test (course_id, course_name, oposicion) VALUES
  ('2895236', 'Curso Principal', 'Oposicion Justicia');

-- Añade más cursos según los tengas:
-- ('COURSE_ID_AUXILIO', 'Curso Auxilio', 'Auxilio'),
-- ('COURSE_ID_GESTION_1', 'Curso Gestión 1', 'Gestion 1'),
-- ('COURSE_ID_GESTION_2', 'Curso Gestión 2', 'Gestion 2');
```

✅ **Verificación:** Ejecuta `SELECT * FROM course_oposicion_mapping_test;` y deberías ver tus cursos.

---

### **PASO 4: Configurar Variables de Entorno en Vercel**

1. **Ve a Vercel Dashboard:**
   - https://vercel.com/brayan-romeros-projects/test-oposiciones-justicia

2. **Settings → Environment Variables**

3. **Añade estas 4 variables:**

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `TEACHABLE_API_KEY` | `kjhTwL2jGbi68I8jwu9dVzoJWXzBfuL8` | Tu API Key de Teachable |
| `TEACHABLE_SCHOOL_NAME` | `derechovirtual` | Nombre de tu escuela |
| `SUPABASE_URL` | `https://tu-proyecto.supabase.co` | URL de Supabase |
| `SUPABASE_ANON_KEY` | `eyJhb...` | Anon key de Supabase |

**Importante:**
- ✅ Environment: Selecciona **Production, Preview, Development** (todas)
- ✅ Click en "Save" después de cada variable

✅ **Verificación:** Deberías ver las 4 variables configuradas.

---

### **PASO 5: Desplegar a Vercel**

Desde tu terminal local:

```bash
cd /home/brayan/test-oposiciones

# Desplegar todo (frontend + serverless functions)
vercel --prod
```

**Logs esperados:**
```
✓ Uploading...
✓ Deploying...
✓ Building...
✓ Production: https://test-oposiciones-justicia.vercel.app
```

✅ **Verificación:** El deployment debería completarse sin errores.

---

### **PASO 6: Probar el Endpoint**

Abre en tu navegador:

```
https://test-oposiciones-justicia.vercel.app/api/get-user-courses?userId=123&userEmail=test@example.com
```

**Respuesta esperada:**
```json
{
  "oposiciones": ["Oposicion Justicia"],
  "allAccess": false,
  "courseIds": ["2895236"]
}
```

✅ Si ves esta respuesta, el backend proxy funciona correctamente.

---

### **PASO 7: Actualizar Script en Teachable (App Principal)**

En el curso donde está embedida la app principal, actualiza el script para pasar `user_id`:

**ANTES (script antiguo):**
```html
<div id="app-principal"></div>

<script>
  var iframe = document.createElement('iframe');
  iframe.src = 'https://test-oposiciones-justicia.vercel.app';
  // ...
</script>
```

**AHORA (script actualizado con user_id):**
```html
<div id="app-principal"></div>

<script>
(function() {
  // Obtener datos del usuario de Teachable
  var userId = '';
  var userEmail = '';
  var userName = '';

  try {
    if (typeof currentUser === 'function') {
      var user = currentUser();
      userId = user.id || '';
      userEmail = user.email || '';
      userName = user.name || user.username || '';
    }
  } catch (e) {
    console.log('Error obteniendo usuario:', e);
  }

  // Crear iframe con user_id
  var baseUrl = 'https://test-oposiciones-justicia.vercel.app';
  var params = '?user_id=' + encodeURIComponent(userId) +
               '&user_email=' + encodeURIComponent(userEmail) +
               '&user_name=' + encodeURIComponent(userName);

  var iframe = document.createElement('iframe');
  iframe.src = baseUrl + params;
  iframe.style.cssText = 'width: 100%; height: 900px; border: none; display: block;';
  iframe.setAttribute('allow', 'fullscreen');

  document.getElementById('app-principal').appendChild(iframe);

  console.log('App cargada con user_id:', userId);
})();
</script>
```

✅ **Importante:** Guarda el cambio en el Custom Code de la lección de Teachable.

---

### **PASO 8: Probar en Producción**

1. **Como estudiante inscrito en un curso:**
   - Abre la lección donde está la app
   - Click en "Comenzar Test" → "Por Categoría/Tema"
   - Deberías ver **SOLO** las oposiciones del curso en el que estás inscrito

2. **Verificar en la consola del navegador:**
   - F12 → Console
   - Busca: `Oposiciones permitidas para el usuario:`
   - Debería mostrar: `{oposiciones: ["Oposicion Justicia"], allAccess: false, ...}`

3. **Como admin (sin user_id):**
   - Abre directamente: https://test-oposiciones-justicia.vercel.app
   - Deberías ver **TODAS** las oposiciones

---

## 🎯 Casos de Uso

### **Caso 1: Estudiante inscrito en 1 curso**
```
Inscrito en: Curso Auxilio (ID: 12345)
    ↓
API devuelve: ["Auxilio"]
    ↓
App muestra: Solo oposición "Auxilio"
```

### **Caso 2: Estudiante inscrito en múltiples cursos**
```
Inscrito en:
  - Curso Gestión 1 (ID: 67890)
  - Curso Gestión 2 (ID: 11111)
    ↓
API devuelve: ["Gestion 1", "Gestion 2"]
    ↓
App muestra: Ambas oposiciones
```

### **Caso 3: Usuario sin user_id (acceso directo)**
```
Acceso directo a la URL (sin parámetros)
    ↓
API no se llama
    ↓
App muestra: Todas las oposiciones
```

### **Caso 4: Error de API (fallback seguro)**
```
API de Teachable falla
    ↓
API devuelve: {oposiciones: [], allAccess: true}
    ↓
App muestra: Todas las oposiciones (para no bloquear al usuario)
```

---

## 🔍 Verificación Completa

**Checklist:**

- [ ] ✅ Tabla `course_oposicion_mapping_test` creada en Supabase
- [ ] ✅ Course IDs obtenidos de Teachable
- [ ] ✅ Tabla poblada con al menos 1 curso
- [ ] ✅ Variables de entorno configuradas en Vercel
- [ ] ✅ Deployment exitoso en Vercel
- [ ] ✅ Endpoint `/api/get-user-courses` responde correctamente
- [ ] ✅ Script actualizado en Teachable con `user_id`
- [ ] ✅ App filtra oposiciones según el usuario

---

## 🆘 Troubleshooting

### **Problema: Endpoint devuelve error 500**
**Causa:** Variables de entorno no configuradas
**Solución:**
1. Ve a Vercel → Settings → Environment Variables
2. Verifica que `TEACHABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` estén configuradas
3. Redeploy: `vercel --prod`

### **Problema: Muestra todas las oposiciones en lugar de filtrar**
**Causa:** El `user_id` no se está pasando correctamente
**Solución:**
1. F12 → Console
2. Busca: `Teachable params:` → Debería mostrar `userId: "123"`
3. Si no aparece, revisa el script de Teachable
4. Asegúrate de que `currentUser()` esté disponible

### **Problema: Teachable API devuelve error 401**
**Causa:** API Key incorrecta
**Solución:**
1. Ve a Teachable → Settings → API Clients
2. Verifica que la API Key sea correcta
3. Actualiza la variable de entorno en Vercel
4. Redeploy

### **Problema: No encuentra el curso en la tabla**
**Causa:** El `course_id` no está en la tabla
**Solución:**
1. Ejecuta: `SELECT * FROM course_oposicion_mapping_test;`
2. Verifica que el `course_id` del estudiante esté en la tabla
3. Si no está, añádelo con `INSERT INTO ...`

---

## 💰 Costos

**TODO GRATIS:**
- ✅ Vercel Serverless Functions: Hasta 100GB bandwidth/mes
- ✅ Supabase: Plan gratuito incluye todo lo necesario
- ✅ Teachable API: Sin costo adicional

**NO necesitas pagar nada adicional.** 🎉

---

## 📁 Archivos Creados/Modificados

### **Nuevos:**
- ✅ `/api/get-user-courses.js` - Serverless function (backend proxy)
- ✅ `/sql/create_course_mapping_table.sql` - SQL para crear tabla

### **Modificados:**
- ✅ `/src/App.tsx` - Llama al endpoint y filtra oposiciones

---

## 🎓 Próximos Pasos Opcionales

1. **Panel Admin para gestionar mapeos:**
   - Interfaz visual para añadir/editar course_id → oposicion
   - Evita ejecutar SQL manualmente

2. **Caché de enrollments:**
   - Guardar enrollments en localStorage
   - Reducir llamadas a la API

3. **Webhooks de Teachable:**
   - Actualizar automáticamente cuando un estudiante se inscribe/desinscribe
   - Requiere configuración adicional en Teachable

---

**¡Todo listo para filtrar oposiciones por curso! 🚀**
