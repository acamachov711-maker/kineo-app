export type WeightUnit = 'kg' | 'lb'

export type GenderType = 'male' | 'female' | 'other'

export type SetTechnique =
  | 'normal'
  | 'pyramid_asc'
  | 'pyramid_desc'
  | 'dropset'
  | 'failure'

export type SyncMode = 'shared' | 'individual'

export interface ExerciseVariant {
  id: string
  name: string
  equipment: 'Máquina' | 'Mancuernas' | 'Barra' | 'Polea' | 'Peso Corporal' | 'Kettlebell'
  muscleGroup: string
  secondaryMuscles?: string
  demoFolderId: string
  tempo?: string
  cues: string
  stepByStep?: [string, string, string]
}

export interface DropSubSet {
  id: string
  weightKg: number
  reps: number
  completed: boolean
}

export interface SetEntry {
  setNumber: number
  targetReps: string
  weightKg: number
  actualReps: number
  rir: number
  isFailure?: boolean
  completed: boolean
  drops?: DropSubSet[]
}

export interface ExerciseSlot {
  slotId: string
  order: number
  supersetGroup?: string
  defaultTechnique: SetTechnique
  restSeconds: number
  syncMode: SyncMode
  primaryExercise: ExerciseVariant
  alternatives: [ExerciseVariant, ExerciseVariant]
  femaleFocusedPrimary?: ExerciseVariant
  femaleFocusedAlternatives?: [ExerciseVariant, ExerciseVariant]
  defaultSetsCount: number
  defaultTargetReps: string
  notes: string
}

export interface WorkoutSessionTemplate {
  id: string
  code: 'A' | 'B' | 'C' | 'D' | 'E'
  title: string
  subtitle: string
  focusTags: string[]
  estimatedMinutes: number
  isOptional5thDay?: boolean
  slots: ExerciseSlot[]
}

export interface MesocyclePlan {
  id: string
  name: string
  goalDescription: string
  startDate: string
  durationWeeks: number
  currentWeek: number
  recommendedDaysMin: number
  recommendedDaysMax: number
  sessions: WorkoutSessionTemplate[]
}

export interface UserProfile {
  id: 'user_1' | 'user_2'
  name: string
  gender: GenderType
  isDeviceOwner: boolean
  goal: string
  level: string
  age?: number
  bodyWeightKg?: number
  heightCm?: number
  accentColor: string
  badgeColor: string
  activeVariantBySlot: Record<string, string>
  estimated1RMByVariant: Record<string, number>
}

export interface DeviceConfig {
  onboardingCompleted: boolean
  primaryProfileId: 'user_1' | 'user_2'
  coupleModeEnabled: boolean
  /**
   * ISO date (YYYY-MM-DD) when the user finished today's session.
   * If lastCompletedWorkoutDate === today, the Workout tab locks into "Rest until tomorrow" mode.
   */
  lastCompletedWorkoutDate?: string
  lastCompletedSessionCode?: string
}

export interface CompletedExerciseRecord {
  slotId: string
  variantId: string
  variantName: string
  muscleGroup: string
  equipment: string
  technique: SetTechnique
  maxWeightKg: number
  estimated1RmKg: number
  totalVolumeKg: number
  bestSetReps: number
  sets: SetEntry[]
}

export interface WorkoutHistoryEntry {
  id: string
  date: string
  sessionId: string
  sessionCode: string
  sessionTitle: string
  profileId: 'user_1' | 'user_2'
  totalVolumeKg: number
  completedSets: number
  durationMinutes: number
  isSampleData?: boolean
  exercises: CompletedExerciseRecord[]
}

export interface GlossaryItem {
  id: string
  category: 'Planificación' | 'Técnicas Avanzadas' | 'Seguridad y Pesos' | 'Objetivos'
  title: string
  shortBadge: string
  summary: string
  howToApply: string[]
  proTip: string
}
