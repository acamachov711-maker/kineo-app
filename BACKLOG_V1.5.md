# 📋 Kineo — Registro Oficial de Requerimientos y Plan Maestro (Backlog v1.5)

> **Estado actual en producción/uso:** `Kineo v1.4` (`./gym-tracker-v1.4`) — Instalada vía APK Android (`com.kineo.app`).  
> **Regla de Ejecución:** Este documento registra y planifica todos los requerimientos acumulados. **Ningún cambio de código se ejecutará en la aplicación sin previa autorización explícita del usuario.**

---

## 🛠️ BLOQUE 1: Correcciones de Usabilidad y Pruebas de Campo en Gimnasio (Feedback v1.4)

### 1.1. Corrección del Input de Repeticiones en Prueba de Fuerza (Permitir 21+ reps y borrar libremente)
- **Problema detectado en v1.4 (`ExerciseSlotCard.tsx`):**
  - El campo `"Reps logradas"` en la prueba rápida tenía `max="20"` y forzaba `parseInt(e.target.value, 10) || 1` en cada pulsación. Al borrar el número para escribir `21`, el input insertaba un `1` automáticamente y solo permitía escribir cifras que empezaran con `1`.
  - En la calculadora de `IdealWeightCalculator.tsx`, el control era un slider limitado de `3` a `15` repeticiones.
- **Solución técnica para v1.5:**
  - Cambiar el estado `quickRepsInput` a string editable (`Record<'user_1' | 'user_2', string>`) para permitir vaciar la caja (`""`) mientras se escribe cualquier número (ej. `21`, `25`, `30`) sin límites artificiales de 20.
  - Hacer el cálculo matemático con el número parseado solo cuando sea válido (`>= 1`).
  - En `IdealWeightCalculator.tsx`, reemplazar o complementar el slider por un campo numérico libre (`1` a `50+` reps).

### 1.2. Corrección de Ceros a la Izquierda (`012`, `035`) al Editar Repeticiones de Series
- **Problema detectado en v1.4 (`ExerciseSlotCard.tsx`):**
  - En las filas de series, el input de repeticiones tenía `value={s.actualReps}`. Cuando el usuario borraba el valor, `isNaN(reps) ? 0 : reps` guardaba un `0` numérico, provocando que al escribir `12` o `35` quedara `012` o `035`.
- **Solución técnica para v1.5:**
  - Mostrar `value={s.actualReps > 0 ? String(s.actualReps) : ''}` con `placeholder={s.targetReps}` y sanitizar la entrada eliminando ceros iniciales (`e.target.value.replace(/^0+(?=\d)/, '')`).

### 1.3. Eliminación del Botón Colaborativo ("Pareja") en la Barra Superior
- **Problema detectado en v1.4 (`App.tsx`):**
  - La barra superior tenía 3 opciones (`Pareja` | `Adolfo` | `Dani`). La vista doble (`both`) satura la pantalla vertical del móvil.
- **Solución técnica para v1.5:**
  - Eliminar por completo la opción `both` (`👥 Pareja`).
  - Si la app está en **Modo Pareja**, el selector superior mostrará únicamente **2 botones directos**: **`Adolfo`** y **`Dani`** para alternar instantáneamente con 1 toque entre tus series y las de tu pareja.
  - Si la app está en **Modo Individual**, ese selector ni siquiera ocupará espacio.

### 1.4. Acordeón Exclusivo de Ejercicios (Contraídos por defecto, 1 abierto a la vez)
- **Problema detectado en v1.4:**
  - Todos los ejercicios de la sesión se mostraban desplegados al mismo tiempo, generando una pantalla muy larga y saturada de texto.
- **Solución técnica para v1.5:**
  - Crear el estado `expandedSlotId: string | null` en `App.tsx` (iniciando con el primer ejercicio `#1` o todos contraídos según preferencia, y al tocar cualquier tarjeta de ejercicio se expande **únicamente esa** y se contraen automáticamente todas las demás).
  - **Vista Contraída (Cabecera Limpia):** Muestra solo `#Orden`, Nombre del Ejercicio, Equipo, Progreso de series (`2/4 listas` con check verde si ya se completó) y peso actual.
  - **Vista Expandida:** Muestra el detalle completo del ejercicio activo.

### 1.5. Reducción de Saturación de Texto y "Nota del Entrenador" Siempre Visible
- **Problema detectado en v1.4:**
  - Había demasiadas etiquetas largas y la nota del entrenador estaba oculta detrás de un botón pequeño de flecha (`showTips`).
- **Solución técnica para v1.5:**
  - Eliminar el botón `showTips` (`ChevronDown`/`ChevronUp`).
  - Dejar la **Nota del Entrenador + Cues de Técnica** siempre visible dentro del ejercicio expandido en un bloque compacto, limpio y directo (máximo 2 líneas claras sin texto redundante).

### 1.6. Quitar la Demostración en la Pestaña "Peso Ideal"
- **Problema detectado en v1.4 (`IdealWeightCalculator.tsx`):**
  - En `Ajustes ➔ Peso Ideal` aparecía el componente `<ExerciseAnimationViewer />` ocupando media pantalla antes de la calculadora.
- **Solución técnica para v1.5:**
  - Eliminar `<ExerciseAnimationViewer />` de `IdealWeightCalculator.tsx`. La demostración visual solo existirá cuando el usuario toque el botón `"Demostración"` dentro de su sesión de entrenamiento.

### 1.7. Indicador Claro de Peso por Lado / Mancuerna / Barra (Caso Hip Thrust, Prensa, Mancuernas)
- **Problema detectado en v1.4:**
  - Al hacer la prueba o ver el peso sugerido en ejercicios bilaterales como **Hip Thrust con Barra**, **Prensa 45°** o **Mancuernas**, no quedaba claro si el peso mostrado era el total o el peso que debía colocarse en cada lado/mano.
- **Solución técnica para v1.5 (`fitnessMath.ts` + `ExerciseSlotCard.tsx` + `IdealWeightCalculator.tsx`):**
  - Crear una función inteligente de desglose de carga (`getEquipmentLoadBreakdown(weightKg, equipment, exerciseName, unit)`) que muestre una etiqueta clara debajo de cada peso sugerido y de cada serie:
    - **Para Barra (`Hip Thrust`, `Press de Banca`, `Peso Muerto con Barra`):**  
      Indica claramente: **`Peso Total: 60 kg ➔ Pon 20 kg por lado (+ barra de 20 kg)`** *(o si es sin contar barra: `30 kg de cada lado`)*, permitiendo además elegir en la prueba si ingresaste el "Peso Total" o el "Peso por Lado".
    - **Para Prensa 45° / Hack (Máquinas de discos por lado):**  
      Indica claramente: **`Total en discos: 80 kg ➔ Pon 40 kg de cada lado`**.
    - **Para Mancuernas (`Press Pecho`, `Press Militar`, `Zancadas`, `Curls`):**  
      Indica claramente: **`20 kg por CADA mancuerna (en cada mano)`** (así nunca hay duda de si se divide entre dos).
    - **Para Poleas / Máquinas de Placas (`Jalón`, `Extensión Cuádriceps`, `Abducción`):**  
      Indica claramente: **`Pin directo en placa: 40 kg`**.

---

## 🛡️ BLOQUE 2: Blindaje de Historial y Actualizaciones sin Pérdida de Datos

1. **Conservación de Llaves de Almacenamiento (`storageService.ts`):**
   - Mantener intactas las llaves `kineo_history_v1_4`, `kineo_profiles_v1_4`, etc. en la v1.5 para que la nueva versión lea automáticamente todo lo entrenado en la v1.4.
2. **Firma Digital Fija (`kineo-release.keystore`) en GitHub Actions:**
   - Generar e integrar un `keystore` único del proyecto en Android para que todos los APKs compilados en el futuro tengan la misma firma criptográfica y Android permita instalarlos encima pulsando **"Actualizar"** sin borrar datos.
3. **Exportar / Importar Respaldo JSON en 1 Toque:**
   - Botón en **Ajustes** para descargar/copiar todo el historial y perfiles en formato JSON y restaurarlo cuando se desee.

---

## 👤 BLOQUE 3: Modo Individual (Solo) vs. Modo En Pareja (Duo)

1. **Selector desde el Onboarding Inicial y en Ajustes:**
   - Permitir elegir desde el primer instante si la app se usará de forma **Individual (1 persona)** o **En Pareja (2 personas)**.
2. **Interfaz 100% Individual cuando se elige "Solo":**
   - Oculta selectores de pareja en el encabezado, oculta botones de `Mismo Ejercicio / Individual` en los ejercicios y dedica las gráficas y pantallas exclusivamente al usuario titular.

---

## 🤖 BLOQUE 4: Arquitectura de "Kineo AI Coach" (Entrenador Personalizado con IA)

1. **Generador de Rutinas y Mesociclos Personalizados:**
   - Conexión mediante API (Google Gemini `gemini-2.5-flash` con capa gratuita recomendada, Groq o OpenAI) configurando la API Key de forma privada en el teléfono.
2. **Seguimiento Post-Entrenamiento ("Coach Feedback"):**
   - Lectura del historial real de series y repeticiones para recomendar incrementos de peso exactos en la siguiente sesión.
3. **Adaptador de Sesión del Día:**
   - Ajuste rápido de la sesión activa según tiempo disponible o fatiga/molestias musculares.

---

## 🗺️ Plan de Acción Paso a Paso (Para cuando autorices construir la v1.5)

1. **Fase 1 (Base & Persistencia):** Crear carpeta `./gym-tracker-v1.5` (conservando intacta `./gym-tracker-v1.4`), manteniendo las claves de `localStorage` compatibles y añadiendo el módulo de Exportar/Importar Respaldo JSON + Keystore fijo de Android.
2. **Fase 2 (UI Limpia, Acordeón y Corrección de Inputs):**
   - Corregir los inputs numéricos de la Prueba de Fuerza (`21+` reps libres) y de las series (sin `012`).
   - Implementar el acordeón exclusivo (1 solo ejercicio expandido a la vez), nota del entrenador fija y concisa, eliminación del botón `Pareja` (vista doble) y eliminación de la demostración en la pestaña `Peso Ideal`.
3. **Fase 3 (Claridad de Pesos por Lado / Mancuerna / Barra):**
   - Incorporar el desglose visual automático *"X kg por lado"* / *"X kg por mancuerna"* tanto en la calculadora/prueba como en cada serie de la rutina.
4. **Fase 4 (Modo Individual/Pareja + Kineo AI Coach):**
   - Integrar el interruptor global Individual vs. Pareja y la pestaña/asistente de Entrenador IA con API Key local.
5. **Fase 5 (Compilación APK v1.5 en GitHub Actions):**
   - Subir a `acamachov711-maker/kineo-app` y generar `Kineo-v1.5.apk` listo para actualizar.
