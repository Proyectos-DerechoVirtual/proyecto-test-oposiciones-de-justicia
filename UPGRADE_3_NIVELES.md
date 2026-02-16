# ✅ UPGRADE COMPLETADO: Sistema de 3 Niveles Jerárquicos

## 📋 Resumen de Cambios

Se ha implementado exitosamente un sistema de **3 niveles jerárquicos** para organizar las preguntas:

```
Oposición (nivel 1)
  └── Categoría (nivel 2)
      └── Tema (nivel 3)
          └── Subtema (metadato)
```

## 🗂️ Jerarquía de Carpetas en Storage

Las carpetas en Supabase Storage deben seguir esta estructura:

```
Tests/
  ├── oposicion-justicia/
  │   ├── oposicion-justicia-bloque-1/
  │   │   ├── test_tema_1_introduccion.txt
  │   │   └── test_tema_2_conceptos_basicos.txt
  │   └── oposicion-justicia-bloque-2/
  │       ├── test_tema_3_procedimientos.txt
  │       └── test_tema_4_tramites.txt
  └── otra-oposicion/
      ├── otra-oposicion-bloque-1/
      │   └── test_tema_1_tema_ejemplo.txt
      └── otra-oposicion-bloque-2/
          └── test_tema_5_otro_ejemplo.txt
```

**Extracción automática:**
- `oposicion-justicia` → Columna `oposicion` = "Oposicion Justicia"
- `oposicion-justicia-bloque-1` → Columna `categoria` = "Oposicion Justicia Bloque 1"
- `introduccion` → Columna `subtema` = "Introduccion"

## 🚀 Pasos para Completar la Implementación

### **PASO 1: Ejecutar SQL en Supabase**

Ve a **Supabase Dashboard → SQL Editor** y ejecuta estos 2 archivos en orden:

#### 1.1. Añadir columna `oposicion`:
```sql
-- Archivo: sql/add_oposicion_column.sql

ALTER TABLE public.questions_test ADD COLUMN IF NOT EXISTS oposicion TEXT;

CREATE INDEX IF NOT EXISTS idx_questions_oposicion ON public.questions_test USING btree (oposicion);

UPDATE public.questions_test
SET oposicion = 'General'
WHERE oposicion IS NULL;
```

#### 1.2. Actualizar RPC function:
```sql
-- Archivo: sql/update_rpc_with_oposicion.sql

DROP FUNCTION IF EXISTS get_distinct_categoria_tema();

CREATE OR REPLACE FUNCTION get_distinct_oposicion_categoria_tema()
RETURNS TABLE (oposicion TEXT, categoria TEXT, tema INTEGER, subtema TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT q.oposicion, q.categoria, q.tema, q.subtema
  FROM questions_test q
  WHERE q.oposicion IS NOT NULL
  ORDER BY q.oposicion, q.categoria, q.tema;
END;
$$ LANGUAGE plpgsql;
```

✅ **Verificación:** Ejecuta `SELECT * FROM get_distinct_oposicion_categoria_tema();` y deberías ver las columnas: oposicion, categoria, tema, subtema.

---

### **PASO 2: Desplegar Edge Function Actualizada**

La Edge Function ahora extrae automáticamente la **oposición** de la ruta de carpetas.

```bash
cd /home/brayan/test-oposiciones

# Desplegar la función actualizada a Supabase
npx supabase functions deploy storage_sync_tracking_test
```

✅ **Verificación:** La función debería desplegar sin errores.

---

### **PASO 3: Reorganizar Carpetas en Supabase Storage**

Ve a **Supabase Dashboard → Storage → Tests** y reorganiza tus archivos con la nueva jerarquía:

**Estructura ANTERIOR (2 niveles):**
```
Tests/
  ├── Gestion-1/
  │   └── test_tema_10_subtema.txt
  └── Gestion-2/
      └── test_tema_17_subtema.txt
```

**Estructura NUEVA (3 niveles):**
```
Tests/
  └── Oposicion-Justicia/
      ├── Oposicion-Justicia-Gestion-1/
      │   └── test_tema_10_subtema.txt
      └── Oposicion-Justicia-Gestion-2/
          └── test_tema_17_subtema.txt
```

**Puedes usar la UI de Supabase Storage para:**
1. Crear la carpeta `Oposicion-Justicia`
2. Crear subcarpetas `Oposicion-Justicia-Gestion-1`, `Oposicion-Justicia-Gestion-2`, etc.
3. Mover los archivos .txt a las nuevas ubicaciones

---

### **PASO 4: Ejecutar Sincronización**

Una vez reorganizadas las carpetas, ejecuta la sincronización para que la Edge Function procese los archivos con la nueva estructura:

**Opción A: Desde el Admin Panel (RECOMENDADO)**
1. Ve a la app: `https://test-oposiciones-justicia.vercel.app/?admin=true`
2. Ingresa la contraseña del admin
3. Click en **"🔄 Sincronizar desde Storage"**
4. Espera a que termine (verás los logs en tiempo real)

**Opción B: Desde Supabase Dashboard**
1. Ve a **Edge Functions → storage_sync_tracking_test**
2. Click en **"Invoke"**
3. Revisa los logs

✅ **Verificación:** Los logs deberían mostrar:
```
✅ 10 preguntas sincronizadas (Oposición: Oposicion Justicia, Categoría: Oposicion Justicia Gestion 1)
```

---

### **PASO 5: Desplegar Frontend y Backend**

Los cambios en `App.tsx` ya están listos. Solo necesitas desplegar:

```bash
cd /home/brayan/test-oposiciones

# Frontend
cd frontend
vercel --prod

# Backend (si es necesario)
cd ../backend
vercel --prod
```

✅ **Verificación:** Abre la app y deberías ver el nuevo desplegable de 3 niveles.

---

## 🎯 Nuevas Funcionalidades

### **1. App Principal - Selección de 3 Niveles**

Al seleccionar "Por Categoría/Tema", ahora verás:

```
▶ Oposicion Justicia
  ▶ Oposicion Justicia Gestion 1
    ☐ Tema 10 - Procedimiento Laboral
    ☐ Tema 11 - Derecho Civil
  ▶ Oposicion Justicia Gestion 2
    ☐ Tema 17 - Proceso Penal
    ☐ Tema 18 - Jurisdicción Social
```

### **2. Admin Panel - Generador de iframes con 3 niveles**

Ahora el generador de iframes tiene 3 pasos:

1. **Selecciona Oposición:** Dropdown con las oposiciones disponibles
2. **Selecciona Categoría:** Dropdown con las categorías de esa oposición
3. **Selecciona Temas:** Checkboxes con los temas de esa categoría

El script generado incluirá el parámetro `&oposicion=...` en la URL.

### **3. iframes Generados**

Los scripts ahora incluyen el parámetro `oposicion`:

```html
<div id="test-container-temas-17-18"></div>

<script>
  var params = '?modo=bloqueado' +
               '&oposicion=Oposicion%20Justicia' +
               '&categoria=Oposicion%20Justicia%20Gestion%202' +
               '&temas=17,18' +
               '&user_id=' + encodeURIComponent(userId) +
               // ...
</script>
```

---

## 📊 Tabla Actualizada

La tabla `questions_test` ahora tiene esta estructura:

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `id` | serial | ID único | 1 |
| `pregunta` | text | Texto de la pregunta | "¿Qué es...?" |
| `opciones` | text[] | Array de 4 opciones | ["A", "B", "C", "D"] |
| `respuesta_correcta` | int | Índice correcto (1-4) | 2 |
| `explicacion_correcta` | text | Explicación de respuesta correcta | "La opción B..." |
| `explicacion_errada` | text | Explicación de respuesta errada | "Las otras..." |
| `tema` | int | **Número de tema** | 17 |
| `categoria` | text | **📌 Categoría (nivel 2)** | "Oposicion Justicia Gestion 2" |
| `oposicion` | text | **✨ Oposición (nivel 1) - NUEVO** | "Oposicion Justicia" |
| `subtema` | text | Subtema extraído del filename | "Proceso Penal" |
| `source_file` | text | Ruta del archivo en Storage | "Oposicion-Justicia/..." |
| `created_at` | timestamp | Fecha de creación | 2025-01-01 |

---

## 🔍 Verificación Final

### **Checklist:**

- [ ] ✅ SQL ejecutado en Supabase (columna `oposicion` creada)
- [ ] ✅ RPC function actualizada (`get_distinct_oposicion_categoria_tema`)
- [ ] ✅ Edge Function desplegada con soporte de 3 niveles
- [ ] ✅ Carpetas reorganizadas en Storage con jerarquía de 3 niveles
- [ ] ✅ Sincronización ejecutada (logs muestran oposición + categoría)
- [ ] ✅ Frontend desplegado (Vercel)
- [ ] ✅ Backend desplegado (si cambió)

### **Pruebas:**

1. **App Principal:**
   - Abre `https://test-oposiciones-justicia.vercel.app`
   - Click en "Comenzar Test"
   - Selecciona "Por Categoría/Tema"
   - Deberías ver desplegables de 3 niveles

2. **Admin Panel:**
   - Abre `https://test-oposiciones-justicia.vercel.app/?admin=true`
   - Ve a "Generador de Scripts"
   - Click en "Cargar Categorías y Temas"
   - Deberías ver 3 selectores: Oposición → Categoría → Temas

3. **iframe Generado:**
   - Genera un script desde el admin panel
   - Cópialo y pégalo en Teachable
   - El test debería cargar correctamente con los filtros aplicados

---

## 📝 Archivos Modificados

### **SQL:**
- ✅ `/sql/add_oposicion_column.sql` - Añade columna oposicion
- ✅ `/sql/update_rpc_with_oposicion.sql` - Actualiza RPC function

### **Edge Function:**
- ✅ `/supabase/functions/storage_sync_tracking_test/index.ts` - Extrae oposicion de ruta

### **Frontend:**
- ✅ `/src/App.tsx` - UI de 3 niveles + generador de iframe actualizado

---

## 🎓 Ejemplo de Uso

**Antes (2 niveles):**
```
Categoría: "Gestion 1"
  └── Tema 10 - Procedimiento Laboral
```

**Después (3 niveles):**
```
Oposición: "Oposicion Justicia"
  └── Categoría: "Oposicion Justicia Gestion 1"
      └── Tema 10 - Procedimiento Laboral
```

**Ventajas:**
- ✅ Puedes tener múltiples oposiciones en la misma app
- ✅ Mejor organización y escalabilidad
- ✅ Filtros más precisos en la app
- ✅ iframes bloqueados por oposición específica

---

## 🆘 Troubleshooting

### **Problema: No veo las oposiciones en el dropdown**
**Solución:**
1. Verifica que ejecutaste el SQL correctamente
2. Asegúrate de reorganizar las carpetas en Storage
3. Ejecuta la sincronización desde el admin panel
4. Revisa los logs para ver si hay errores

### **Problema: Los iframes antiguos dejaron de funcionar**
**Solución:**
Los iframes antiguos sin el parámetro `oposicion` **no funcionarán**. Necesitas regenerarlos desde el admin panel con la nueva estructura.

### **Problema: Edge Function falla al sincronizar**
**Solución:**
1. Ve a Supabase Dashboard → Edge Functions → storage_sync_tracking_test → Logs
2. Busca el error específico
3. Verifica que las carpetas sigan la estructura: `oposicion/categoria/archivo.txt`

---

## 📞 Contacto

Si tienes problemas con la implementación, revisa:
1. Los logs de la Edge Function en Supabase
2. Los logs del admin panel durante la sincronización
3. La consola del navegador para errores de JavaScript

**¡Todo listo para usar el sistema de 3 niveles! 🎉**
