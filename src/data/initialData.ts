import {
  MesocyclePlan,
  UserProfile,
  GlossaryItem,
  WorkoutHistoryEntry,
  DeviceConfig
} from '../types'

export const GOAL_OPTIONS: string[] = [
  'Recomposición Corporal & Definición',
  'Tonificación, Glúteo/Pierna & Ritmo Metabólico',
  'Hipertrofia General & Estética Muscular',
  'Fuerza Base & Progresión de Cargas',
  'Quema de Grasa, Resistencia & Salud Metabólica'
]

export const INITIAL_DEVICE_CONFIG: DeviceConfig = {
  onboardingCompleted: false,
  primaryProfileId: 'user_1',
  coupleModeEnabled: true,
  lastCompletedWorkoutDate: undefined,
  lastCompletedSessionCode: undefined
}

export const INITIAL_PROFILES: Record<'user_1' | 'user_2', UserProfile> = {
  user_1: {
    id: 'user_1',
    name: 'Adolfo',
    gender: 'male',
    isDeviceOwner: true,
    goal: 'Recomposición Corporal & Definición',
    level: 'Principiante / Retomando',
    accentColor: '#10B981',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    activeVariantBySlot: {},
    estimated1RMByVariant: {}
  },
  user_2: {
    id: 'user_2',
    name: 'Dani',
    gender: 'female',
    isDeviceOwner: false,
    goal: 'Tonificación, Glúteo/Pierna & Ritmo Metabólico',
    level: 'Principiante / Retomando',
    accentColor: '#EC4899',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    activeVariantBySlot: {},
    estimated1RMByVariant: {}
  }
}

export const INITIAL_MESOCYCLE: MesocyclePlan = {
  id: 'meso-kineo-v1.4',
  name: 'Mesociclo 1: Base & Recomposición Metabólica',
  goalDescription:
    'Ciclo inteligente de 6 semanas (3 a 5 días/semana) iniciando con Tren Inferior en Sesión A. Combina ejercicios compuestos en pirámide con superseries y dropsets metabólicos para perder grasa manteniendo firmeza muscular.',
  startDate: '2026-10-20',
  durationWeeks: 6,
  currentWeek: 1,
  recommendedDaysMin: 3,
  recommendedDaysMax: 5,
  sessions: [
    {
      id: 'session-a',
      code: 'A',
      title: 'Sesión A — Tren Inferior: Cuádriceps, Glúteo & Core',
      subtitle: 'Día 1 de alta activación metabólica: Pierna, Glúteo y Abdomen firme',
      focusTags: ['Día 1: Tren Inferior', 'Piramidal', 'Superserie + Dropset'],
      estimatedMinutes: 52,
      slots: [
        {
          slotId: 'slot-a1',
          order: 1,
          defaultTechnique: 'pyramid_asc',
          restSeconds: 105,
          syncMode: 'shared',
          defaultSetsCount: 4,
          defaultTargetReps: '12-10-8-8',
          notes:
            'Ejercicio principal de Tren Inferior. Suban el peso de forma progresiva en cada serie cuidando la profundidad.',
          primaryExercise: {
            id: 'ex-a1-main',
            name: 'Prensa de Piernas 45°',
            equipment: 'Máquina',
            muscleGroup: 'Cuádriceps & Glúteo',
            secondaryMuscles: 'Femoral • Aductores',
            demoFolderId: 'Leg_Press',
            tempo: '2s bajar • 1s pausa • 1s empujar',
            cues: 'Pies al ancho de hombros (más altos en la plataforma enfatizan glúteo/femoral; más bajos enfatizan cuádriceps).',
            stepByStep: [
              'Apoya toda la espalda y cadera firmemente contra el respaldo de la prensa.',
              'Desbloquea los seguros y baja la plataforma en 2 segundos hasta formar 90° en las rodillas.',
              'Empuja con toda la planta del pie (especialmente talones) sin bloquear las rodillas de golpe.'
            ]
          },
          alternatives: [
            {
              id: 'ex-a1-alt1',
              name: 'Sentadilla Goblet con Mancuerna o Kettlebell',
              equipment: 'Mancuernas',
              muscleGroup: 'Cuádriceps & Glúteo',
              secondaryMuscles: 'Core • Espalda Alta',
              demoFolderId: 'Goblet_Squat',
              tempo: '2s bajar • 1s pausa abajo • 1s subir',
              cues: 'Pega la mancuerna al pecho, baja profundo manteniendo el torso erguido.'
            },
            {
              id: 'ex-a1-alt2',
              name: 'Sentadilla Hack / Multipower',
              equipment: 'Máquina',
              muscleGroup: 'Cuádriceps & Glúteo',
              secondaryMuscles: 'Core',
              demoFolderId: 'Hack_Squat',
              tempo: '2s bajar • 1s pausa • 1s subir',
              cues: 'Espalda bien apoyada, rodillas alineadas con la punta de los pies.'
            }
          ]
        },
        {
          slotId: 'slot-a2',
          order: 2,
          defaultTechnique: 'normal',
          restSeconds: 90,
          syncMode: 'shared',
          defaultSetsCount: 4,
          defaultTargetReps: '10-12',
          notes:
            'Constructor clave de glúteo y potencia de cadera. Pueden alternar en la misma estación o con mancuerna pesada.',
          primaryExercise: {
            id: 'ex-a2-main',
            name: 'Hip Thrust con Barra o Máquina',
            equipment: 'Barra',
            muscleGroup: 'Glúteo Mayor & Cadera',
            secondaryMuscles: 'Femoral • Core Estabilizador',
            demoFolderId: 'Barbell_Hip_Thrust',
            tempo: '1s subir • 2s contracción arriba • 2s bajar',
            cues: 'Mentón pegado al pecho, empuja con los talones y aprieta glúteo 2 segundos arriba.',
            stepByStep: [
              'Apoya la parte baja de las escápulas en el borde del banco con las rodillas a 90° arriba.',
              'Empuja la cadera hacia el techo manteniendo las costillas bajas y el mentón ligeramente recogido.',
              'Sostén 2 segundos apretando el glúteo en la cima y baja controlado.'
            ]
          },
          alternatives: [
            {
              id: 'ex-a2-alt1',
              name: 'Puente de Glúteo con Mancuerna en Banco/Piso',
              equipment: 'Mancuernas',
              muscleGroup: 'Glúteo Mayor',
              secondaryMuscles: 'Femoral',
              demoFolderId: 'Barbell_Glute_Bridge',
              tempo: '1s subir • 2s pausa • 2s bajar',
              cues: 'Rápido de armar con mancuerna sobre la pelvis si el banco de barra está ocupado.'
            },
            {
              id: 'ex-a2-alt2',
              name: 'Zancadas Estáticas con Mancuernas',
              equipment: 'Mancuernas',
              muscleGroup: 'Glúteo & Cuádriceps Unilateral',
              secondaryMuscles: 'Equilibrio • Core',
              demoFolderId: 'Dumbbell_Lunges',
              tempo: '2s bajar • 1s subir',
              cues: 'Torso ligeramente inclinado hacia adelante para reclutar más glúteo.'
            }
          ]
        },
        {
          slotId: 'slot-a3',
          order: 3,
          supersetGroup: 'SS-A1',
          defaultTechnique: 'dropset',
          restSeconds: 30,
          syncMode: 'shared',
          defaultSetsCount: 3,
          defaultTargetReps: '12-15 + Dropset',
          notes:
            'Superserie A1 + Dropset en la 3ra serie. Define el cuádriceps y en modo individual permite enfocar abducción de glúteo.',
          primaryExercise: {
            id: 'ex-a3-main',
            name: 'Extensión de Cuádriceps en Máquina',
            equipment: 'Máquina',
            muscleGroup: 'Cuádriceps (Recto Femoral y Vastos)',
            secondaryMuscles: 'Estabilidad de Rodilla',
            demoFolderId: 'Leg_Extensions',
            tempo: '1s subir • 1s apretar arriba • 2s bajar',
            cues: 'Pausa de 1 segundo arriba apretando los muslos antes de bajar.'
          },
          alternatives: [
            {
              id: 'ex-a3-alt1',
              name: 'Sentadilla Búlgara con Mancuernas',
              equipment: 'Mancuernas',
              muscleGroup: 'Cuádriceps & Glúteo',
              secondaryMuscles: 'Estabilidad',
              demoFolderId: 'Single_Leg_Squat',
              tempo: '2s bajar • 1s subir',
              cues: 'Pie trasero sobre banco, baja vertical controlando la rodilla.'
            },
            {
              id: 'ex-a3-alt2',
              name: 'Step-Up (Subida al Cajón/Banco)',
              equipment: 'Mancuernas',
              muscleGroup: 'Cuádriceps & Glúteo Mayor',
              secondaryMuscles: 'Core',
              demoFolderId: 'Dumbbell_Step_Ups',
              tempo: '1s subir • 2s bajar controlado',
              cues: 'Impúlsate exclusivamente con el talón de la pierna apoyada arriba.'
            }
          ],
          femaleFocusedPrimary: {
            id: 'ex-a3-partner',
            name: 'Máquina de Abducción de Glúteo',
            equipment: 'Máquina',
            muscleGroup: 'Glúteo Medio y Superior',
            secondaryMuscles: 'Glúteo Mayor',
            demoFolderId: 'Thigh_Abductor',
            tempo: '1s abrir • 2s sostener • 2s cerrar',
            cues: 'Abre controlado, sostén 2 segundos y aplica Dropset en la última serie.'
          },
          femaleFocusedAlternatives: [
            {
              id: 'ex-a3-partner-alt1',
              name: 'Extensión de Cuádriceps en Máquina',
              equipment: 'Máquina',
              muscleGroup: 'Cuádriceps',
              secondaryMuscles: 'Rodilla',
              demoFolderId: 'Leg_Extensions',
              tempo: '1s subir • 1s pausa • 2s bajar',
              cues: 'Excelente para alternar rápidamente con tu pareja en la misma máquina.'
            },
            {
              id: 'ex-a3-partner-alt2',
              name: 'Abducción de Cadera en Polea Baja',
              equipment: 'Polea',
              muscleGroup: 'Glúteo Medio',
              secondaryMuscles: 'Core',
              demoFolderId: 'Cable_Hip_Adduction',
              tempo: '1s abrir • 1s pausa • 2s regresar',
              cues: 'Con grillete en el tobillo, eleva lateralmente sin inclinar el torso.'
            }
          ]
        },
        {
          slotId: 'slot-a4',
          order: 4,
          supersetGroup: 'SS-A1',
          defaultTechnique: 'normal',
          restSeconds: 75,
          syncMode: 'shared',
          defaultSetsCount: 3,
          defaultTargetReps: '15',
          notes:
            'Superserie A2: Terminas piernas/glúteo y pasas directo a Core abdominal antes del descanso de 75s.',
          primaryExercise: {
            id: 'ex-a4-main',
            name: 'Crunch Abdominal en Polea o Máquina',
            equipment: 'Polea',
            muscleGroup: 'Core / Recto Abdominal',
            secondaryMuscles: 'Oblicuos',
            demoFolderId: 'Cable_Crunch',
            tempo: '1s contraer • 1s exhalar • 2s bajar',
            cues: 'Exhala todo el aire al contraer el abdomen enrollando el torso hacia la pelvis.'
          },
          alternatives: [
            {
              id: 'ex-a4-alt1',
              name: 'Plancha Isométrica Activa (45 seg)',
              equipment: 'Peso Corporal',
              muscleGroup: 'Core Profundo / Transverso',
              secondaryMuscles: 'Glúteo • Hombros',
              demoFolderId: 'Plank',
              tempo: 'Isométrico continuo 45s',
              cues: 'Glúteo y abdomen apretados en línea recta.'
            },
            {
              id: 'ex-a4-alt2',
              name: 'Crunch en Máquina Sentado',
              equipment: 'Máquina',
              muscleGroup: 'Core / Abdomen',
              secondaryMuscles: 'Oblicuos',
              demoFolderId: 'Ab_Crunch_Machine',
              tempo: '1s contraer • 1s pausa • 2s regresar',
              cues: 'Movimiento corto controlado con el abdomen, no con los brazos.'
            }
          ]
        }
      ]
    },
    {
      id: 'session-b',
      code: 'B',
      title: 'Sesión B — Empuje: Pecho, Hombros & Tríceps',
      subtitle: 'Tren superior firme, postura atlética y definición de brazos',
      focusTags: ['Día 2: Empuje', 'Piramidal', 'Dropset Final'],
      estimatedMinutes: 50,
      slots: [
        {
          slotId: 'slot-b1',
          order: 1,
          defaultTechnique: 'pyramid_asc',
          restSeconds: 90,
          syncMode: 'shared',
          defaultSetsCount: 4,
          defaultTargetReps: '12-10-8-6',
          notes:
            'Pirámide Ascendente en ejercicio compuesto de empuje: sube ligeramente el peso en cada serie mientras bajas repeticiones.',
          primaryExercise: {
            id: 'ex-b1-main',
            name: 'Press de Pecho con Mancuernas',
            equipment: 'Mancuernas',
            muscleGroup: 'Pecho Medio (Pectoral Mayor)',
            secondaryMuscles: 'Tríceps • Deltoides Anterior',
            demoFolderId: 'Dumbbell_Bench_Press',
            tempo: '2s bajar • 1s pausa • 1s subir',
            cues: 'Acostado en banco plano, escápulas retraídas, baja controlado en 2 segundos a la línea del pecho.'
          },
          alternatives: [
            {
              id: 'ex-b1-alt1',
              name: 'Press de Pecho en Máquina Sentado',
              equipment: 'Máquina',
              muscleGroup: 'Pecho Medio',
              secondaryMuscles: 'Tríceps • Hombro Frontal',
              demoFolderId: 'Machine_Bench_Press',
              tempo: '2s bajar • 0s pausa • 1s empujar',
              cues: 'Ideal si los bancos están llenos. Ajusta el asiento para que los agarres queden a mitad del pecho.'
            },
            {
              id: 'ex-b1-alt2',
              name: 'Press de Banca con Barra / Multipower',
              equipment: 'Barra',
              muscleGroup: 'Pecho Completo',
              secondaryMuscles: 'Tríceps • Core',
              demoFolderId: 'Barbell_Bench_Press_-_Medium_Grip',
              tempo: '2s bajar • 1s pausa • 1s subir',
              cues: 'Pies firmes en el piso, muñecas rectas y control total sin rebotar en el pecho.'
            }
          ]
        },
        {
          slotId: 'slot-b2',
          order: 2,
          defaultTechnique: 'normal',
          restSeconds: 90,
          syncMode: 'shared',
          defaultSetsCount: 3,
          defaultTargetReps: '10-12',
          notes:
            'Desarrollo de hombros estéticos y simétricos cuidando la estabilidad lumbar.',
          primaryExercise: {
            id: 'ex-b2-main',
            name: 'Press Militar con Mancuernas Sentado',
            equipment: 'Mancuernas',
            muscleGroup: 'Hombros (Deltoides Anterior y Medio)',
            secondaryMuscles: 'Tríceps • Core Superior',
            demoFolderId: 'Dumbbell_Shoulder_Press',
            tempo: '2s bajar • 0s pausa • 1s subir',
            cues: 'Abdomen firme, codos ligeramente adelantados (plano escapular), sube sin chocar las mancuernas.'
          },
          alternatives: [
            {
              id: 'ex-b2-alt1',
              name: 'Press de Hombros en Máquina',
              equipment: 'Máquina',
              muscleGroup: 'Hombros (Deltoides)',
              secondaryMuscles: 'Tríceps',
              demoFolderId: 'Leverage_Shoulder_Press',
              tempo: '2s bajar • 1s pausa • 1s subir',
              cues: 'Espalda pegada al respaldo, empuja fluido sin arquear la zona lumbar.'
            },
            {
              id: 'ex-b2-alt2',
              name: 'Press Arnold con Mancuernas',
              equipment: 'Mancuernas',
              muscleGroup: 'Hombros Completo',
              secondaryMuscles: 'Tríceps • Trapecio Superior',
              demoFolderId: 'Arnold_Dumbbell_Press',
              tempo: '2s bajar • 1s giro • 1s subir',
              cues: 'Inicia con palmas hacia ti y gira al subir para activar las 3 cabezas del hombro.'
            }
          ]
        },
        {
          slotId: 'slot-b3',
          order: 3,
          supersetGroup: 'SS-B1',
          defaultTechnique: 'normal',
          restSeconds: 30,
          syncMode: 'shared',
          defaultSetsCount: 3,
          defaultTargetReps: '12-15',
          notes:
            'Superserie B1: Aísla el deltoides lateral para dar amplitud visual a los hombros y cintura más estrecha.',
          primaryExercise: {
            id: 'ex-b3-main',
            name: 'Elevaciones Laterales con Mancuernas',
            equipment: 'Mancuernas',
            muscleGroup: 'Hombro Lateral (Deltoides Medio)',
            secondaryMuscles: 'Trapecio • Antebrazo',
            demoFolderId: 'Side_Lateral_Raise',
            tempo: '1s subir • 1s pausa • 2s bajar',
            cues: 'Sube liderando con los codos hasta la altura de los hombros sin columpiar el torso.'
          },
          alternatives: [
            {
              id: 'ex-b3-alt1',
              name: 'Elevaciones Laterales en Polea Baja',
              equipment: 'Polea',
              muscleGroup: 'Hombro Lateral',
              secondaryMuscles: 'Deltoides Medio',
              demoFolderId: 'Cable_Seated_Lateral_Raise',
              tempo: '1s subir • 1s pausa • 2s bajar',
              cues: 'Tensión continua desde abajo, excelente para bombeo metabólico.'
            },
            {
              id: 'ex-b3-alt2',
              name: 'Elevación Frontal / Lateral Alternada',
              equipment: 'Mancuernas',
              muscleGroup: 'Hombro Lateral y Frontal',
              secondaryMuscles: 'Deltoides',
              demoFolderId: 'Front_Dumbbell_Raise',
              tempo: '1s subir • 1s pausa • 2s bajar',
              cues: 'Controla el movimiento sin usar impulso de cadera.'
            }
          ]
        },
        {
          slotId: 'slot-b4',
          order: 4,
          supersetGroup: 'SS-B1',
          defaultTechnique: 'dropset',
          restSeconds: 75,
          syncMode: 'shared',
          defaultSetsCount: 3,
          defaultTargetReps: '12 + Dropset',
          notes:
            'Superserie B2 + Dropset en la última serie: baja el peso un 20% sin descanso para firmeza total en la parte posterior del brazo.',
          primaryExercise: {
            id: 'ex-b4-main',
            name: 'Extensión de Tríceps en Polea con Cuerda',
            equipment: 'Polea',
            muscleGroup: 'Tríceps Braquial',
            secondaryMuscles: 'Antebrazo',
            demoFolderId: 'Triceps_Pushdown_-_Rope_Attachment',
            tempo: '1s extender • 1s abrir cuerda • 2s subir',
            cues: 'Codos pegados a las costillas; abre ligeramente la cuerda al final de la extensión.'
          },
          alternatives: [
            {
              id: 'ex-b4-alt1',
              name: 'Press Francés / Copa con Mancuerna',
              equipment: 'Mancuernas',
              muscleGroup: 'Tríceps (Cabeza Larga)',
              secondaryMuscles: 'Hombro Estabilizador',
              demoFolderId: 'Standing_Dumbbell_Triceps_Extension',
              tempo: '2s bajar • 0s pausa • 1s extender',
              cues: 'Sujeta la mancuerna tras nuca con ambas manos y extiende arriba.'
            },
            {
              id: 'ex-b4-alt2',
              name: 'Máquina de Fondos Sentado (Dip Machine)',
              equipment: 'Máquina',
              muscleGroup: 'Tríceps / Pecho Inferior',
              secondaryMuscles: 'Deltoides Anterior',
              demoFolderId: 'Dip_Machine',
              tempo: '2s bajar • 1s empujar',
              cues: 'Rápido de cambiar el pin de peso para ejecutar el Dropset en segundos.'
            }
          ]
        }
      ]
    },
    {
      id: 'session-c',
      code: 'C',
      title: 'Sesión C — Cadena Posterior: Femoral, Glúteo & Pierna Unilateral',
      subtitle: 'Segundo estímulo semanal de pierna enfocado en isquiosurales, glúteo y pantorrilla',
      focusTags: ['Día 3: Cadena Posterior', 'Piramidal', 'Superserie'],
      estimatedMinutes: 52,
      slots: [
        {
          slotId: 'slot-c1',
          order: 1,
          defaultTechnique: 'pyramid_asc',
          restSeconds: 95,
          syncMode: 'shared',
          defaultSetsCount: 4,
          defaultTargetReps: '12-10-8-8',
          notes:
            'Fundamental para isquiosurales y unión glúteo-femoral. Dejen 2 repeticiones en recámara (RIR 2) cuidando la espalda neutra.',
          primaryExercise: {
            id: 'ex-c1-main',
            name: 'Peso Muerto Rumano con Mancuernas o Barra',
            equipment: 'Mancuernas',
            muscleGroup: 'Femoral (Isquiosurales) & Glúteo',
            secondaryMuscles: 'Erectores Espinales • Core',
            demoFolderId: 'Romanian_Deadlift_With_Dumbbells',
            tempo: '3s bajar estirando • 1s subir apretando glúteo',
            cues: 'Lleva la cadera hacia atrás rozando los muslos con las mancuernas hasta sentir el estiramiento en femorales.'
          },
          alternatives: [
            {
              id: 'ex-c1-alt1',
              name: 'Peso Muerto Rumano con Barra',
              equipment: 'Barra',
              muscleGroup: 'Femoral & Glúteo',
              secondaryMuscles: 'Espalda Baja • Core',
              demoFolderId: 'Romanian_Deadlift',
              tempo: '3s bajar • 1s subir',
              cues: 'Bisagra de cadera pura sin redondear la espalda baja.'
            },
            {
              id: 'ex-c1-alt2',
              name: 'Hiperextensiones de Glúteo y Femoral 45°',
              equipment: 'Peso Corporal',
              muscleGroup: 'Glúteo & Femoral',
              secondaryMuscles: 'Zona Lumbar',
              demoFolderId: 'Hyperextensions_Back_Extensions',
              tempo: '2s bajar • 1s pausa arriba • 1s subir',
              cues: 'En banco a 45°, sube apretando glúteos sin hiperextender la columna.'
            }
          ]
        },
        {
          slotId: 'slot-c2',
          order: 2,
          defaultTechnique: 'normal',
          restSeconds: 90,
          syncMode: 'shared',
          defaultSetsCount: 3,
          defaultTargetReps: '10-12 por pierna',
          notes:
            'Trabajo unilateral para eliminar asimetrías, elevar el pulso metabólico y dar forma al glúteo y muslo.',
          primaryExercise: {
            id: 'ex-c2-main',
            name: 'Zancadas con Mancuernas (Lunges)',
            equipment: 'Mancuernas',
            muscleGroup: 'Glúteo & Cuádriceps Unilateral',
            secondaryMuscles: 'Femoral • Estabilidad Core',
            demoFolderId: 'Dumbbell_Lunges',
            tempo: '2s bajar • 1s pausa • 1s subir',
            cues: 'Empuja fuerte con el talón delantero manteniendo estabilidad en la rodilla.'
          },
          alternatives: [
            {
              id: 'ex-c2-alt1',
              name: 'Sentadilla Búlgara con Mancuernas',
              equipment: 'Mancuernas',
              muscleGroup: 'Glúteo Mayor & Cuádriceps',
              secondaryMuscles: 'Femoral',
              demoFolderId: 'Single_Leg_Squat',
              tempo: '2s bajar • 1s subir',
              cues: 'Empeine trasero apoyado en banco; inclina ligeramente el torso para enfatizar glúteo.'
            },
            {
              id: 'ex-c2-alt2',
              name: 'Sentadilla Goblet Sumo con Mancuerna',
              equipment: 'Mancuernas',
              muscleGroup: 'Glúteo & Aductores (Cara Interna)',
              secondaryMuscles: 'Cuádriceps',
              demoFolderId: 'Goblet_Squat',
              tempo: '2s bajar • 1s pausa • 1s subir',
              cues: 'Pies más anchos que los hombros con puntas a 45°, baja profundo.'
            }
          ]
        },
        {
          slotId: 'slot-c3',
          order: 3,
          supersetGroup: 'SS-C1',
          defaultTechnique: 'dropset',
          restSeconds: 30,
          syncMode: 'shared',
          defaultSetsCount: 3,
          defaultTargetReps: '12 + Dropset',
          notes:
            'Superserie C1: Aislamiento directo de isquiosurales con Dropset en la última serie.',
          primaryExercise: {
            id: 'ex-c3-main',
            name: 'Curl Femoral Sentado o Acostado',
            equipment: 'Máquina',
            muscleGroup: 'Femoral Aislado',
            secondaryMuscles: 'Gemelos',
            demoFolderId: 'Seated_Leg_Curl',
            tempo: '1s flexionar • 1s pausa • 2s estirar',
            cues: 'Controla el regreso en 2 segundos sin que las placas choquen.'
          },
          alternatives: [
            {
              id: 'ex-c3-alt1',
              name: 'Curl Femoral Acostado en Máquina',
              equipment: 'Máquina',
              muscleGroup: 'Femoral',
              secondaryMuscles: 'Glúteo',
              demoFolderId: 'Lying_Leg_Curls',
              tempo: '1s subir • 2s bajar',
              cues: 'Mantén la pelvis pegada al banco al flexionar las rodillas.'
            },
            {
              id: 'ex-c3-alt2',
              name: 'Pull-Through de Glúteo y Femoral en Polea',
              equipment: 'Polea',
              muscleGroup: 'Glúteo & Femoral',
              secondaryMuscles: 'Core',
              demoFolderId: 'Pull_Through',
              tempo: '2s atrás • 1s extender cadera',
              cues: 'De espaldas a la polea baja, extiende la cadera apretando el glúteo.'
            }
          ]
        },
        {
          slotId: 'slot-c4',
          order: 4,
          supersetGroup: 'SS-C1',
          defaultTechnique: 'normal',
          restSeconds: 70,
          syncMode: 'shared',
          defaultSetsCount: 3,
          defaultTargetReps: '15',
          notes:
            'Superserie C2: Completa el bloque de pierna con glúteo aislado o pantorrilla/core.',
          primaryExercise: {
            id: 'ex-c4-main',
            name: 'Patada de Glúteo en Polea / Máquina o Abducción',
            equipment: 'Polea',
            muscleGroup: 'Glúteo Mayor y Medio',
            secondaryMuscles: 'Estabilidad Lumbar',
            demoFolderId: 'Glute_Kickback',
            tempo: '1s subir • 2s apretar • 2s bajar',
            cues: 'Extiende la cadera hacia atrás sin arquear la espalda baja.'
          },
          alternatives: [
            {
              id: 'ex-c4-alt1',
              name: 'Máquina de Abducción de Cadera / Glúteo',
              equipment: 'Máquina',
              muscleGroup: 'Glúteo Medio',
              secondaryMuscles: 'Tensor de la Fascia Lata',
              demoFolderId: 'Thigh_Abductor',
              tempo: '1s abrir • 1s sostener • 2s cerrar',
              cues: 'Sostén 1 segundo en máxima apertura antes de regresar.'
            },
            {
              id: 'ex-c4-alt2',
              name: 'Elevación de Piernas Acostado / Abdomen Inferior',
              equipment: 'Peso Corporal',
              muscleGroup: 'Core & Abdomen Inferior',
              secondaryMuscles: 'Flexores de Cadera',
              demoFolderId: 'Flat_Bench_Lying_Leg_Raise',
              tempo: '1s subir • 2s bajar controlado',
              cues: 'Mantén la zona lumbar apoyada durante todo el descenso.'
            }
          ]
        }
      ]
    },
    {
      id: 'session-d',
      code: 'D',
      title: 'Sesión D — Tirón: Espalda, Postura & Bíceps',
      subtitle: 'Espalda estética en V, hombros sanos y bíceps tonificados',
      focusTags: ['Día 4: Tirón', 'Piramidal Inversa', 'Al Fallo 🔥'],
      estimatedMinutes: 50,
      slots: [
        {
          slotId: 'slot-d1',
          order: 1,
          defaultTechnique: 'pyramid_desc',
          restSeconds: 90,
          syncMode: 'shared',
          defaultSetsCount: 4,
          defaultTargetReps: '8-10-12-12',
          notes:
            'Pirámide Inversa: Después de calentar, haz la primera serie con tu mejor peso (8 reps) y ve bajando ligeramente para sacar 10 y 12 reps.',
          primaryExercise: {
            id: 'ex-d1-main',
            name: 'Jalón al Pecho en Polea Alta',
            equipment: 'Polea',
            muscleGroup: 'Espalda (Dorsal Ancho)',
            secondaryMuscles: 'Bíceps • Redondo Mayor',
            demoFolderId: 'Wide-Grip_Lat_Pulldown',
            tempo: '1s jalar al pecho • 1s pausa • 2s estirar arriba',
            cues: 'Saca el pecho y lleva la barra hacia la clavícula pensando en bajar los codos hacia los bolsillos.'
          },
          alternatives: [
            {
              id: 'ex-d1-alt1',
              name: 'Dominadas Asistidas en Máquina',
              equipment: 'Máquina',
              muscleGroup: 'Espalda (Dorsal Ancho)',
              secondaryMuscles: 'Bíceps • Core',
              demoFolderId: 'Band_Assisted_Pull-Up',
              tempo: '1s subir • 2s bajar controlado',
              cues: 'Ajusta el contrapeso para completar tus repeticiones con rango completo.'
            },
            {
              id: 'ex-d1-alt2',
              name: 'Pull-Over en Polea Alta con Brazos Rectos',
              equipment: 'Polea',
              muscleGroup: 'Dorsal Ancho Aislado',
              secondaryMuscles: 'Tríceps Cabeza Larga • Core',
              demoFolderId: 'Straight-Arm_Pulldown',
              tempo: '1s llevar a cadera • 1s pausa • 2s estirar',
              cues: 'Brazos semirrígidos llevando la barra o cuerda hacia la cadera.'
            }
          ]
        },
        {
          slotId: 'slot-d2',
          order: 2,
          defaultTechnique: 'normal',
          restSeconds: 90,
          syncMode: 'shared',
          defaultSetsCount: 3,
          defaultTargetReps: '10-12',
          notes: 'Remo horizontal compartido para densidad de espalda y postura firme.',
          primaryExercise: {
            id: 'ex-d2-main',
            name: 'Remo Sentado en Polea Baja (Agarre Neutro)',
            equipment: 'Polea',
            muscleGroup: 'Espalda Media (Romboides y Dorsal)',
            secondaryMuscles: 'Bíceps • Deltoides Posterior',
            demoFolderId: 'Seated_Cable_Rows',
            tempo: '1s tirar • 1s juntar escápulas • 2s regresar',
            cues: 'Torso firme, tira hacia el abdomen juntando las escápulas atrás.'
          },
          alternatives: [
            {
              id: 'ex-d2-alt1',
              name: 'Remo con Mancuerna a Una Mano en Banco',
              equipment: 'Mancuernas',
              muscleGroup: 'Dorsal & Espalda Media',
              secondaryMuscles: 'Bíceps • Core',
              demoFolderId: 'One-Arm_Dumbbell_Row',
              tempo: '1s subir a cadera • 2s bajar',
              cues: 'Lleva la mancuerna hacia la cadera en forma de arco.'
            },
            {
              id: 'ex-d2-alt2',
              name: 'Remo en Máquina con Apoyo al Pecho',
              equipment: 'Máquina',
              muscleGroup: 'Espalda Alta y Media',
              secondaryMuscles: 'Bíceps',
              demoFolderId: 'Leverage_Iso_Row',
              tempo: '1s tirar • 1s pausa • 2s regresar',
              cues: 'Cero tensión en la espalda baja gracias al soporte en el pecho.'
            }
          ]
        },
        {
          slotId: 'slot-d3',
          order: 3,
          supersetGroup: 'SS-D1',
          defaultTechnique: 'normal',
          restSeconds: 25,
          syncMode: 'shared',
          defaultSetsCount: 3,
          defaultTargetReps: '15',
          notes: 'Superserie D1: Salud de hombros, postura erguida y deltoides posterior.',
          primaryExercise: {
            id: 'ex-d3-main',
            name: 'Face Pulls en Polea con Cuerda',
            equipment: 'Polea',
            muscleGroup: 'Hombro Posterior & Manguito Rotador',
            secondaryMuscles: 'Trapecio Medio • Romboides',
            demoFolderId: 'Face_Pull',
            tempo: '1s tirar a la frente • 1s pausa • 2s regresar',
            cues: 'Tira de la cuerda hacia la frente separando las manos y rotando hombros atrás.'
          },
          alternatives: [
            {
              id: 'ex-d3-alt1',
              name: 'Pájaros con Mancuernas Sentado/Inclinado',
              equipment: 'Mancuernas',
              muscleGroup: 'Hombro Posterior',
              secondaryMuscles: 'Espalda Alta',
              demoFolderId: 'Seated_Bent-Over_Rear_Delt_Raise',
              tempo: '1s abrir • 1s pausa • 2s bajar',
              cues: 'Torso inclinado sobre las rodillas, abre los brazos hacia atrás.'
            },
            {
              id: 'ex-d3-alt2',
              name: 'Peck Deck Inverso (Máquina Posterior)',
              equipment: 'Máquina',
              muscleGroup: 'Hombro Posterior',
              secondaryMuscles: 'Romboides',
              demoFolderId: 'Reverse_Machine_Flyes',
              tempo: '1s abrir • 1s sostener • 2s regresar',
              cues: 'Empuja hacia atrás con el dorso de los brazos sin encoger el trapecio.'
            }
          ]
        },
        {
          slotId: 'slot-d4',
          order: 4,
          supersetGroup: 'SS-D1',
          defaultTechnique: 'failure',
          restSeconds: 75,
          syncMode: 'shared',
          defaultSetsCount: 3,
          defaultTargetReps: '10-12 (Última al Fallo 🔥)',
          notes:
            'Superserie D2 + Serie final Al Fallo técnico: saca todas las repeticiones limpias posibles sin balancear la espalda.',
          primaryExercise: {
            id: 'ex-d4-main',
            name: 'Curl de Bíceps Alterno con Mancuernas',
            equipment: 'Mancuernas',
            muscleGroup: 'Bíceps Braquial',
            secondaryMuscles: 'Antebrazo',
            demoFolderId: 'Dumbbell_Alternate_Bicep_Curl',
            tempo: '1s subir girando • 1s apretar • 2s bajar',
            cues: 'Gira la muñeca al subir (supinación) y baja en 2 segundos completos.'
          },
          alternatives: [
            {
              id: 'ex-d4-alt1',
              name: 'Curl de Bíceps en Polea Baja',
              equipment: 'Polea',
              muscleGroup: 'Bíceps Completo',
              secondaryMuscles: 'Braquiorradial',
              demoFolderId: 'Standing_Biceps_Cable_Curl',
              tempo: '1s subir • 1s pausa • 2s bajar',
              cues: 'Tensión continua de principio a fin.'
            },
            {
              id: 'ex-d4-alt2',
              name: 'Curl Predicador en Máquina o Banco',
              equipment: 'Máquina',
              muscleGroup: 'Bíceps (Pico / Cabeza Corta)',
              secondaryMuscles: 'Antebrazo',
              demoFolderId: 'Machine_Preacher_Curls',
              tempo: '1s subir • 2s bajar controlado',
              cues: 'Aísla totalmente el bíceps evitando cualquier impulso.'
            }
          ]
        }
      ]
    },
    {
      id: 'session-e',
      code: 'E',
      title: 'Sesión E (Día 5 Opcional) — Full Body Metabólico & Puntos Débiles',
      subtitle: 'Sesión comodín de quema calórica, Glúteo/Brazos y Core para semanas de 5 días',
      focusTags: ['Día 5 Flexible', 'Superseries', 'Ritmo Metabólico'],
      estimatedMinutes: 45,
      isOptional5thDay: true,
      slots: [
        {
          slotId: 'slot-e1',
          order: 1,
          supersetGroup: 'SS-E1',
          defaultTechnique: 'pyramid_asc',
          restSeconds: 30,
          syncMode: 'shared',
          defaultSetsCount: 3,
          defaultTargetReps: '12-10-8',
          notes:
            'Superserie E1: Empuje inclinado combinado con trabajo específico por objetivo.',
          primaryExercise: {
            id: 'ex-e1-main',
            name: 'Press Inclinado con Mancuernas',
            equipment: 'Mancuernas',
            muscleGroup: 'Pecho Superior & Hombro Frontal',
            secondaryMuscles: 'Tríceps',
            demoFolderId: 'Incline_Dumbbell_Press',
            tempo: '2s bajar • 1s pausa • 1s empujar',
            cues: 'Banco a 30° de inclinación; baja controlado estirando bien el pectoral.'
          },
          alternatives: [
            {
              id: 'ex-e1-alt1',
              name: 'Press Inclinado en Máquina',
              equipment: 'Máquina',
              muscleGroup: 'Pecho Superior',
              secondaryMuscles: 'Tríceps',
              demoFolderId: 'Leverage_Incline_Chest_Press',
              tempo: '2s bajar • 1s empujar',
              cues: 'Empuje seguro y rápido para alternar en pareja.'
            },
            {
              id: 'ex-e1-alt2',
              name: 'Cruces en Polea Baja',
              equipment: 'Polea',
              muscleGroup: 'Pecho Superior & Core',
              secondaryMuscles: 'Hombro Anterior',
              demoFolderId: 'Low_Cable_Crossover',
              tempo: '2s bajar • 1s subir',
              cues: 'Mantén el abdomen firme durante todo el movimiento.'
            }
          ]
        },
        {
          slotId: 'slot-e2',
          order: 2,
          supersetGroup: 'SS-E1',
          defaultTechnique: 'normal',
          restSeconds: 65,
          syncMode: 'individual',
          defaultSetsCount: 3,
          defaultTargetReps: '12-15',
          notes:
            'Superserie E2 en Modo Individual por defecto: Brazos/Braquial para él y Glúteo focalizado para ella (o cambien a Compartido con 1 toque).',
          primaryExercise: {
            id: 'ex-e2-main',
            name: 'Curl Martillo con Mancuernas',
            equipment: 'Mancuernas',
            muscleGroup: 'Bíceps & Braquial',
            secondaryMuscles: 'Antebrazo',
            demoFolderId: 'Hammer_Curls',
            tempo: '1s subir • 1s pausa • 2s bajar',
            cues: 'Agarre neutro (palmas viéndose entre sí), sin mover los codos.'
          },
          alternatives: [
            {
              id: 'ex-e2-alt1',
              name: 'Curl Martillo con Cuerda en Polea Baja',
              equipment: 'Polea',
              muscleGroup: 'Bíceps & Antebrazo',
              secondaryMuscles: 'Braquial',
              demoFolderId: 'Cable_Hammer_Curls_-_Rope_Attachment',
              tempo: '1s subir • 2s bajar',
              cues: 'Sube con agarre neutro separando ligeramente al final.'
            },
            {
              id: 'ex-e2-alt2',
              name: 'Curl con Barra Z',
              equipment: 'Barra',
              muscleGroup: 'Bíceps Completo',
              secondaryMuscles: 'Antebrazo',
              demoFolderId: 'EZ-Bar_Curl',
              tempo: '1s subir • 2s bajar',
              cues: 'Cómodo para las muñecas y excelente bombeo.'
            }
          ],
          femaleFocusedPrimary: {
            id: 'ex-e2-partner',
            name: 'Patada de Glúteo en Polea o Peso Corporal',
            equipment: 'Polea',
            muscleGroup: 'Glúteo Mayor',
            secondaryMuscles: 'Femoral',
            demoFolderId: 'Glute_Kickback',
            tempo: '1s patada • 2s apretar arriba • 2s bajar',
            cues: 'Controla 2 segundos arriba apretando el glúteo.'
          },
          femaleFocusedAlternatives: [
            {
              id: 'ex-e2-partner-alt1',
              name: 'Puente de Glúteo con Mancuerna',
              equipment: 'Mancuernas',
              muscleGroup: 'Glúteo Mayor y Medio',
              secondaryMuscles: 'Core',
              demoFolderId: 'Barbell_Glute_Bridge',
              tempo: 'Bombeo continuo controlado',
              cues: 'Mancuerna sobre la cadera y pausa de 2 segundos arriba.'
            },
            {
              id: 'ex-e2-partner-alt2',
              name: 'Abducción de Glúteo en Máquina',
              equipment: 'Máquina',
              muscleGroup: 'Glúteo Medio',
              secondaryMuscles: 'Cadera Lateral',
              demoFolderId: 'Thigh_Abductor',
              tempo: '1s abrir • 1s pausa • 2s cerrar',
              cues: 'Alto número de repeticiones (15-20) para bombeo.'
            }
          ]
        },
        {
          slotId: 'slot-e3',
          order: 3,
          defaultTechnique: 'dropset',
          restSeconds: 60,
          syncMode: 'shared',
          defaultSetsCount: 3,
          defaultTargetReps: '15 + Dropset / Fallo 🔥',
          notes: 'Cierre metabólico compartido de cadena posterior y abdomen.',
          primaryExercise: {
            id: 'ex-e3-main',
            name: 'Kettlebell Swings o Bicicleta Abdominal',
            equipment: 'Kettlebell',
            muscleGroup: 'Cadena Posterior, Core & Gasto Metabólico',
            secondaryMuscles: 'Glúteo • Abdomen • Cardio',
            demoFolderId: 'One-Arm_Kettlebell_Swings',
            tempo: 'Dinámico explosivo de cadera',
            cues: 'Impulso explosivo de cadera, abdomen y glúteos contraídos arriba.'
          },
          alternatives: [
            {
              id: 'ex-e3-alt1',
              name: 'Bicicleta Abdominal Alternada (Air Bike)',
              equipment: 'Peso Corporal',
              muscleGroup: 'Oblicuos & Recto Abdominal',
              secondaryMuscles: 'Core Profundo',
              demoFolderId: 'Air_Bike',
              tempo: '35s continuos controlados',
              cues: 'Gira el hombro hacia la rodilla contraria de forma fluida.'
            },
            {
              id: 'ex-e3-alt2',
              name: 'Rueda Abdominal (Ab Roller) o Plancha',
              equipment: 'Peso Corporal',
              muscleGroup: 'Core Completo',
              secondaryMuscles: 'Dorsal • Hombros',
              demoFolderId: 'Ab_Roller',
              tempo: '2s extender • 1s regresar con abdomen',
              cues: 'Rango hasta donde mantengas la cadera firme.'
            }
          ]
        }
      ]
    }
  ]
}

// Base de datos 100% limpia para que el usuario y su pareja registren solo entrenamientos reales desde el Día 1
export const INITIAL_HISTORY: WorkoutHistoryEntry[] = []

export const FITNESS_GLOSSARY: GlossaryItem[] = [
  {
    id: 'mesociclo',
    category: 'Planificación',
    title: '¿Qué es un Mesociclo y cada cuánto cambiar la rutina?',
    shortBadge: '6 a 8 Semanas',
    summary:
      'Un Mesociclo es un bloque de entrenamiento planificado que dura entre 6 y 8 semanas con un objetivo específico (como Recomposición Corporal o Ganancia de Fuerza).',
    howToApply: [
      'Semanas 1 y 2 (Adaptación): Tu sistema nervioso coordina los ejercicios y encuentras tu peso ideal sin dolor articular.',
      'Semanas 3 a 5 (Sobrecarga Progresiva): Aquí ocurre la magia. Como ya dominas los movimientos, subes un poco el peso o sacas 1-2 repeticiones extra.',
      'Semana 6 a 8 (Cierre o Descarga): Antes de que el cuerpo se estanque, renovamos la rutina cambiando ángulos, variantes o el orden de pirámides/superseries.'
    ],
    proTip:
      'Cambiar de rutina cada semana impide que tu cuerpo progrese; mantenerla 6 semanas te permite medir exactamente cuánto más fuerte eres.'
  },
  {
    id: 'piramidal',
    category: 'Técnicas Avanzadas',
    title: 'Series Piramidales (Ascendente vs. Inversa)',
    shortBadge: '🔺 Piramidal',
    summary:
      'Consiste en escalonar el peso y las repeticiones de una serie a otra dentro del mismo ejercicio para combinar estímulo metabólico y fuerza mecánica.',
    howToApply: [
      '🔺 Pirámide Ascendente (Clásica): Empiezas con peso moderado y más repeticiones, y en cada serie subes el peso y bajas las repeticiones (Ej: Serie 1: 12 reps ➔ Serie 2: 10 reps ➔ Serie 3: 8 reps ➔ Serie 4: 6 reps). Es súper segura porque tus músculos y articulaciones van entrando en calor progresivamente.',
      '🔻 Pirámide Inversa (Descendente): Después de calentar bien, haces tu serie más pesada al principio cuando estás 100% fresco (Ej: Serie 1: 6-8 reps pesadas) y luego bajas un 8-10% el peso en cada serie para sacar 10 y 12 repeticiones.'
    ],
    proTip:
      'En Kineo puedes pulsar el botón "🔺 Pirámide Asc." o "🔻 Pirámide Inv." en cualquier ejercicio y la app calculará los pesos de cada escalón automáticamente.'
  },
  {
    id: 'superserie',
    category: 'Técnicas Avanzadas',
    title: '¿Qué es una Superserie (Superset)?',
    shortBadge: '🔗 A1 + A2',
    summary:
      'Es realizar 2 ejercicios seguidos uno tras otro sin descanso (o con solo 15-30s para cambiar de estación) y descansar únicamente cuando terminas ambos.',
    howToApply: [
      'Haces 1 serie del Ejercicio A1 (ej. Elevaciones Laterales).',
      'Inmediatamente pasas al Ejercicio A2 (ej. Extensión de Tríceps o Crunch Abdominal).',
      'Al terminar el A2, activas el cronómetro de descanso completo (60-75s) y repites el bloque.'
    ],
    proTip:
      'Las superseries ahorran hasta un 35% de tiempo en el gimnasio y mantienen tu frecuencia cardiaca alta, lo cual es excelente para quemar grasa manteniendo músculo.'
  },
  {
    id: 'dropset',
    category: 'Técnicas Avanzadas',
    title: '¿Qué es un Dropset (Serie Descendente)?',
    shortBadge: '📉 Dropset',
    summary:
      'Es una técnica de intensidad que se aplica normalmente en la última serie de un ejercicio: llegas cerca del límite, bajas el peso entre un 20% y 25% de inmediato (sin descansar) y sigues sacando repeticiones.',
    howToApply: [
      'Completa tu serie principal (ej. 10 repeticiones con 30 kg en polea).',
      'Sin descansar, mueve el pin de la máquina o toma unas mancuernas un ~20% más ligeras (24 kg) y saca otras 8-10 repeticiones.',
      'Opcionalmente haz un segundo Drop (18 kg) para bombear al máximo el músculo.'
    ],
    proTip:
      'Úsalo sobre todo en máquinas, poleas o mancuernas (como extensiones de tríceps, cuádriceps o abducción de glúteo) donde cambiar el peso toma menos de 5 segundos.'
  },
  {
    id: 'rir-fallo',
    category: 'Seguridad y Pesos',
    title: 'RIR (Repeticiones en Recámara) vs. Entrenar Al Fallo',
    shortBadge: '🔥 RIR / Fallo',
    summary:
      'El RIR indica cuántas repeticiones más podrías haber hecho con buena técnica antes de que tus músculos ya no pudieran subir el peso.',
    howToApply: [
      'RIR 2 (Zona Ideal Segura): Terminas tu serie de 10 repeticiones sintiendo que, si te obligaran, podrías haber sacado 2 más limpias. Estimula el 95% del crecimiento muscular sin riesgo de lesión.',
      '🔥 Al Fallo Técnico (RIR 0): Sacas repeticiones hasta que la velocidad baja y sabes que la siguiente repetición ya deformaría tu postura. Guárdalo solo para la última serie de ejercicios seguros (bíceps, tríceps, máquinas o poleas).'
    ],
    proTip:
      'Nunca busques el fallo extremo en ejercicios libres pesados de espalda baja o rodilla (como Peso Muerto o Sentadilla libre); ahí mantén siempre RIR 2.'
  },
  {
    id: 'recomposicion',
    category: 'Objetivos',
    title: 'Recomposición Corporal y Tonificación en Pareja',
    shortBadge: 'Objetivo Dual',
    summary:
      'Perder grasa mientras construyes o reafirmas músculo al mismo tiempo. La palabra "tonificar" en realidad significa tener músculo firme con un porcentaje de grasa más bajo.',
    howToApply: [
      'Entrenamiento de Fuerza Progresivo: Las pesas le dan la señal a tu cuerpo de conservar y afirmar el músculo mientras oxidas grasa.',
      'Flexibilidad 3 a 5 Días: La constancia gana siempre. Si una semana van 3 días y otra 5, seguir la cola rotativa A ➔ B ➔ C ➔ D garantiza que todo el cuerpo reciba estímulo empezando con Tren Inferior.',
      'Proteína y Descanso: Acompañen el entrenamiento con suficiente agua, proteína en cada comida y buen sueño.'
    ],
    proTip:
      'Entrenar los mismos ejercicios juntos usando el Modo Compartido de Kineo aumenta la adherencia: mientras uno descansa 60-90 segundos, el otro ejecuta su serie.'
  }
]
