import {
  WeightUnit,
  SetEntry,
  WorkoutHistoryEntry
} from '../types'

const KG_TO_LB = 2.20462262185

export function kgToLb(kg: number): number {
  return Math.round(kg * KG_TO_LB * 2) / 2
}

export function lbToKg(lb: number): number {
  return Math.round((lb / KG_TO_LB) * 2) / 2
}

export function roundGymWeight(value: number, unit: WeightUnit): number {
  if (value <= 0) return 0
  const step = unit === 'kg' ? 1.25 : 2.5
  return Math.max(step, Math.round(value / step) * step)
}

export function formatDualWeight(weightKg: number, primaryUnit: WeightUnit): string {
  const cleanKg = Math.round(weightKg * 10) / 10
  const cleanLb = kgToLb(weightKg)
  if (primaryUnit === 'kg') {
    return `${cleanKg} kg (${cleanLb} lb)`
  }
  return `${cleanLb} lb (${cleanKg} kg)`
}

export function displayWeightValue(weightKg: number, unit: WeightUnit): number {
  if (unit === 'kg') {
    return Math.round(weightKg * 10) / 10
  }
  return kgToLb(weightKg)
}

export function parseInputToKg(inputValue: number, unit: WeightUnit): number {
  if (isNaN(inputValue) || inputValue < 0) return 0
  return unit === 'kg' ? inputValue : lbToKg(inputValue)
}

export function calculateSafe1RM(weightKg: number, performedReps: number, rir: number): number {
  if (weightKg <= 0 || performedReps <= 0) return 0
  const effectiveReps = Math.min(20, performedReps + Math.max(0, rir))
  if (effectiveReps === 1) return weightKg
  const epley = weightKg * (1 + effectiveReps / 30)
  const brzycki = weightKg * (36 / (37 - effectiveReps))
  const avg = (epley + brzycki) / 2
  return Math.round(avg * 2) / 2
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
  const roundKg = (pct: number) => Math.max(2.5, Math.round((oneRepMaxKg * pct) / 1.25) * 1.25)
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
  const drop1 = Math.max(2.5, Math.round((base * 0.8) / 1.25) * 1.25)
  const drop2 = Math.max(2.5, Math.round((drop1 * 0.8) / 1.25) * 1.25)
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
  user1Weight: number
  user2Weight: number
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
        user1Weight: 0,
        user2Weight: 0,
        user1OneRm: 0,
        user2OneRm: 0
      }
      const convertedMax = displayWeightValue(ex.maxWeightKg, unit)
      const converted1Rm = displayWeightValue(ex.estimated1RmKg, unit)
      if (entry.profileId === 'user_1') {
        existing.user1Weight = Math.max(existing.user1Weight, convertedMax)
        existing.user1OneRm = Math.max(existing.user1OneRm, converted1Rm)
      } else {
        existing.user2Weight = Math.max(existing.user2Weight, convertedMax)
        existing.user2OneRm = Math.max(existing.user2OneRm, converted1Rm)
      }
      byDate.set(entry.date, existing)
    })
  })

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, val]) => val)
}
