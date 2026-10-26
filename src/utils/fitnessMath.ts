import {
  WeightUnit,
  SetEntry,
  WorkoutHistoryEntry
} from '../types'

const KG_TO_LB = 2.20462262185

export function kgToLb(kg: number): number {
  if (kg <= 0) return 0
  return Math.round(kg * KG_TO_LB * 100) / 100
}

export function lbToKg(lb: number): number {
  if (lb <= 0) return 0
  // V1.6-01: Conserva 4 decimales internos sin redondear forzosamente a 0.5 kg
  return Math.round((lb / KG_TO_LB) * 10000) / 10000
}

export function roundGymWeight(value: number, unit: WeightUnit): number {
  if (value <= 0) return 0
  const step = unit === 'kg' ? 1.25 : 2.5
  return Math.max(step, Math.round(value / step) * step)
}

export function formatDualWeight(weightKg: number, primaryUnit: WeightUnit): string {
  const cleanKg = Math.round(weightKg * 100) / 100
  const cleanLb = kgToLb(weightKg)
  if (primaryUnit === 'kg') {
    return `${cleanKg} kg (${cleanLb} lb)`
  }
  return `${cleanLb} lb (${cleanKg} kg)`
}

export function displayWeightValue(weightKg: number, unit: WeightUnit): number {
  if (weightKg <= 0) return 0
  if (unit === 'kg') {
    return Math.round(weightKg * 100) / 100
  }
  return kgToLb(weightKg)
}

export function parseInputToKg(inputValue: number, unit: WeightUnit): number {
  if (isNaN(inputValue) || inputValue < 0) return 0
  return unit === 'kg' ? inputValue : lbToKg(inputValue)
}

export function sanitizeDecimalInput(raw: string): string {
  const normalized = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const parts = normalized.split('.')
  if (parts.length <= 2) {
    return normalized
  }
  return `${parts[0]}.${parts.slice(1).join('')}`
}

export function calculateSafe1RM(weightKg: number, performedReps: number, rir: number): number {
  if (weightKg <= 0 || performedReps <= 0) return 0
  const effectiveReps = Math.min(35, performedReps + Math.max(0, rir))
  if (effectiveReps === 1) return weightKg
  const epley = weightKg * (1 + effectiveReps / 30)
  const brzycki =
    effectiveReps < 36 ? weightKg * (36 / (37 - effectiveReps)) : epley
  const avg = (epley + brzycki) / 2
  return Math.round(avg * 10) / 10
}

/**
 * V1.6-04: Compensación automática de repeticiones cuando el usuario cambia el peso
 * respecto a su 1RM calibrado, manteniendo la misma proximidad al fallo (RIR).
 * Acotado entre 4 y 25 repeticiones por seguridad articular.
 */
export function calculateCompensatedReps(
  oneRmKg: number,
  newWeightKg: number,
  targetRir: number = 2
): number {
  if (oneRmKg <= 0 || newWeightKg <= 0) return 10
  if (newWeightKg >= oneRmKg * 0.96) return 4
  const epleyEffectiveReps = 30 * (oneRmKg / newWeightKg - 1)
  const brzyckiEffectiveReps = 37 - (36 * newWeightKg) / oneRmKg
  const avgEffectiveReps = (epleyEffectiveReps + brzyckiEffectiveReps) / 2
  const compensated = Math.round(avgEffectiveReps - Math.max(0, targetRir))
  return Math.max(4, Math.min(25, compensated))
}

export type ExerciseLoadCategory =
  | 'dual_dumbbell'
  | 'single_implement'
  | 'bilateral_plates'
  | 'stack_or_body'

/**
 * V1.6-03: Clasifica cualquier ejercicio del catálogo según cómo se carga el peso en la vida real:
 * - 'dual_dumbbell': 2 mancuernas independientes (1 en cada mano)
 * - 'single_implement': 1 sola mancuerna/kettlebell sujetada con ambas manos (Goblet, Copa, Puente, Swing)
 * - 'bilateral_plates': discos cargados a cada lado (Barra, Prensa 45°, Sentadilla Hack, Multipower)
 * - 'stack_or_body': polea, máquina de placas con pin o peso corporal
 */
export function getExerciseLoadCategory(
  equipment: string,
  exerciseName: string
): ExerciseLoadCategory {
  const nameLower = exerciseName.toLowerCase()

  if (equipment === 'Kettlebell') {
    return 'single_implement'
  }

  if (equipment === 'Mancuernas') {
    if (
      nameLower.includes('goblet') ||
      nameLower.includes('copa') ||
      nameLower.includes('puente') ||
      nameLower.includes('francés') ||
      nameLower.includes('frances')
    ) {
      return 'single_implement'
    }
    return 'dual_dumbbell'
  }

  if (
    equipment === 'Barra' ||
    nameLower.includes('prensa') ||
    nameLower.includes('hack') ||
    nameLower.includes('multipower') ||
    nameLower.includes('barra')
  ) {
    return 'bilateral_plates'
  }

  return 'stack_or_body'
}

/**
 * Devuelve una guía directa y sin ambigüedad sobre cómo cargar el peso en el gimnasio (V1.6-03):
 * - En Doble Mancuerna: indica que el peso mostrado es por CADA mano y muestra la suma total de ambas.
 * - En Mancuerna / Kettlebell única: aclara que es 1 sola pesa total.
 * - En Barra / Prensa 45° / Hack: indica cuánto poner de cada lado y el total.
 * - En Poleas / Placas: indica que es el pin directo en la placa.
 */
export function getLoadInstruction(
  weightKg: number,
  equipment: string,
  exerciseName: string,
  unit: WeightUnit
): string {
  if (weightKg <= 0) return ''
  const shown = displayWeightValue(weightKg, unit)
  const halfShown = Math.round((shown / 2) * 10) / 10
  const doubleShown = Math.round(shown * 2 * 10) / 10
  const category = getExerciseLoadCategory(equipment, exerciseName)

  if (category === 'single_implement') {
    if (equipment === 'Kettlebell') {
      return `1 Pesa Rusa única: ${shown} ${unit} (total)`
    }
    return `1 Mancuerna única: ${shown} ${unit} (total)`
  }

  if (category === 'dual_dumbbell') {
    return `${shown} ${unit} c/mano (Total par: ${doubleShown} ${unit})`
  }

  if (category === 'bilateral_plates') {
    if (equipment === 'Barra') {
      const barWeight = unit === 'kg' ? 20 : 45
      if (shown > barWeight) {
        const perSideWithBar = Math.round(((shown - barWeight) / 2) * 10) / 10
        return `${halfShown} ${unit}/lado (o ${perSideWithBar} ${unit}/lado + barra ${barWeight}${unit})`
      }
      return `Carga: ${halfShown} ${unit}/lado (Total ${shown} ${unit})`
    }
    return `Discos: ${halfShown} ${unit}/lado (Total ${shown} ${unit})`
  }

  if (equipment === 'Polea' || equipment === 'Máquina') {
    return `Pin en placa: ${shown} ${unit}`
  }

  return `${shown} ${unit}`
}

export interface IdealWeightZones {
  oneRepMaxKg: number
  strengthKg: number
  hypertrophyKg: number
  metabolicToneKg: number
  pyramidAscKg: [number, number, number, number]
  pyramidDescKg: [number, number, number, number]
}

export function getIdealWeightZones(oneRepMaxKg: number): IdealWeightZones {
  if (oneRepMaxKg <= 0) {
    return {
      oneRepMaxKg: 0,
      strengthKg: 0,
      hypertrophyKg: 0,
      metabolicToneKg: 0,
      pyramidAscKg: [0, 0, 0, 0],
      pyramidDescKg: [0, 0, 0, 0]
    }
  }
  const roundKg = (pct: number) => Math.max(1.25, Math.round((oneRepMaxKg * pct) / 1.25) * 1.25)
  return {
    oneRepMaxKg: Math.round(oneRepMaxKg * 10) / 10,
    strengthKg: roundKg(0.82),
    hypertrophyKg: roundKg(0.74),
    metabolicToneKg: roundKg(0.65),
    pyramidAscKg: [roundKg(0.65), roundKg(0.71), roundKg(0.77), roundKg(0.82)],
    pyramidDescKg: [roundKg(0.82), roundKg(0.76), roundKg(0.70), roundKg(0.64)]
  }
}

export function buildPyramidSets(
  direction: 'pyramid_asc' | 'pyramid_desc',
  baseOneRmKg: number,
  currentSets: SetEntry[]
): SetEntry[] {
  const zones = getIdealWeightZones(baseOneRmKg)
  const ascReps = ['12', '10', '8', '6']
  const descReps = ['6', '8', '10', '12']
  const ascActual = [12, 10, 8, 6]
  const descActual = [6, 8, 10, 12]

  const count = Math.max(3, currentSets.length)
  return Array.from({ length: count }, (_, idx) => {
    const stepIdx = Math.min(idx, 3)
    const existing = currentSets[idx]
    const weightKg =
      baseOneRmKg > 0
        ? direction === 'pyramid_asc'
          ? zones.pyramidAscKg[stepIdx]
          : zones.pyramidDescKg[stepIdx]
        : existing?.weightKg ?? 0
    const targetReps = direction === 'pyramid_asc' ? ascReps[stepIdx] : descReps[stepIdx]
    const actualReps = direction === 'pyramid_asc' ? ascActual[stepIdx] : descActual[stepIdx]

    return {
      setNumber: idx + 1,
      targetReps,
      weightKg,
      actualReps,
      rir: idx === count - 1 ? 1 : 2,
      isFailure: existing?.isFailure ?? false,
      completed: existing?.completed ?? false,
      drops: existing?.drops
    }
  })
}

export function generateDropSubSets(topWeightKg: number): {
  id: string
  weightKg: number
  reps: number
  completed: boolean
}[] {
  const base = topWeightKg > 0 ? topWeightKg : 20
  const drop1 = Math.max(1.25, Math.round((base * 0.8) / 1.25) * 1.25)
  const drop2 = Math.max(1.25, Math.round((drop1 * 0.8) / 1.25) * 1.25)
  return [
    {
      id: `drop-1-${Date.now()}`,
      weightKg: drop1,
      reps: 8,
      completed: false
    },
    {
      id: `drop-2-${Date.now() + 1}`,
      weightKg: drop2,
      reps: 10,
      completed: false
    }
  ]
}

export function calculateBMI(weightKg?: number, heightCm?: number): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null
  const heightM = heightCm / 100
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10
}

export interface StreakMetrics {
  weeklySessionsDone: number
  weeklyTargetMin: number
  weeklyTargetMax: number
  activeWeekStreak: number
  totalWorkouts: number
  weekDaysCompleted: boolean[]
  isGoalMetThisWeek: boolean
}

export function calculateProfileStreak(
  history: WorkoutHistoryEntry[],
  profileId: 'user_1' | 'user_2'
): StreakMetrics {
  const userEntries = history.filter((h) => h.profileId === profileId)
  const uniqueDates = Array.from(new Set(userEntries.map((h) => h.date))).sort()

  const referenceDate =
    uniqueDates.length > 0
      ? new Date(uniqueDates[uniqueDates.length - 1] + 'T12:00:00')
      : new Date()
  const dayOfWeek = (referenceDate.getDay() + 6) % 7
  const monday = new Date(referenceDate)
  monday.setDate(referenceDate.getDate() - dayOfWeek)

  const weekDaysCompleted = [false, false, false, false, false, false, false]
  let weeklySessionsDone = 0

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    if (uniqueDates.includes(iso)) {
      weekDaysCompleted[i] = true
      weeklySessionsDone += 1
    }
  }

  const weeksMap = new Map<string, number>()
  uniqueDates.forEach((dateStr) => {
    const dt = new Date(dateStr + 'T12:00:00')
    const dow = (dt.getDay() + 6) % 7
    const mon = new Date(dt)
    mon.setDate(dt.getDate() - dow)
    const key = mon.toISOString().slice(0, 10)
    weeksMap.set(key, (weeksMap.get(key) || 0) + 1)
  })

  const activeWeekStreak = uniqueDates.length === 0 ? 0 : Math.max(1, weeksMap.size)

  return {
    weeklySessionsDone,
    weeklyTargetMin: 3,
    weeklyTargetMax: 5,
    activeWeekStreak,
    totalWorkouts: userEntries.length,
    weekDaysCompleted,
    isGoalMetThisWeek: weeklySessionsDone >= 3
  }
}

export interface ExerciseWeightPoint {
  date: string
  user1Weight: number | null
  user2Weight: number | null
  user1OneRm: number
  user2OneRm: number
}

export function getExerciseWeightHistory(
  history: WorkoutHistoryEntry[],
  variantId: string,
  unit: WeightUnit
): ExerciseWeightPoint[] {
  const byDate = new Map<string, ExerciseWeightPoint>()

  history.forEach((entry) => {
    entry.exercises.forEach((ex) => {
      if (ex.variantId !== variantId) return
      const existing = byDate.get(entry.date) || {
        date: entry.date.slice(5),
        user1Weight: null,
        user2Weight: null,
        user1OneRm: 0,
        user2OneRm: 0
      }
      const convertedMax = displayWeightValue(ex.maxWeightKg, unit)
      const converted1Rm = displayWeightValue(ex.estimated1RmKg, unit)
      if (entry.profileId === 'user_1') {
        existing.user1Weight = Math.max(existing.user1Weight ?? 0, convertedMax)
        existing.user1OneRm = Math.max(existing.user1OneRm, converted1Rm)
      } else {
        existing.user2Weight = Math.max(existing.user2Weight ?? 0, convertedMax)
        existing.user2OneRm = Math.max(existing.user2OneRm, converted1Rm)
      }
      byDate.set(entry.date, existing)
    })
  })

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, val]) => val)
}
