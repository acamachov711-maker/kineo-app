# Kineo Ascent — Backlog de Mejoras v1.6 (Feedback de Pruebas en Gimnasio)

> **Base de partida:** `v1.5.1` (`3565622`)  
> **Carpeta de trabajo:** `./gym-tracker-v1.6`  
> **Estado:** ✅ Implementación completa y auditada (`V1.6-01` a `V1.6-13` + 21 Animaciones MP4 + 4 Transiciones + Build Web & Capacitor Sync verificados).

---

## 1. Requerimientos Aprobados para Implementación en `Kineo v1.6`

### V1.6-01 — Input de Peso Decimal Libre (`2.5 lb`) y Corrección del Bloqueo en `LB` (`4.5 lb`)
- **Problema observado en campo:**
  1. En algunos ejercicios o pruebas se usan incrementos con decimales (ej. `2.5 lb`, `12.5 lb`, `17.5 kg`), pero el input controlado formateaba el valor en cada pulsación y borraba el punto decimal (`2.` -> `2`), impidiendo escribir decimales cómodamente o vaciar el input por completo antes de teclear un nuevo número.
  2. Cuando la unidad global está en **LB** y un usuario tiene un peso como `41.5 lb` (`19 kg` internos) e intenta borrar el `1.5` para escribir `40`, el input queda atrapado en `4.5` porque `lbToKg(4)` redondeaba forzosamente a múltiplos de `0.5 kg` (`2.0 kg` -> `4.5 lb`).
- **Solución técnica para `v1.6`:**
  - Implementar un estado local de edición (`draftWeight: string`) en los inputs de peso (`ExerciseSlotCard` e `IdealWeightCalculator`) que permita borrar todo el campo (`""`) y escribir libremente números con `.` o `,` (`2.5`, `12.5`, `40`), aplicando la conversión únicamente en `onBlur` / `Enter` o cuando el string es un número válido sin terminar en `.` o `,`.
  - Eliminar el redondeo forzado a `0.5 kg` dentro de `lbToKg()` en `src/utils/fitnessMath.ts`, conservando precisión interna de 4 decimales (`Math.round((lb / 2.2046226218) * 10000) / 10000`) para que el valor escrito en libras se preserve con exactitud.

---

### V1.6-02 — Descanso Automático de `2:00 min` tras Completar la Prueba Inicial de Fuerza
- **Problema observado en campo:**
  - Después de realizar la serie de prueba para calibrar el peso ideal (8 a 12 repeticiones exigentes), el usuario necesita descansar antes de arrancar la **Serie 1 efectiva**, pero la app no iniciaba el cronómetro al pulsar `✓ Fijar Peso Ideal`.
- **Decisión aprobada:**
  - Al pulsar `✓ Fijar Peso Ideal` en la prueba rápida (`ExerciseSlotCard.tsx`), iniciar automáticamente el cronómetro de descanso con **120 segundos (`2:00 min`)** (ajustable en vivo con `-15s / +15s` u `Omitir`) y etiqueta contextual: `"${profile.name} • Descanso post-prueba • Prepárate para la Serie 1"`.

---

### V1.6-03 — Claridad de Peso por Mano / por Lado en TODOS los Ejercicios Bilaterales (Punto C)
- **Problema observado en campo:**
  - En ejercicios donde se carga peso en cada mano o discos a cada lado de la máquina/barra, no quedaba explícito si el usuario debía ingresar el peso de **1 sola mancuerna / 1 solo lado** o la **suma total**, ni cómo lo convertía la app.
- **Solución técnica para `v1.6` (cobertura de todo el catálogo):**
  1. **Doble Mancuerna / Bilateral Independiente (1 pesa en cada mano):**
     - *Ejercicios incluidos:* Press de Pecho con Mancuernas, Press Inclinado con Mancuernas, Press Militar con Mancuernas, Press Arnold, Elevaciones Laterales con Mancuernas, Elevación Frontal + Lateral con Mancuernas, Peso Muerto Rumano con Mancuernas, Zancadas / Desplantes con Mancuernas, Sentadilla Búlgara con Mancuernas, Subida al Cajón (Step-Up con Mancuernas), Pájaros / Vuelos Posteriores con Mancuernas, Curl de Bíceps Alterno con Mancuernas, Curl Martillo con Mancuernas, Remo con Mancuerna a 1 Mano.
     - *Comportamiento:* Selector explícito en la Prueba de Fuerza y en la Calculadora:
       - **`Peso de 1 Mancuerna (c/mano)`** *(por defecto)*: el valor ingresado es el de una sola mancuerna y las series muestran `XX lb c/mano` (`XX kg c/mano`).
       - **`Suma de las 2 Mancuernas (÷2)`**: si el usuario introduce la suma de ambas mancuernas, la app divide automáticamente entre 2 y muestra la conversión en vivo (`Ingresaste 40 lb totales ➔ 20 lb por mano`).
  2. **Mancuerna o Pesa Única Sujetada con Ambas Manos (Goblet / Copa / Kettlebell):**
     - *Ejercicios incluidos:* Sentadilla Goblet con Mancuerna, Sentadilla Goblet Sumo (Pies Anchos), Puente de Glúteo con Mancuerna en Suelo, Extensión de Tríceps tras Nuca con Mancuerna (Copa), Kettlebell Swings.
     - *Comportamiento:* Etiqueta explícita **`Peso de la mancuerna / pesa única (total)`** para evitar confusión con ejercicios de 2 mancuernas.
  3. **Carga por Discos a Cada Lado (Barra Olímpica, Barra Z, Multipower, Prensa 45°, Sentadilla Hack, Máquinas Iso-Laterales):**
     - *Ejercicios incluidos:* Prensa de Piernas 45°, Sentadilla Hack en Máquina, Sentadilla en Multipower, Hip Thrust en Máquina o Multipower, Hip Thrust Libre con Barra Olímpica, Peso Muerto Rumano con Barra, Press de Banca Plano con Barra, Remo con Barra Libre o en Multipower, Curl de Bíceps con Barra Z o Recta, Press Francés con Barra Z.
     - *Comportamiento:* Selector explícito **`Peso de 1 Solo Lado (×2)`** vs **`Peso Total (Ambos lados)`**, mostrando el desglose claro de cuánto cargar por cada lado y el total equivalente.

---

### V1.6-04 — Compensación Automática de Repeticiones al Cambiar el Peso (`22 lb` ➔ `20 lb`)
- **Problema observado en campo:**
  - Si la app sugiere `22 lb` para `10 reps`, pero en el gimnasio solo hay mancuernas de `20 lb` o `25 lb`, al cambiar el peso manualmente en la serie las repeticiones sugeridas no se recalculaban para mantener el mismo estímulo (mismo RIR / proximidad al fallo).
- **Solución técnica para `v1.6`:**
  - Añadir `calculateCompensatedReps(oneRmKg, newWeightKg, targetRir)` en `src/utils/fitnessMath.ts` (inversa de Epley/Brzycki acotada a un rango seguro de `4` a `25` reps).
  - Cuando el usuario modifica el peso de una serie y cuenta con un `1RM` calibrado para ese ejercicio, actualizar las repeticiones sugeridas de esa serie y mostrar un indicador informativo en la fila:
    - Si baja el peso (ej. `22 lb` ➔ `20 lb`): sube repeticiones (ej. `10` ➔ `12 reps`).
    - Si sube el peso (ej. `22 lb` ➔ `25 lb`): baja repeticiones de forma segura (ej. `10` ➔ `8 reps`).

---

### V1.6-05 — Claridad en Ejercicios con Dropset (Aplicar Dropset Solo en la Última Serie)
- **Problema observado en campo:**
  - En ejercicios configurados con `defaultTechnique: 'dropset'`, el texto `defaultTargetReps` mostraba `"+ Dropset"` en la cabecera y en todas las filas (`Serie 1`, `Serie 2`, `Serie 3`, `Serie 4`), generando duda de si las series previas también llevaban Dropset.
- **Solución técnica para `v1.6`:**
  - Limpiar `defaultTargetReps` en `initialData.ts` y la vista de `ExerciseSlotCard.tsx` para que las series previas (`Serie 1`, `Serie 2`...) se etiqueten únicamente como **Series Normales** (`Meta: 12 reps`).
  - Destacar únicamente en la **última serie activa** el indicador **`🔥 Meta: 12 + Dropset`** conectado visualmente con la sub-tabla `↳ Drop 1 (-20%)` y `↳ Drop 2 (-35%)`.

---

### V1.6-06 — Tips del Entrenador Contraídos por Defecto y Ubicados Justo Debajo de la Animación
- **Problema observado en campo:**
  - El recuadro de `Nota del entrenador + Técnica` siempre abierto ocupaba demasiado espacio vertical.
- **Solución técnica aprobada para `v1.6`:**
  - Ubicar el bloque desplegable `📌 Ver tip del entrenador y técnica ▾` **inmediatamente debajo del video de demostración del ejercicio** (y por encima de la fila de botones `🔀 Cambiar Máquina / 📈 Historial / 🎯 Calibrar Peso`), iniciando **contraído por defecto**.

---

### V1.6-07 — Alarma de Fin de Descanso Audible sobre Música + Vibración Intensa
- **Problema observado en campo:**
  - Al entrenar escuchando música en el teléfono, el beep corto de `0.45 s` y la vibración suave (`200 ms`) pasan desapercibidos al llegar el cronómetro de descanso a `00:00`.
- **Solución técnica para `v1.6`:**
  - Integrar haptics nativos y un patrón de vibración cuádruple intenso (`[400, 120, 400, 120, 500, 150, 600]`).
  - Reemplazar el beep único por una secuencia de **3 toques de campana de gimnasio de alta presencia** (`1.8 s` totales en frecuencias armónicas `1760 Hz / 2349 Hz` con ataque percusivo) que corta limpiamente sobre la mezcla musical sin detener la reproducción de Spotify/Apple Music.

---

### V1.6-08 — Transiciones Animadas Entre Ejercicios y al Cerrar Sesión (`Touch-to-Skip`)
- **Momento de disparo:**
  - Se muestran **al completar un ejercicio (transición entre ejercicios)** y **al cerrar la sesión juntos**, nunca entre cada serie individual para no saturar.
- **Configuración visual aprobada:**
  - **Estilo de integración:** `1. Fusión Sin Bordes (mode-blend)` con máscara elíptica radial y `mix-blend-mode: lighten` sobre backdrop `#0B090E/88` + `backdrop-blur-md`.
  - **Velocidad de reproducción:** `1.35x` (`2.9s` fluidos sobre los videos base de `4.0s`).
  - **`Touch-to-Skip`:** No bloqueante; cualquier toque en cualquier parte de la pantalla cierra la transición de inmediato mientras el cronómetro de descanso ya corre en segundo plano.
- **Archivos oficiales en `./gym-tracker-v1.6/public/animations/`:**
  1. `01-station-complete.mp4` *(origen: `8734890413151926049.mp4`)* — **Ejercicio Estándar Completado (`¡ESTACIÓN DOMINADA!`)**.
  2. `02-overload-dropset.mp4` *(origen: `321074228165862592.mp4`)* — **Ejercicio Intenso: Dropset / Al Fallo (`¡SOBRECARGA COMPLETADA!`)**.
  3. `03-new-record-pr.mp4` *(origen: `11936182773217064029.mp4`)* — **Subida de Peso / Nuevo Récord Personal (`¡NUEVO RÉCORD DE FUERZA!`)**.
  4. `04-session-complete-duo.mp4` *(origen: `9663580765046852241.mp4`)* — **Cierre de Sesión Juntos (`¡SESIÓN COMPLETADA EN PAREJA!`)**.
- **Regla de Prioridad y Anti-Repetición:**
  - Jerarquía de prioridad: **`3 (Récord PR) > 4 (Cierre de Sesión Dual) > 2 (Dropset / Al Fallo) > 1 (Estándar)`**.
  - **Prohibido mostrar 2 transiciones repetidas consecutivas:** el motor guarda `lastPlayedTransitionId`; nunca dispara dos videos por un mismo evento ni repite de forma consecutiva la misma animación que salió inmediatamente antes.

---

### V1.6-09 — Eliminar Series Extra Dejando Seleccionada la Fila (`Long-Press` / Botón `🗑️`)
- **Problema observado en campo:**
  - El botón `+ Añadir serie extra` permitía agregar filas adicionales (ej. `Serie 4`), pero no existía forma de eliminarlas si se agregaban por error.
- **Solución técnica para `v1.6`:**
  - Permitir eliminar cualquier serie extra manteniendo presionada la fila durante `500 ms` (`long-press` con feedback visual en borde rojo) o tocando el icono `🗑️` en las series extra, renumerando las series restantes (`1, 2, 3...`) y reasignando el escalón de Dropset / Fallo a la nueva última serie.

---

### V1.6-10 — Catálogo Ampliado de Colores Kineo Ascent por Perfil (Onboarding y Ajustes)
- **Requerimiento aprobado:**
  - En el **Primer Inicio (Onboarding)** y en **Ajustes > Perfiles**, permitir elegir el color de acento de cada perfil (Titular y Pareja) dentro de una paleta expandida de **8 colores curados estilo Kineo Ascent** que armonizan con el fondo `#0B090E`:
    1. `Solar Orange (#FF5500)`
    2. `Hyper Violet (#8B5CF6)`
    3. `Cyber Cyan (#06B6D4)`
    4. `Crimson Pulse (#F43F5E)`
    5. `Amber Gold (#F59E0B)`
    6. `Neon Lime (#84CC16)`
    7. `Electric Blue (#3B82F6)`
    8. `Magenta Rose (#EC4899)`
  - *(El verde `#10B981` permanece reservado exclusivamente para confirmaciones `✓`, racha completada y estado conectado).*

---

### V1.6-11 — Módulo Simple de Cardio Guiado con Velocidad e Inclinación (`%`)
- **Requerimiento aprobado:**
  - Incorporar opciones de **Cardio Guiado Simple** (**Caminadora, Elíptica, Escaladora, Bicicleta Estática**) con:
    - **Recomendación de momento:**
      1. **🔥 Al Inicio (Calentamiento 5–8 min):** movilidad y activación articular suave sin fatigar las pesas.
      2. **⚡ Al Final de las Pesas (Recomendado para Recomposición / Oxidación de Grasa, 15–20 min):** protocolo guiado por bloques indicando cuándo subir o bajar **velocidad (`km/h` / `mph`)** y **nivel de inclinación (`%`)** o resistencia.
      3. **🏃 En Sesión Específica (Día E / Acondicionamiento):** bloque completo de 25–30 min.

---

### V1.6-12 — Corrección Definitiva del Cronómetro Encimado (`1:..` / `D...`) en Teléfonos con Fuente Grande
- **Problema observado en campo:**
  - En teléfonos con el tamaño de fuente de Android aumentado (`115%–130%`), los 5 botones de la derecha (`shrink-0`) aplastaban el reloj en una sola fila dejando solo `1:..` y `D...`.
- **Solución triple aprobada para `v1.6`:**
  1. Fijar `getBridge().getWebView().getSettings().setTextZoom(100)` en `MainActivity.java` y `-webkit-text-size-adjust: 100%` en CSS global.
  2. Rediseñar `RestTimerBar.tsx` en **2 niveles horizontales**:
     - **Nivel 1:** Reloj grande (`whitespace-nowrap shrink-0`, jamás truncable) + Nombre del ejercicio a todo lo ancho + chip de estado.
     - **Nivel 2:** Grid de 5 botones (`-15s`, `+15s`, `Pausar/Reanudar`, `Reset`, `Saltar`).
  3. Aumentar el padding inferior de la vista de entrenamiento para que la barra flotante nunca tape el último ejercicio.

---

### V1.6-13 — Animaciones Propias de Ejecución de Ejercicios Integradas en el Acordeón (Sin Copyright)
- **Diseño y Orden Aprobado dentro del Acordeón Expandido:**
  1. **Cabecera y Título del Ejercicio**
  2. **Escenario Cuadrado `1:1` (`Layout C` — `295px` de alto, velocidad `1.0x`, `Estilo 1: Rim-Light 2.5D`)** integrado justo debajo del título con **fusión continua (`mix-blend-mode: lighten` + máscara suave sobre fondo `#0B090E`)** para que no exista ninguna diferencia de color ni borde entre el video y la pantalla de la app.
  3. **Barra desplegable `📌 Ver tip del entrenador y técnica ▾` inmediatamente debajo del video** (contraída por defecto).
  4. **Fila de botones de acción (`🔀 Cambiar Máquina`, `📈 Historial`, `🎯 Calibrar Peso`)**.
  5. **Tabla de series del ejercicio**.

---

## 2. Inventario Completo de Ejercicios para Generación de Animaciones (`Estilo 1: Rim-Light 2.5D`)

> **Regla de Color para los Prompts (Fusión Invisible con la Pantalla):**  
> En todos los scripts de imagen y video se solicita explícitamente un fondo plano sin iluminación de piso (`pure solid flat dark onyx background with zero floor reflections and unlit black edges`) combinado en la app con `mix-blend-mode: lighten` y máscara radial suave, logrando que el video y la tarjeta se perciban como una sola superficie continua.

### Bloque A — Los 21 Ejercicios Principales (Sesiones A, B, C, D y E)

| # | Sesión | Archivo Destino en `public/animations/exercises/` | Ejercicio Principal | Estado |
| :-: | :-: | :--- | :--- | :---: |
| **1** | **A / C** | `01-goblet-squat.mp4` | Sentadilla Goblet con Mancuerna / Kettlebell | ✅ Listo |
| **2** | **A (#1)** | `02-leg-press-45.mp4` | Prensa de Piernas 45° | ✅ Listo |
| **3** | **A (#2)** | `03-barbell-hip-thrust.mp4` | Hip Thrust con Barra sobre Banco | ✅ Listo |
| **4** | **A (#3 Él)** | `04-leg-extension.mp4` | Extensión de Cuádriceps Sentado en Máquina | ✅ Listo |
| **5** | **A (#3 Ella)** | `05-glute-abduction.mp4` | Máquina de Abducción de Glúteo Sentado | ✅ Listo |
| **6** | **A (#4)** | `06-cable-crunch.mp4` | Crunch Abdominal en Polea Alta | ✅ Listo |
| **7** | **B (#1)** | `07-dumbbell-bench-press.mp4` | Press de Pecho Plano con Mancuernas | ✅ Listo |
| **8** | **B (#2)** | `08-seated-db-shoulder-press.mp4` | Press Militar con Mancuernas Sentado | ✅ Listo |
| **9** | **B (#3)** | `09-lateral-raise.mp4` | Elevaciones Laterales con Mancuernas de Pie | ✅ Listo |
| **10** | **B (#4)** | `10-triceps-rope-pushdown.mp4` | Extensión de Tríceps en Polea Alta con Cuerda | ✅ Listo |
| **11** | **C (#1)** | `11-romanian-deadlift-db.mp4` | Peso Muerto Rumano con Mancuernas | ✅ Listo |
| **12** | **C (#2)** | `12-dumbbell-lunges.mp4` | Zancadas / Desplantes con Mancuernas | ✅ Listo |
| **13** | **C (#3)** | `13-seated-leg-curl.mp4` | Curl Femoral Sentado en Máquina | ✅ Listo |
| **14** | **C (#4) / E (#2 Ella)** | `14-cable-glute-kickback.mp4` | Patada de Glúteo en Polea Baja | ✅ Listo |
| **15** | **D (#1)** | `15-lat-pulldown.mp4` | Jalón al Pecho en Polea Alta | ✅ Listo |
| **16** | **D (#2)** | `16-seated-cable-row.mp4` | Remo Sentado en Polea Baja (Agarre Neutro) | ✅ Listo |
| **17** | **D (#3)** | `17-face-pull.mp4` | Face Pulls en Polea Alta con Cuerda | ✅ Listo |
| **18** | **D (#4)** | `18-alternate-bicep-curl.mp4` | Curl de Bíceps Alterno con Mancuernas | ✅ Listo |
| **19** | **E (#1)** | `19-incline-db-press.mp4` | Press Inclinado con Mancuernas (Banco 30°) | ✅ Listo |
| **20** | **E (#2 Él)** | `20-hammer-curl.mp4` | Curl Martillo con Mancuernas de Pie | ✅ Listo |
| **21** | **E (#3)** | `21-kettlebell-swing.mp4` | Kettlebell Swings (Balanceo con Pesa Rusa) | ✅ Listo |

### Bloque B — Las 29 Variantes Alternativas (`🔀 Cambiar Máquina`)
1. `ex-a1-alt2-hack-squat.mp4` — Sentadilla Hack / Multipower
2. `ex-a2-alt1-db-glute-bridge.mp4` — Puente de Glúteo con Mancuerna en Banco/Piso *(cubre también E2-partner-alt1)*
3. `ex-a3-alt1-bulgarian-split-squat.mp4` — Sentadilla Búlgara con Mancuernas *(cubre también C2-alt1)*
4. `ex-a3-alt2-db-step-up.mp4` — Step-Up (Subida al Cajón con Mancuernas)
5. `ex-a3-partner-alt2-cable-hip-abduction.mp4` — Abducción de Cadera en Polea Baja
6. `ex-a4-alt1-plank.mp4` — Plancha Isométrica Activa
7. `ex-a4-alt2-ab-crunch-machine.mp4` — Crunch en Máquina Sentado
8. `ex-b1-alt1-chest-press-machine.mp4` — Press de Pecho en Máquina Sentado
9. `ex-b1-alt2-barbell-bench-press.mp4` — Press de Banca con Barra / Multipower
10. `ex-b2-alt1-shoulder-press-machine.mp4` — Press de Hombros en Máquina
11. `ex-b2-alt2-arnold-press.mp4` — Press Arnold con Mancuernas
12. `ex-b3-alt1-cable-lateral-raise.mp4` — Elevaciones Laterales en Polea Baja
13. `ex-b3-alt2-front-lateral-raise.mp4` — Elevación Frontal / Lateral Alternada con Mancuernas
14. `ex-b4-alt1-overhead-db-triceps-extension.mp4` — Press Francés / Copa con Mancuerna
15. `ex-b4-alt2-dip-machine.mp4` — Máquina de Fondos Sentado (Dip Machine)
16. `ex-c1-alt1-barbell-rdl.mp4` — Peso Muerto Rumano con Barra
17. `ex-c1-alt2-hyperextension-45.mp4` — Hiperextensiones de Glúteo y Femoral 45°
18. `ex-c3-alt1-lying-leg-curl.mp4` — Curl Femoral Acostado en Máquina
19. `ex-c3-alt2-cable-pull-through.mp4` — Pull-Through de Glúteo y Femoral en Polea
20. `ex-c4-alt2-lying-leg-raise.mp4` — Elevación de Piernas Acostado / Abdomen Inferior
21. `ex-d1-alt1-assisted-pullup.mp4` — Dominadas Asistidas en Máquina
22. `ex-d1-alt2-straight-arm-pulldown.mp4` — Pull-Over en Polea Alta con Brazos Rectos
23. `ex-d2-alt1-one-arm-db-row.mp4` — Remo con Mancuerna a Una Mano en Banco
24. `ex-d2-alt2-chest-supported-row.mp4` — Remo en Máquina con Apoyo al Pecho
25. `ex-d3-alt1-rear-delt-fly-db.mp4` — Pájaros con Mancuernas Sentado/Inclinado
26. `ex-d3-alt2-reverse-pec-deck.mp4` — Peck Deck Inverso (Máquina Posterior)
27. `ex-d4-alt1-cable-bicep-curl.mp4` — Curl de Bíceps en Polea Baja
28. `ex-d4-alt2-preacher-curl-machine.mp4` — Curl Predicador en Máquina o Banco
29. `ex-e1-alt1-incline-chest-machine.mp4` — Press Inclinado en Máquina
30. `ex-e1-alt2-low-cable-crossover.mp4` — Cruces en Polea Baja
31. `ex-e2-alt1-rope-hammer-curl.mp4` — Curl Martillo con Cuerda en Polea Baja
32. `ex-e2-alt2-ez-bar-curl.mp4` — Curl con Barra Z
33. `ex-e3-alt1-air-bike-crunch.mp4` — Bicicleta Abdominal Alternada (Air Bike)
34. `ex-e3-alt2-ab-roller.mp4` — Rueda Abdominal (Ab Roller) o Plancha

---

## 3. Funcionalidades Documentadas para Versiones Futuras (`v1.7+`)

### V1.7-FUTURO-01 — Configuración en Pareja al Inicio de la Sesión (1 Máquina vs. 2 Máquinas)
- Selector global al iniciar una sesión en pareja para elegir si van a **alternar en 1 sola máquina esperando a que el otro termine** o **usar 2 máquinas distintas simultáneamente**.

### V1.7-FUTURO-02 — Recordatorio de Música / "Power Songs" (`🎵` en Barra Superior)
- Botón `🎵` en la cabecera para asociar canciones de máxima energía (*Power Songs*) a levantamientos pesados o cierres de sesión.

### V1.7-FUTURO-03 — Identificación de Consola de Caminadora por Imagen/Foto
- Selector visual del panel de control de caminadoras para guiar paso a paso cómo elegir un programa específico en la consola según el tiempo y objetivo del usuario.

### V1.7-FUTURO-04 — Personalización de Planes con Exclusión de Equipo/Cardio y Aviso de Beneficios
- Permitir al crear o ajustar planes excluir ejercicios con mancuernas o excluir cardio, mostrando antes una alerta educativa sobre los beneficios de mantenerlos.

### V1.7-FUTURO-05 — Integración Universal con Smartwatch
- Conexión con relojes inteligentes para visualizar frecuencia cardiaca en tiempo real y controlar series/descansos desde la muñeca.

### V1.7-FUTURO-06 — Integración con Google Health Connect y Similares
- Sincronización bidireccional de entrenamientos completados, calorías, duración y peso corporal con Google Health Connect.
