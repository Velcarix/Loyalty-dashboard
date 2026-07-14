import { create } from 'zustand'
import { api } from '@/lib/api'
import type {
  LoyaltyProgram, LoyaltyPointsConfig, LoyaltyVisitsConfig, LoyaltyReward,
  LoyaltyCustomer, LoyaltyTransaction, AnalyticsData, Anomaly,
} from '@/types/loyalty'

export interface ProgramFull {
  program: LoyaltyProgram
  config: LoyaltyPointsConfig | LoyaltyVisitsConfig | null
}

interface ProgramsState {
  programs: ProgramFull[]
  isLoading: boolean

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

  loadPrograms: () => Promise<void>
  getProgram: (programId: string) => ProgramFull | undefined
  createProgram: (data: {
    name: string; type: 'points' | 'visits'; brandColor: string; programName: string
    description: string; welcomeMessage?: string
    saldoLabel?: string | null; businessInfo?: LoyaltyProgram['businessInfo']
    config: Partial<LoyaltyPointsConfig> | Partial<LoyaltyVisitsConfig>
  }) => Promise<LoyaltyProgram>
  updateProgram: (programId: string, data: Partial<LoyaltyProgram>, config?: Partial<LoyaltyPointsConfig> | Partial<LoyaltyVisitsConfig>) => Promise<void>
  toggleProgram: (programId: string, isActive: boolean) => Promise<void>

  loadCustomers: (programId: string) => Promise<void>
  adjustPoints: (programId: string, customerId: string, delta: number, note: string, adjustedBy: string) => Promise<void>

  loadTransactions: (programId: string) => Promise<void>

  loadRewards: (programId: string) => Promise<void>
  createReward: (programId: string, body: Partial<LoyaltyReward>) => Promise<void>
  updateReward: (programId: string, rewardId: string, body: Partial<LoyaltyReward>) => Promise<void>
  deleteReward: (programId: string, rewardId: string) => Promise<void>

  loadAnalytics: (programId: string, startDate: string, endDate: string) => Promise<void>
  loadAnomalies: (programId: string) => Promise<void>
}

export const useProgramsStore = create<ProgramsState>((set, get) => ({
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

  loadPrograms: async () => {
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
      set({ programs: enriched, isLoading: false })
    } catch {
      set({ programs: [], isLoading: false })
    }
  },

  getProgram: (programId) => get().programs.find(p => p.program.id === programId),

  createProgram: async (data) => {
    const { config, ...programData } = data
    const program = await api.post<LoyaltyProgram>('/api/v1/loyalty/programs', programData)
    if (program.type === 'points') {
      await api.put(`/api/v1/loyalty/programs/${program.id}/config/points`, config)
    } else {
      await api.put(`/api/v1/loyalty/programs/${program.id}/config/visits`, config)
    }
    set(s => ({ programs: [{ program, config: config as any }, ...s.programs] }))
    return program
  },

  updateProgram: async (programId, data, config) => {
    await api.put(`/api/v1/loyalty/programs/${programId}`, data)
    if (config) {
      const existing = get().getProgram(programId)
      const type = existing?.program.type ?? 'points'
      if (type === 'points') await api.put(`/api/v1/loyalty/programs/${programId}/config/points`, config)
      else await api.put(`/api/v1/loyalty/programs/${programId}/config/visits`, config)
    }
    set(s => ({
      programs: s.programs.map(p => p.program.id === programId
        ? { ...p, program: { ...p.program, ...data }, config: config ? (config as any) : p.config }
        : p),
    }))
  },

  toggleProgram: async (programId, isActive) => {
    if (isActive) await api.put(`/api/v1/loyalty/programs/${programId}`, { isActive: true })
    else await api.delete(`/api/v1/loyalty/programs/${programId}`)
    set(s => ({ programs: s.programs.map(p => p.program.id === programId ? { ...p, program: { ...p.program, isActive } } : p) }))
  },

  loadCustomers: async (programId) => {
    set({ isLoadingCustomers: true })
    try {
      const customers = await api.get<LoyaltyCustomer[]>(`/api/v1/loyalty/programs/${programId}/customers?limit=100&sortBy=lastActivityAt&sortDir=desc`)
      set({ customers: customers ?? [], isLoadingCustomers: false })
    } catch {
      set({ customers: [], isLoadingCustomers: false })
    }
  },

  adjustPoints: async (programId, customerId, delta, note, adjustedBy) => {
    await api.post(`/api/v1/loyalty/programs/${programId}/customers/${customerId}/adjust-points`, { delta, note, adjustedBy })
    set(s => ({
      customers: s.customers.map(c => c.id === customerId
        ? { ...c, pointsBalance: c.pointsBalance + delta, totalEarnedPoints: delta > 0 ? c.totalEarnedPoints + delta : c.totalEarnedPoints }
        : c),
    }))
  },

  loadTransactions: async (programId) => {
    set({ isLoadingTransactions: true })
    try {
      const txs = await api.get<LoyaltyTransaction[]>(`/api/v1/loyalty/programs/${programId}/transactions?limit=100`)
      set({ transactions: txs ?? [], isLoadingTransactions: false })
    } catch {
      set({ transactions: [], isLoadingTransactions: false })
    }
  },

  loadRewards: async (programId) => {
    set({ isLoadingRewards: true })
    try {
      const rewards = await api.get<LoyaltyReward[]>(`/api/v1/loyalty/programs/${programId}/rewards`)
      set({ rewards: rewards ?? [], isLoadingRewards: false })
    } catch {
      set({ rewards: [], isLoadingRewards: false })
    }
  },

  createReward: async (programId, body) => {
    await api.post(`/api/v1/loyalty/programs/${programId}/rewards`, body)
    await get().loadRewards(programId)
  },

  updateReward: async (programId, rewardId, body) => {
    await api.put(`/api/v1/loyalty/programs/${programId}/rewards/${rewardId}`, body)
    await get().loadRewards(programId)
  },

  deleteReward: async (programId, rewardId) => {
    await api.delete(`/api/v1/loyalty/programs/${programId}/rewards/${rewardId}`)
    set(s => ({ rewards: s.rewards.filter(r => r.id !== rewardId) }))
  },

  loadAnalytics: async (programId, startDate, endDate) => {
    set({ isLoadingAnalytics: true })
    try {
      const analytics = await api.get<AnalyticsData>(`/api/v1/loyalty/programs/${programId}/analytics?startDate=${startDate}&endDate=${endDate}`)
      set({ analytics, isLoadingAnalytics: false })
    } catch {
      set({ analytics: null, isLoadingAnalytics: false })
    }
  },

  loadAnomalies: async (programId) => {
    set({ isLoadingAnomalies: true })
    try {
      const anomalies = await api.get<Anomaly[]>(`/api/v1/loyalty/programs/${programId}/analytics/anomalies`)
      set({ anomalies: anomalies ?? [], isLoadingAnomalies: false })
    } catch {
      set({ anomalies: [], isLoadingAnomalies: false })
    }
  },
}))
