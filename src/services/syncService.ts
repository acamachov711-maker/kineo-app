import mqtt, { MqttClient } from 'mqtt'
import {
  SetEntry,
  SetTechnique,
  SyncMode,
  UserProfile,
  WorkoutHistoryEntry
} from '../types'

export interface SlotLiveState {
  syncMode: SyncMode
  techniqueByProfile: Record<'user_1' | 'user_2', SetTechnique>
  setsByProfile: Record<'user_1' | 'user_2', SetEntry[]>
}

export interface LiveRoomStatePayload {
  senderDeviceId: string
  updatedAt: number
  activeSessionId: string
  isWorkoutStarted: boolean
  lastCompletedWorkoutDate?: string
  lastCompletedSessionCode?: string
  slotsState: Record<string, SlotLiveState>
  profiles: Record<'user_1' | 'user_2', UserProfile>
  history: WorkoutHistoryEntry[]
}

const DEVICE_ID_KEY = 'kineo_unique_device_id_v1_4'

export function getOrCreateDeviceId(): string {
  try {
    let existing = localStorage.getItem(DEVICE_ID_KEY)
    if (!existing) {
      existing = `dev-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
      localStorage.setItem(DEVICE_ID_KEY, existing)
    }
    return existing
  } catch {
    return `dev-${Math.random().toString(36).slice(2, 10)}`
  }
}

export function generateCoupleRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'KINEO-'
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

class LiveSyncManager {
  private client: MqttClient | null = null
  private currentRoomCode: string | null = null
  private deviceId: string = getOrCreateDeviceId()
  private onStateReceivedCallback: ((payload: LiveRoomStatePayload) => void) | null = null
  private onStatusChangeCallback:
    | ((status: 'disconnected' | 'connecting' | 'connected') => void)
    | null = null

  public connectRoom(
    roomCode: string,
    onStateReceived: (payload: LiveRoomStatePayload) => void,
    onStatusChange: (status: 'disconnected' | 'connecting' | 'connected') => void
  ) {
    const cleanCode = normalizeRoomCode(roomCode)
    if (!cleanCode) {
      this.disconnect()
      return
    }

    this.onStateReceivedCallback = onStateReceived
    this.onStatusChangeCallback = onStatusChange

    if (this.client && this.currentRoomCode === cleanCode && this.client.connected) {
      onStatusChange('connected')
      return
    }

    this.disconnect()
    this.currentRoomCode = cleanCode
    onStatusChange('connecting')

    const topicState = `kineo/v1_5/room/${cleanCode}/state`

    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
      clientId: `kineo_${this.deviceId}_${Math.random().toString(16).slice(2, 6)}`,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 3000
    })

    this.client = client

    client.on('connect', () => {
      this.onStatusChangeCallback?.('connected')
      client.subscribe(topicState, { qos: 1 })
    })

    client.on('reconnect', () => {
      this.onStatusChangeCallback?.('connecting')
    })

    client.on('close', () => {
      this.onStatusChangeCallback?.('disconnected')
    })

    client.on('error', () => {
      this.onStatusChangeCallback?.('disconnected')
    })

    client.on('message', (topic, message) => {
      if (topic !== topicState) return
      try {
        const parsed = JSON.parse(message.toString()) as LiveRoomStatePayload
        if (!parsed || parsed.senderDeviceId === this.deviceId) return
        this.onStateReceivedCallback?.(parsed)
      } catch {
        // Ignore malformed packets
      }
    })
  }

  public broadcastState(state: Omit<LiveRoomStatePayload, 'senderDeviceId' | 'updatedAt'>) {
    if (!this.client || !this.currentRoomCode || !this.client.connected) return
    const topicState = `kineo/v1_5/room/${this.currentRoomCode}/state`
    const payload: LiveRoomStatePayload = {
      ...state,
      senderDeviceId: this.deviceId,
      updatedAt: Date.now()
    }
    try {
      this.client.publish(topicState, JSON.stringify(payload), {
        qos: 1,
        retain: true
      })
    } catch {
      // Ignore network hiccup
    }
  }

  public disconnect() {
    if (this.client) {
      try {
        this.client.end(true)
      } catch {
        // Ignore
      }
      this.client = null
    }
    this.currentRoomCode = null
    this.onStatusChangeCallback?.('disconnected')
  }
}

export const liveSyncManager = new LiveSyncManager()
