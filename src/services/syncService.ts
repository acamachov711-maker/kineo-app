import type { SetEntry, SetTechnique, SyncMode } from '../types'

export interface SlotLiveState {
  syncMode: SyncMode
  techniqueByProfile: Record<'user_1' | 'user_2', SetTechnique>
  setsByProfile: Record<'user_1' | 'user_2', SetEntry[]>
}

export const SYNC_TRANSPORT_STATUS = 'public_opt_in' as const
