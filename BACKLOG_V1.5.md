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

## 🎨 BLOQUE 5: Identidad de Marca Oficial "Kineo Ascent" y Niveles del Producto (Roadmap v1.6+)

1. **Identidad Visual Oficial (`Kineo Ascent`):**
   - **Emblema Oficial:** `"The Ascent K"` (`assets/kineo-ascent-mark.svg` y `kineo-ascent-app-icon.svg`).
   - **Paleta Estricta:**
     - **Deep Onyx (`#0B090E`):** Fondo principal.
     - **Solar Orange (`#FF5500`):** Acciones primarias, carga actual y perfil titular.
     - **Hyper Violet (`#8B5CF6`):** Perfil pareja (`1 Partner`), superseries y comparativas.
     - **Emerald (`#10B981`):** Estados guardados y series completadas (`✓`).
   - **Tipografía:** `Kineo Industrial` (Barlow Condensed ExtraBold Italic) en encabezados y `ui-monospace` en datos numéricos.
   - **Preview Interactivo HTML generado en:** `kineo-ascent-app-preview.html`.

2. **Modelo de Producto en 2 Niveles (Free vs. Suscripción):**
   - **Nivel Gratis (Actual):** Registro completo de ejercicios y sesiones colaborativas en vivo con **1 Partner** (o modo Individual).
   - **Nivel Suscripción (Futuro — Kineo Pro):** **Entrenador IA personalizado** + **Salas colaborativas de hasta 6 Partners** simultáneos.


1. **Fase 1 (Base & Persistencia):** Crear carpeta `./gym-tracker-v1.5` (conservando intacta `./gym-tracker-v1.4`), manteniendo las claves de `localStorage` compatibles y añadiendo el módulo de Exportar/Importar Respaldo JSON + Keystore fijo de Android.

---

## 📦 REGISTRO DE VERSIÓN: `Kineo v1.5.1` (Tandas de feedback)

### Reglas de proceso acordadas
1. **Versionado estricto:** cada iteración vive en su propia carpeta y tag. `gym-tracker-v1.5` y el release `v1.5.0` se mantienen como histórico. Las correcciones se construyen en `./gym-tracker-v1.5.1` (`versionName: "1.5.1"`, `versionCode: 6`, tag `v1.5.1`).
2. **Sin APK a medias:** no se compila ni publica un APK hasta que todos los componentes coincidan con el Preview HTML aprobado (`kineo-ascent-app-preview.html`).
3. **Capturas:** máximo 3 por comentario. Cada tanda se documenta aquí antes de implementar.

### Diseño aprobado (fuente de verdad)
- Fondo Deep Onyx `#0B090E`; superficies `#14111A`; bordes `#2A2533`; texto `#FFFFFF`; secundario `#A09BA8`.
- **Perfil titular = Solar Orange `#FF5500`** (acciones, carga activa, pestaña activa).
- **Perfil pareja = Hyper Violet `#8B5CF6`** (todo lo que cambia al seleccionar a la pareja).
- **Emerald `#10B981`** solo para confirmaciones (serie guardada, check, día completado).
- Tipografía de encabezados y botones principales: **Barlow Condensed ExtraBold Italic, mayúsculas**. Datos numéricos: monospace.
- Icono: emblema **Kineo Ascent** sobre Onyx, sin el icono por defecto de Capacitor.

### Tanda #1 (capturas recibidas)

**T1-01. Icono de la app sin actualizar (captura 1).**
- Causa: `android/app/src/main/res/mipmap-*` y `drawable-v24/ic_launcher_foreground.xml` conservan los recursos de Capacitor.
- Acción: generar `ic_launcher`, `ic_launcher_round` y `ic_launcher_foreground` en mdpi a xxxhdpi desde `assets/kineo-ascent-mark.svg`, con fondo `#0B090E` en `ic_launcher_background`. Revisar también `splash.png`.
- Criterio de aceptación: el icono en el cajón de apps muestra la "K" Ascent sobre negro.

**T1-02. Colores de perfil en localStorage (captura 2).**
- Causa: `profiles.user_1.accentColor` y `user_2.accentColor` guardados en la v1.4 siguen con verde `#10B981` y rosa `#EC4899`.
- Acción: migrar al cargar (`storageService.ts`): perfil 1 → `#FF5500`, perfil 2 → `#8B5CF6`. No se modifican nombres, historial ni claves.
- Criterio: no se pierde ningún dato registrado (la prueba de la v1.5 confirmó que el historial se conserva).

**T1-03. Portada de "Entrenar": bloque de rachas antiguo (captura 2).**
- Causa: `StreakBanner.tsx` conserva el diseño v1.4 (degradado ámbar/rosa, texto largo, "Dúo: N sesiones juntos", meta "1 de 3-5 días").
- Acción: reemplazar por la tarjeta **Constancia semanal** del preview: solo el perfil activo, número grande con "sesión(es) completada(s) esta semana", fila L M X J V S D.
- Criterio: coincide con la portada del preview aprobado.

**T1-04. Tarjeta "Sesión lista para hoy" (captura 2).**
- Causa: fondo azulado, etiquetas en verde, título y botón en tipografía normal.
- Acción: fondo `#14111A`, números de ejercicio en color del perfil, título y botón `COMENZAR SESIÓN X ↗` en Barlow Condensed ExtraBold Italic, botón en `--theme`.

**T1-05. Pestaña Progreso con colores antiguos (captura 3).**
- Causa: `ProgressDashboard.tsx` usa verde `#10B981`, rosa `#EC4899` y tarjetas `slate-900`.
- Acción: tarjetas `#14111A`, filtros y métricas con Solar para el titular y Violet para la pareja, encabezados en Barlow Condensed.

**T1-06. La gráfica de volumen cae a 0 cuando los días no coinciden (captura 3).**
- Causa: `volumeChartData` calcula un punto por fecha y asigna `0` al perfil que no entrenó ese día. Así, Adolfo aparece en 0 el 10-22 y Dani en 0 el 10-21, y las líneas bajan artificialmente.
- Acción: usar `connectNulls` y dejar `null` (no `0`) en los días sin sesión del perfil, o graficar por número de sesión (S1, S2…).
- Criterio: una sesión no registrada no genera un descenso falso.

### Pendiente antes de compilar v1.5.1
- Restaurar `gym-tracker-v1.5` al commit `b37ca06` (antes de la modificación parcial de hoy) para dejar el histórico limpio.
- Crear `gym-tracker-v1.5.1` a partir de ese estado y aplicar T1-01 a T1-06.
- Verificar con `npm.cmd run build` y revisar en capturas antes de publicar.

### Tanda #2 (capturas recibidas: Progreso catálogo, Ajustes x2)

**T2-01. Catálogo "Ejercicios realizados" con colores antiguos (`ProgressDashboard.tsx`).**
- Causa: tarjetas en `slate-900`; etiquetas de equipo en verde; marcas de Adolfo en verde y de Dani en rosa.
- Acción: tarjetas `#14111A` con borde `#2A2533`; etiquetas de equipo neutras (`#0B090E`); mejor carga del titular en Solar `#FF5500` y de la pareja en Violet `#8B5CF6`.
- Criterio: al tocar la pareja, las cifras del catálogo cambian de color al violeta.

**T2-02. Ajustes con paleta antigua (`SettingsAndMesocycle.tsx`).**
- Causa: botones "Conectar Sala" y "Guardar Perfiles" en verde; "Dueño de este teléfono", "Perfil 1" en verde, "Perfil 2" en rosa; "Semana del mesociclo" con badge y botón activo en ámbar; fondos `slate-900`.
- Acción: botones en `--theme`, tipografía display en mayúsculas; títulos y bordes en `#14111A` / `#2A2533`; semana activa en `--theme`.
- Criterio: la pantalla de Ajustes usa solo Onyx, Surface, Solar y Violet (Emerald únicamente para confirmaciones).

**T2-03. Campos numéricos sin etiqueta (`SettingsAndMesocycle.tsx`, perfiles).**
- Causa: las cajas de edad, peso y estatura muestran los números (`32`, `111`, `187`) sin rótulo visible.
- Acción: etiquetas fijas encima de cada caja: `EDAD`, `PESO (KG/LB)`, `ALTURA (CM)`.
- Criterio: se entiende qué representa cada valor sin tocarlo.

**T2-04. Color de perfil fijado al guardar (`handleSaveProfiles`).**
- Causa: el código escribe `accentColor: gender === 'female' ? '#EC4899' : '#10B981'`, por lo que cada "Guardar perfiles" restaura el verde y el rosa antiguos.
- Acción: Perfil 1 siempre `#FF5500`; Perfil 2 siempre `#8B5CF6`. Corregir también la migración de T1-02 para que no haya dos fuentes de color.
- Criterio: tras guardar, los colores de perfil no cambian.

**T2-05. Tarjetas redundantes en Ajustes (propuesta de simplificación).**
- Causa: la tarjeta "Dueño de este teléfono" ocupa espacio vertical aparte de "Datos de perfiles".
- Propuesta: integrar "Invertir titular" y "Asistente" en la cabecera de Perfiles.
- Estado: pendiente de aprobación del usuario antes de implementar.

### Checklist consolidado para v1.5.1
- T1-01 a T1-06 (tanda #1) y T2-01 a T2-04 (tanda #2): obligatorios.
- T2-05: opcional, requiere aprobación.
- Antes de compilar: restaurar `gym-tracker-v1.5` al commit `b37ca06` y crear `gym-tracker-v1.5.1`.
- Verificación: `npm.cmd run build`, revisión en capturas de Inicio, Entrenar, Progreso y Ajustes con ambos perfiles.

### Tanda #3 (capturas: Ajustes ➔ Peso Ideal, Guía, Asistente/Modo)

> **Nota de verificación:** los hallazgos de esta tanda se derivaron del código fuente (`SettingsAndMesocycle.tsx`, `IdealWeightCalculator.tsx`, `FitnessGuide.tsx`, `OnboardingWizard.tsx`, `ExerciseAnimationViewer.tsx`). Las imágenes no fueron visibles en la sesión de análisis, por lo que cada ítem debe confirmarse contra la captura correspondiente antes de implementarse.

**T3-01. Calculadora "Peso Ideal" con paleta antigua (`IdealWeightCalculator.tsx`).**
- Causa: cabecera con degradado esmeralda (`from-emerald-950/60`); puntos de perfil con `accentColor` heredado; selector bilateral "Peso Total / Peso de 1 Solo Lado" en ámbar; botones RIR en verde; tarjetas de resultado en ámbar, verde, rosa; botón "Guardar y Fijar Peso Ideal" en degradado verde/teal.
- Acción: color de acento dinámico (`--theme`) según el perfil elegido en "1. ¿Para quién es la prueba?": Solar `#FF5500` (titular) o Violet `#8B5CF6` (pareja). Tarjetas `#14111A` con borde `#2A2533`. Títulos de resultado y botón principal en Barlow Condensed ExtraBold Italic. Banner de confirmación "✓ Peso ideal aplicado" en Emerald.
- Criterio: al cambiar de perfil, toda la calculadora cambia de color; Emerald solo en la confirmación.

**T3-02. Guía del gimnasio con paleta antigua (`FitnessGuide.tsx`).**
- Causa: cabecera índigo (`from-indigo-950/60`); píldora de categoría activa en `bg-emerald-500`; etiqueta de categoría en `text-emerald-400`; bloque "Consejo Kineo" en ámbar.
- Acción: cabecera y tarjetas en `#14111A` / `#2A2533`; píldora activa, categoría y "Consejo Kineo" en `--theme`; checks de pasos en Emerald.
- Criterio: la Guía no contiene índigo, ámbar ni verde fuera de Emerald para confirmaciones.

**T3-03. Asistente inicial (`OnboardingWizard.tsx`) con paleta antigua y colores de perfil incorrectos.**
- Causa: fondo `#090D16`; botones de "Continuar" y "Entrar" en verde/teal; tarjetas de pareja en rosa (`pink-500`); al finalizar asigna `#10B981` / `#EC4899` (o `#6366F1` como fallback) a los perfiles, reintroduciendo los colores antiguos en instalaciones nuevas.
- Acción: fondo `#0B090E`, tarjetas `#14111A`; titular Solar `#FF5500`, pareja Violet `#8B5CF6`; asignar `accentColor` fijo por `user_id` (no por género). Eliminar el fallback `#6366F1`. El texto "Kineo v1.5" pasa a "Kineo v1.5.1".
- Criterio: instalación nueva y perfiles guardados producen los mismos colores.

**T3-04. Bloque "Modo de Entrenamiento" y "Sesión Compartida en Vivo" (`SettingsAndMesocycle.tsx`).**
- Causa: opción "Individual" seleccionada en esmeralda (`bg-emerald-500/20`), "En Pareja" en rosa (`bg-pink-500/20`), tarjeta de sala en degradado índigo, botones "Conectar Sala" en verde y "Crear Nuevo Código" en gris.
- Acción: opción activa en el color del modo (Individual = Solar, En Pareja = Violet), tarjeta de sala en `#14111A`, botón "Conectar Sala" en `--theme`, badge de estado conectado en Emerald.
- Criterio: el selector de modo no usa rosa ni índigo.

**T3-05. Tarjeta "Dueño de este teléfono" y botones de cabecera de Perfiles (`SettingsAndMesocycle.tsx`).**
- Causa: icono de smartphone en esmeralda; botón "Cambiar Titular" en texto esmeralda; botón "Asistente" en gris. Relacionado con T2-05 (pendiente de aprobación).
- Acción: si se aprueba T2-05, integrar ambas acciones en la cabecera de "Datos de Perfiles" con estilo `--theme`.

**T3-06. Tarjeta "Datos de Perfiles" con colores de cabecera y botón (`SettingsAndMesocycle.tsx`).**
- Causa: icono de usuarios en esmeralda; títulos "Perfil 1" / "Perfil 2" con colores heredados; botón "Guardar Perfiles" en `bg-emerald-500`; mensaje "✓ Guardado" en esmeralda.
- Acción: botón "Guardar Perfiles" en `--theme` del perfil activo; mensaje de confirmación en Emerald. Complementa T2-03 y T2-04.

**T3-07. Semana del mesociclo en ámbar (`SettingsAndMesocycle.tsx`).**
- Causa: badge "Semana X/6" en `bg-amber-500/20`; botón de semana activa en `bg-amber-500`; aviso de semana 6 en fondo ámbar; icono de calendario en ámbar.
- Acción: semana activa y badge en `--theme`; aviso de semana 6 en `#14111A` con borde `--theme`.
- Criterio: la pantalla de Ajustes no conserva ámbar.

**T3-08. Visor de demostración (`ExerciseAnimationViewer.tsx`) con verde fijo.**
- Causa: `accentColor` por defecto `#10B981`; borde `border-emerald-500/40`; etiqueta "Demostración Real" en verde; botón "Ver Inicio y Final" con icono verde.
- Acción: el visor toma el `--theme` del perfil que está entrenando; Emerald solo para el estado "Posición final completada". Sin cambios de comportamiento.

**Pendiente de la Tanda #3:** confirmar T3-01 a T3-08 contra las capturas y completar las capturas restantes ("aún faltan algunas", según el usuario) antes de tocar código.

### Tanda #4 (capturas: Peso Ideal parte superior, Peso Ideal resultados, Guía)

> **Nota de verificación:** en esta sesión sí se recibieron las imágenes. Los hallazgos describen lo observado en pantalla y se cruzan con el código fuente.

**T4-01. Sub-pestañas de Ajustes con píldora activa en verde (`SettingsAndMesocycle.tsx`).**
- Observado: header (`ADOLFO` naranja) y barra inferior (`Ajustes` naranja) ya están en Ascent, pero la píldora activa (`Peso Ideal` / `Guía`) es verde `bg-emerald-500` sobre contenedor `bg-slate-900/90`.
- Acción: contenedor `#14111A` con borde `#2A2533`; píldora activa en `--theme` (Solar o Violet según perfil activo), tipografía Barlow Condensed ExtraBold Italic en mayúsculas.
- Criterio: ninguna píldora de navegación es verde.

**T4-02. Calculadora Peso Ideal, parte superior (`IdealWeightCalculator.tsx`).**
- Observado: banner con degradado verde e icono verde; selector "¿Para quién es la prueba?" con punto verde (Adolfo) y rosa (Dani), y botón seleccionado solo con borde gris; aviso bilateral en ámbar con botón "Peso Total" en `bg-amber-500`; texto de desglose "Discos: 10 kg de cada lado" y botón "RIR 2" en verde.
- Acción: banner en `#14111A`; puntos Solar `#FF5500` (Adolfo) y Violet `#8B5CF6` (Dani); la selección de perfil del módulo se sincroniza con el selector superior; aviso bilateral, botones y desgloses en `--theme`; botón RIR activo en `--theme`.
- Criterio: la calculadora cambia de color al cambiar de perfil y no usa verde ni ámbar.

**T4-03. Calculadora Peso Ideal, resultados y pirámide (`IdealWeightCalculator.tsx`).**
- Observado: zonas en tres colores ajenos (Fuerza ámbar, Peso Ideal verde, Tonificación rosa); desgloses "Discos: X kg de cada lado" en ámbar dentro de tarjetas `slate-900`; botón "Guardar y Fijar Peso Ideal para Adolfo" en degradado verde/teal.
- Acción: tarjetas `#0B090E` con borde `#2A2533`; tarjeta central "PESO IDEAL (8-10 REPS)" destacada en `--theme`; cifras en `ui-monospace` extra-bold; escalones de pirámide con borde `--theme`; botón principal `.solar-btn` en `--theme`; Emerald solo para el badge "Zona Segura" y la confirmación al guardar.
- Criterio: resultados sin ámbar, rosa ni verde salvo confirmaciones.

**T4-04. Guía del gimnasio (`FitnessGuide.tsx`).**
- Observado: banner e icono en índigo (`from-indigo-950/60`); píldora "Todas" activa en verde; etiquetas de categoría ("PLANIFICACIÓN", "TÉCNICAS AVANZADAS") en verde; recuadro "Consejo Kineo" en ámbar.
- Acción: banner y tarjetas en `#14111A` con borde `#2A2533`; píldora activa, categoría y "Consejo Kineo" en `--theme`; checks de pasos en Emerald; títulos en Barlow Condensed ExtraBold Italic.
- Criterio: la Guía no usa índigo; el verde queda solo en los checks de confirmación.

### Tanda #5 (capturas: Sesión activa, acordeón, tabla de series, descanso y cierre)

> **Nota de verificación:** hallazgos cruzados con el código fuente (`App.tsx`, `ExerciseSlotCard.tsx`, `ExerciseAnimationViewer.tsx`, `RestTimerBar.tsx`).

**T5-01. Selector de perfiles duplicado en la cabecera de sesión activa (`App.tsx`, ~l. 914–979).**
- Observado: tarjeta con `★ Adolfo 0/15 series` en `bg-emerald-950/30` y `Dani 0/15 series` en `bg-pink-950/30`; duplica el conmutador del header.
- Acción: eliminar el duplicado o convertirlo en barra de progreso Ascent (`#14111A`, borde `#2A2533`), título en Barlow Condensed y contador en `--theme`.

**T5-02. Cabecera de cada ejercicio en acordeón (`ExerciseSlotCard.tsx`, ~l. 237–303).**
- Observado: fondo `bg-slate-900/95`, borde `slate-700`; número `#N` en verde fijo; badge de superserie en índigo.
- Acción: tarjeta `#14111A`; al expandir, borde y número en `--theme` (`.ex-card.expanded`); Emerald solo cuando `allSetsDone`; superserie en Violet/`--theme`; contador `ui-monospace` sobre `#0B090E`.

**T5-03. Herramientas del ejercicio y nota del entrenador (`ExerciseSlotCard.tsx`, ~l. 309–400 y 680–711).**
- Observado: botones Demo (verde), Cambiar Máquina (ámbar), Historial (índigo), Compartido (rosa/gris), Calibrar (verde); nota en caja índigo; selector de técnica multicolor (ámbar, morado, cian, rosa).
- Acción: herramientas como `.tool-pill` (`#0B090E`, borde `#2A2533`, activa en `--theme`); nota como `.coach-note` con borde izquierdo 3px `--theme`; técnicas como `.tech-btn` (activa en `--theme`).

**T5-04. Modal "Cambiar Máquina" y bloque "Calibrar peso / Prueba rápida" (`ExerciseSlotCard.tsx`, ~l. 466–677).**
- Observado: modal ámbar (`bg-amber-950/20`); bloque de primera vez con degradado ámbar-esmeralda y botones `bg-amber-500`.
- Acción: `.calib-box` (`#0B090E`, borde `--theme`), inputs `.clean-input`, selector Peso Total / Por Lado ×2 en `--theme`, confirmación `✓ FIJAR PESO IDEAL` en `--theme` (Emerald solo como confirmación).

**T5-05. Tabla de series (`ExerciseSlotCard.tsx`, ~l. 714–926).**
- Observado: filas `bg-slate-950/80`, foco de input verde; texto de carga en ámbar; sub-bloque dropset en cian.
- Acción: `.set-row` (`#0B090E`, borde `#2A2533`); serie completada con borde `rgba(16,185,129,0.55)`; `.load-hint` en `ui-monospace` y `--theme`; `.check-btn` pendiente `#14111A`, completado Emerald con check `#0B090E`; escalones de dropset con acento `--theme`.

**T5-06. Visor de demostración y gráfica inline (`ExerciseAnimationViewer.tsx`, `ExerciseSlotCard.tsx` ~l. 398–456).**
- Observado: visor con borde/etiqueta/botones verdes e índigo; gráfica inline con borde índigo y líneas con `accentColor` heredado.
- Acción: visor y gráfica con `#14111A`/`#0B090E` y borde `#2A2533`; líneas forzadas a `#FF5500` (titular) y `#8B5CF6` (pareja); Emerald solo en los checks de pasos.

**T5-07. Descanso, cierre de sesión y navegación (`RestTimerBar.tsx`, `App.tsx` ~l. 795, 1027, 1118).**
- Observado: barra de descanso con borde verde, progreso verde→rosa, botón Saltar rojo; tarjeta "¿Terminaron la sesión?" con degradado verde/rosa; tarjeta "Sesión Completada" con degradado verde/índigo; navegación inferior `#090D16` sin el formato `01 / ENTRENAR` del preview.
- Acción: barra de descanso `#14111A` con borde y progreso en `--theme` (Emerald en `¡LISTO!`); botón `.solar-btn` "FINALIZAR Y GUARDAR SESIÓN X" en `--theme`; tarjeta completada en `#14111A` con borde Emerald; navegación `#0B090E` con etiquetas `01 / ENTRENAR`, `02 / PROGRESO`, `03 / AJUSTES`.

### Decisiones de la Tanda #5 y cierre de captura
- **T2-05 / T3-05 (Dueño de este teléfono):** el usuario confirma que el bloque actual está bien. **Se mantiene como está; no se integra en la cabecera de Perfiles.** Los botones "Cambiar Titular" y "Asistente" conservan su ubicación.
- **Capturas:** el usuario confirma que no quedan más capturas por enviar. Las tandas #1 a #5 quedan completas para el alcance de v1.5.1.

### Estado de Git verificado (antes de ejecutar)
- `HEAD` de `gym-tracker-v1.5` = `6dff0d0` ("feat(ui): Kineo Ascent identity…"), **no** `b37ca06`. Ese commit ya contiene parte del rediseño Ascent, por lo que la restauración a `b37ca06` es necesaria para dejar `v1.5` limpio como histórico.
- Este archivo `BACKLOG_V1.5.md` tiene cambios sin commitear.

### Plan de ejecución v1.5.1 (pendiente de aprobación; no ejecutado)
1. Crear `./gym-tracker-v1.5.1` a partir de `b37ca06` (sin tocar `./gym-tracker-v1.5` ni sus tags).
2. Aplicar T1-01 a T1-06, T2-01 a T2-04, T3-01 a T3-08, T4-01 a T4-04 y T5-01 a T5-07 contra `kineo-ascent-app-preview.html`.
3. Mantener claves de `localStorage` `_v1_4` y el keystore `kineo-shared.keystore`; migrar `accentColor` a Solar/Violet.
4. Verificar con `npm.cmd run build`, `npx.cmd cap sync android` y revisión visual con ambos perfiles.
5. Compilar `Kineo-v1.5.1.apk` (`versionCode: 6`, `versionName: "1.5.1"`) y publicar tag `v1.5.1` solo tras aprobación.

**Pendiente:** aprobación explícita del usuario para ejecutar el plan anterior.
2. **Fase 2 (UI Limpia, Acordeón y Corrección de Inputs):**
   - Corregir los inputs numéricos de la Prueba de Fuerza (`21+` reps libres) y de las series (sin `012`).
   - Implementar el acordeón exclusivo (1 solo ejercicio expandido a la vez), nota del entrenador fija y concisa, eliminación del botón `Pareja` (vista doble) y eliminación de la demostración en la pestaña `Peso Ideal`.
3. **Fase 3 (Claridad de Pesos por Lado / Mancuerna / Barra):**
   - Incorporar el desglose visual automático *"X kg por lado"* / *"X kg por mancuerna"* tanto en la calculadora/prueba como en cada serie de la rutina.
4. **Fase 4 (Modo Individual/Pareja + Kineo AI Coach):**
   - Integrar el interruptor global Individual vs. Pareja y la pestaña/asistente de Entrenador IA con API Key local.
5. **Fase 5 (Compilación APK v1.5 en GitHub Actions):**
   - Subir a `acamachov711-maker/kineo-app` y generar `Kineo-v1.5.apk` listo para actualizar.

---

## ✅ ESTADO DE EJECUCIÓN: Kineo v1.5.1 (carpeta ./gym-tracker-v1.5.1)

**Versión:** ersionName 1.5.1, ersionCode 6, package.json 1.5.1. Keystore fijo kineo-shared.keystore (alias kineokey) conservado.

**Base:** ./gym-tracker-v1.5.1 creada desde 37ca06. ./gym-tracker-v1.5 no se ha modificado.

**Aplicado (tandas #1 a #5):**
- T1-01 Iconos: mipmap-* (mdpi a xxxhdpi) generados desde kineo-ascent-app-icon-8k.png; fondo adaptativo #0B090E; splash Onyx con K; eliminado el icono vectorial de Capacitor.
- T1-02 / T2-04 / T3-03: ccentColor fijo por id (user_1 = #FF5500, user_2 = #8B5CF6) en storageService.ts (migración al cargar), handleSaveProfiles y OnboardingWizard. Sin fallback #6366F1.
- T1-03 / T1-04: portada con "Constancia semanal" (perfil activo) y tarjeta "Sesión lista" en Ascent.
- T1-05 / T2-01: Progreso y catálogo sin verde/rosa/slate; colores por perfil.
- T1-06: gráfica de volumen con 
ull en días sin sesión y connectNulls.
- T2-02 / T2-03 / T3-04 a T3-07: Ajustes en paleta Ascent; etiquetas de perfil; semana del mesociclo en --theme.
- T3-01 / T4-02 / T4-03: calculadora de peso ideal en --theme; Emerald solo en confirmaciones.
- T3-02 / T4-04: Guía sin índigo ni ámbar.
- T3-08 / T5-06: visor de demostración y gráfica inline en Ascent.
- T5-01: eliminado el selector de perfiles duplicado en sesión activa.
- T5-02 a T5-05: acordeón, herramientas, nota del entrenador, modal de alternativas, calibración y tabla de series en Ascent.
- T5-07: barra de descanso, botón de cierre, tarjetas y navegación  1 / ENTRENAR,  2 / PROGRESO,  3 / AJUSTES.
- T2-05: **no aplicado** (decisión del usuario: se mantiene la ubicación actual de "Dueño de este teléfono").
- Ejercicios: tipografía display en Barlow Condensed 800 Italic (importada en index.css).

**Verificación:**
- 	sc --noEmit: OK.
- 
pm run build (Vite): OK.
- 
px cap sync android: OK.
- gradlew assembleRelease local: **no ejecutable en este equipo** (error TLS al descargar Gradle y Java local 1.8; Capacitor 8 requiere Java 21). Se compila en GitHub Actions (Node 22 + Java 21).

**Pendiente antes de publicar:**
- Revisión visual en dispositivo (captura con ambos perfiles) de Entrenar, Progreso, Ajustes y sesión activa.
- Commit, tag 1.5.1 y push a origin: **no ejecutados** (requieren confirmación explícita).
