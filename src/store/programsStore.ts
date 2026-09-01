import { create } from 'zustand'
import { api } from '@/lib/api'
import type {
  LoyaltyProgram, LoyaltyPointsConfig, LoyaltyVisitsConfig, LoyaltyReward,
  LoyaltyCustomer, LoyaltyTransaction, AnalyticsData, Anomaly,
  LoyaltyNotification, AudienceFilter, NotificationChannel,
} from '@/types/loyalty'

export interface ProgramFull {
  program: LoyaltyProgram
  config: LoyaltyPointsConfig | LoyaltyVisitsConfig | null
}

interface ProgramsState {
  programs: ProgramFull[]
  isLoading: boolean
  requestGeneration: number

  customers: LoyaltyCustomer[]
  isLoadingCustomers: boolean
  transactions: LoyaltyTransaction[]
  isLoadingTransactions: boolean
  rewards: LoyaltyReward[]
  isLoadingRewards: boolean
  analytics: AnalyticsData | null
  isLoadingAnalytics: boolean
  anomalies: Anomaly[]
  isLoadingAnomalies: boolean
  notifications: LoyaltyNotification[]
  isLoadingNotifications: boolean

  reset: () => void
  loadPrograms: () => Promise<void>
  getProgram: (programId: string) => ProgramFull | undefined
  createProgram: (data: {
    name: string; type: 'visits'; brandColor: string; programName: string
    description: string; welcomeMessage?: string
    saldoLabel?: string | null; businessInfo?: LoyaltyProgram['businessInfo']
    config: Omit<LoyaltyVisitsConfig, 'programId'>
  }) => Promise<LoyaltyProgram>
  updateProgram: (
    programId: string,
    data: Partial<LoyaltyProgram>,
    config?: (Partial<LoyaltyPointsConfig> | Partial<LoyaltyVisitsConfig>) & { applyToExistingCustomers?: boolean },
  ) => Promise<void>
  updateProgramBanner: (programId: string, file: File) => Promise<void>
  toggleProgram: (programId: string, isActive: boolean) => Promise<void>

  loadCustomers: (programId: string) => Promise<void>
  adjustPoints: (programId: string, customerId: string, delta: number, note: string, adjustedBy: string) => Promise<void>
  updateCustomer: (programId: string, customerId: string, data: {
    name?: string; phone?: string; email?: string | null
    gender?: string | null; birthdayDate?: string | null
    customFieldValues?: Record<string, string> | null
  }) => Promise<void>
  deleteCustomer: (programId: string, customerId: string) => Promise<void>

  loadTransactions: (programId: string) => Promise<void>

  loadRewards: (programId: string) => Promise<void>
  createReward: (programId: string, body: Partial<LoyaltyReward> & { applyToExistingCustomers?: boolean }) => Promise<void>
  updateReward: (programId: string, rewardId: string, body: Partial<LoyaltyReward> & { applyToExistingCustomers?: boolean }) => Promise<void>
  deleteReward: (programId: string, rewardId: string, applyToExistingCustomers?: boolean) => Promise<void>

  loadAnalytics: (programId: string, startDate: string, endDate: string) => Promise<void>
  loadAnomalies: (programId: string) => Promise<void>

  loadNotifications: (programId: string) => Promise<void>
  previewAudience: (programId: string, targetSegment?: AudienceFilter['segment'], targetFilters?: AudienceFilter) => Promise<number>
  sendNotification: (programId: string, body: {
    title: string; message: string; channels: NotificationChannel[]
    targetSegment?: AudienceFilter['segment']; targetFilters?: AudienceFilter
  }) => Promise<LoyaltyNotification>
}

export const useProgramsStore = create<ProgramsState>((set, get) => ({
  programs: [],
  isLoading: false,
  requestGeneration: 0,
  customers: [],
  isLoadingCustomers: false,
  transactions: [],
  isLoadingTransactions: false,
  rewards: [],
  isLoadingRewards: false,
  analytics: null,
  isLoadingAnalytics: false,
  anomalies: [],
  isLoadingAnomalies: false,
  notifications: [],
  isLoadingNotifications: false,

  reset: () => set({
    requestGeneration: get().requestGeneration + 1,
    programs: [],
    isLoading: false,
    customers: [],
    isLoadingCustomers: false,
    transactions: [],
    isLoadingTransactions: false,
    rewards: [],
    isLoadingRewards: false,
    analytics: null,
    isLoadingAnalytics: false,
    anomalies: [],
    isLoadingAnomalies: false,
    notifications: [],
    isLoadingNotifications: false,
  }),

  loadPrograms: async () => {
    const requestGeneration = get().requestGeneration
    set({ isLoading: true })
    try {
      const programs = await api.get<LoyaltyProgram[]>('/api/v1/loyalty/programs')
      const enriched: ProgramFull[] = await Promise.all(
        (programs ?? []).map(async (p) => {
          try {
            const detail = await api.get<LoyaltyProgram & { pointsConfig?: LoyaltyPointsConfig; visitsConfig?: LoyaltyVisitsConfig }>(`/api/v1/loyalty/programs/${p.id}`)
            return { program: p, config: detail.pointsConfig ?? detail.visitsConfig ?? null }
          } catch {
            return { program: p, config: null }
          }
        })
      )
      if (get().requestGeneration !== requestGeneration) return
      set({ programs: enriched, isLoading: false })
    } catch {
      if (get().requestGeneration !== requestGeneration) return
      set({ programs: [], isLoading: false })
    }
  },

  getProgram: (programId) => get().programs.find(p => p.program.id === programId),

  createProgram: async (data) => {
    const requestGeneration = get().requestGeneration
    const { config, ...programData } = data
    const program = await api.post<LoyaltyProgram>('/api/v1/loyalty/programs', { ...programData, config })
    const savedConfig: LoyaltyVisitsConfig = { ...config, programId: program.id }
    if (get().requestGeneration !== requestGeneration) return program
    set(s => ({ programs: [{ program, config: savedConfig }, ...s.programs] }))
    return program
  },

  updateProgram: async (programId, data, config) => {
    const requestGeneration = get().requestGeneration
    const currentProgram = get().getProgram(programId)
    const savedProgram = await api.put<LoyaltyProgram>(`/api/v1/loyalty/programs/${programId}`, data)
    let savedConfig: LoyaltyPointsConfig | LoyaltyVisitsConfig | undefined
    if (config) {
      const type = currentProgram?.program.type ?? 'visits'
      if (type === 'points') savedConfig = await api.put<LoyaltyPointsConfig>(`/api/v1/loyalty/programs/${programId}/config/points`, config)
      else savedConfig = await api.put<LoyaltyVisitsConfig>(`/api/v1/loyalty/programs/${programId}/config/visits`, config)
    }
    if (get().requestGeneration !== requestGeneration) return
    set(s => ({
      programs: s.programs.map(p => p.program.id === programId
        ? { ...p, program: savedProgram, config: savedConfig ?? p.config }
        : p),
    }))
  },

  updateProgramBanner: async (programId, file) => {
    const requestGeneration = get().requestGeneration
    const body = new FormData()
    body.append('file', file)
    const updated = await api.uploadFile<LoyaltyProgram>(`/api/v1/loyalty/programs/${programId}/banner`, body)
    if (get().requestGeneration !== requestGeneration) return
    set(s => ({
      programs: s.programs.map(p => p.program.id === programId ? { ...p, program: updated } : p),
    }))
  },

  toggleProgram: async (programId, isActive) => {
    const requestGeneration = get().requestGeneration
    if (isActive) await api.put(`/api/v1/loyalty/programs/${programId}`, { isActive: true })
    else await api.delete(`/api/v1/loyalty/programs/${programId}`)
    if (get().requestGeneration !== requestGeneration) return
    set(s => ({ programs: s.programs.map(p => p.program.id === programId ? { ...p, program: { ...p.program, isActive } } : p) }))
  },

  loadCustomers: async (programId) => {
    const requestGeneration = get().requestGeneration
    set({ isLoadingCustomers: true })
    try {
      const customers = await api.get<LoyaltyCustomer[]>(`/api/v1/loyalty/programs/${programId}/customers?limit=100&sortBy=lastActivityAt&sortDir=desc`)
      if (get().requestGeneration !== requestGeneration) return
      set({ customers: customers ?? [], isLoadingCustomers: false })
    } catch {
      if (get().requestGeneration !== requestGeneration) return
      set({ customers: [], isLoadingCustomers: false })
    }
  },

  adjustPoints: async (programId, customerId, delta, note, adjustedBy) => {
    const requestGeneration = get().requestGeneration
    await api.post(`/api/v1/loyalty/programs/${programId}/customers/${customerId}/adjust-points`, { delta, note, adjustedBy })
    if (get().requestGeneration !== requestGeneration) return
    set(s => ({
      customers: s.customers.map(c => c.id === customerId
        ? { ...c, pointsBalance: c.pointsBalance + delta, totalEarnedPoints: delta > 0 ? c.totalEarnedPoints + delta : c.totalEarnedPoints }
        : c),
    }))
  },

  updateCustomer: async (programId, customerId, data) => {
    const requestGeneration = get().requestGeneration
    const updated = await api.put<LoyaltyCustomer>(`/api/v1/loyalty/programs/${programId}/customers/${customerId}`, data)
    if (get().requestGeneration !== requestGeneration) return
    set(s => ({ customers: s.customers.map(c => c.id === customerId ? updated : c) }))
  },

  deleteCustomer: async (programId, customerId) => {
    const requestGeneration = get().requestGeneration
    await api.delete(`/api/v1/loyalty/programs/${programId}/customers/${customerId}`)
    if (get().requestGeneration !== requestGeneration) return
    set(s => ({ customers: s.customers.filter(c => c.id !== customerId) }))
  },

  loadTransactions: async (programId) => {
    const requestGeneration = get().requestGeneration
    set({ isLoadingTransactions: true })
    try {
      const txs = await api.get<LoyaltyTransaction[]>(`/api/v1/loyalty/programs/${programId}/transactions?limit=100`)
      if (get().requestGeneration !== requestGeneration) return
      set({ transactions: txs ?? [], isLoadingTransactions: false })
    } catch {
      if (get().requestGeneration !== requestGeneration) return
      set({ transactions: [], isLoadingTransactions: false })
    }
  },

  loadRewards: async (programId) => {
    const requestGeneration = get().requestGeneration
    set({ isLoadingRewards: true })
    try {
      const rewards = await api.get<LoyaltyReward[]>(`/api/v1/loyalty/programs/${programId}/rewards`)
      if (get().requestGeneration !== requestGeneration) return
      set({ rewards: rewards ?? [], isLoadingRewards: false })
    } catch {
      if (get().requestGeneration !== requestGeneration) return
      set({ rewards: [], isLoadingRewards: false })
    }
  },

  createReward: async (programId, body) => {
    const requestGeneration = get().requestGeneration
    await api.post(`/api/v1/loyalty/programs/${programId}/rewards`, body)
    if (get().requestGeneration !== requestGeneration) return
    await get().loadRewards(programId)
  },

  updateReward: async (programId, rewardId, body) => {
    const requestGeneration = get().requestGeneration
    await api.put(`/api/v1/loyalty/programs/${programId}/rewards/${rewardId}`, body)
    if (get().requestGeneration !== requestGeneration) return
    await get().loadRewards(programId)
  },

  deleteReward: async (programId, rewardId, applyToExistingCustomers) => {
    const requestGeneration = get().requestGeneration
    await api.delete(`/api/v1/loyalty/programs/${programId}/rewards/${rewardId}`, { applyToExistingCustomers })
    if (get().requestGeneration !== requestGeneration) return
    set(s => ({ rewards: s.rewards.filter(r => r.id !== rewardId) }))
  },

  loadAnalytics: async (programId, startDate, endDate) => {
    const requestGeneration = get().requestGeneration
    set({ isLoadingAnalytics: true })
    try {
      const analytics = await api.get<AnalyticsData>(`/api/v1/loyalty/programs/${programId}/analytics?startDate=${startDate}&endDate=${endDate}`)
      if (get().requestGeneration !== requestGeneration) return
      set({ analytics, isLoadingAnalytics: false })
    } catch {
      if (get().requestGeneration !== requestGeneration) return
      set({ analytics: null, isLoadingAnalytics: false })
    }
  },

  loadAnomalies: async (programId) => {
    const requestGeneration = get().requestGeneration
    set({ isLoadingAnomalies: true })
    try {
      const anomalies = await api.get<Anomaly[]>(`/api/v1/loyalty/programs/${programId}/analytics/anomalies`)
      if (get().requestGeneration !== requestGeneration) return
      set({ anomalies: anomalies ?? [], isLoadingAnomalies: false })
    } catch {
      if (get().requestGeneration !== requestGeneration) return
      set({ anomalies: [], isLoadingAnomalies: false })
    }
  },

  loadNotifications: async (programId) => {
    const requestGeneration = get().requestGeneration
    set({ isLoadingNotifications: true })
    try {
      const notifications = await api.get<LoyaltyNotification[]>(`/api/v1/loyalty/programs/${programId}/notifications?limit=50`)
      if (get().requestGeneration !== requestGeneration) return
      set({ notifications: notifications ?? [], isLoadingNotifications: false })
    } catch {
      if (get().requestGeneration !== requestGeneration) return
      set({ notifications: [], isLoadingNotifications: false })
    }
  },

  previewAudience: async (programId, targetSegment, targetFilters) => {
    const res = await api.post<{ count: number }>(`/api/v1/loyalty/programs/${programId}/notifications/preview`, { targetSegment, targetFilters })
    return res.count
  },

  sendNotification: async (programId, body) => {
    const requestGeneration = get().requestGeneration
    const notification = await api.post<LoyaltyNotification>(`/api/v1/loyalty/programs/${programId}/notifications`, body)
    if (get().requestGeneration !== requestGeneration) return notification
    set(s => ({ notifications: [notification, ...s.notifications] }))
    return notification
  },
}))
