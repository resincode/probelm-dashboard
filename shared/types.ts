export interface AdminUser { username: string; mustChangePassword: boolean }
export interface AuthState { user: AdminUser | null; csrfToken: string | null }
export interface CanonicalModel { id: number; canonicalName: string; displayName: string; iconKey?: string | null }
export interface ProviderMapping { id: number; providerId: number; modelId: number; canonicalName: string; displayName: string; providerModelId: string; modelRevision: string | null; enabled: boolean; iconKey?: string | null }
export interface AdminProvider { id: number; name: string; slug: string; baseUrl: string; enabled: boolean; keyConfigured: boolean; iconUrl?: string | null; createdAt: number; updatedAt: number }
export interface CatalogModel { id: string; name: string; contextWindow: number | null }
export interface ProviderInput { name: string; slug?: string; baseUrl: string; apiKey?: string; enabled?: boolean; iconUrl?: string | null }
export interface MappingInput { canonicalName: string; displayName?: string; providerModelId: string; modelRevision?: string | null; enabled?: boolean; iconKey?: string | null }
export type DateFormat = 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY'
export interface MonitoringSettings { enabled: boolean; intervalMinutes: number; prompt: string; maxTokens: number; temperature: number; timeoutSeconds: number; concurrency: number; slowThresholdMs: number; dateFormat?: DateFormat }
export interface WorkerStatus { online: boolean; heartbeatAt: number | null; nextRunAt: number | null; activeRunId: number | null; lastRunAt: number | null; lastRunDurationMs?: number | null; lastRunStatus?: string | null }
export interface MonitoringState { settings: MonitoringSettings; worker: WorkerStatus }
export type MonitorStatus = 'up' | 'slow' | 'down' | 'stale' | 'no-data' | 'configuration-error'
export interface PublicProvider { id: number; name: string; slug: string; enabled: boolean; iconUrl?: string | null }
export interface PublicMonitor { id: string; modelId: number; canonicalName: string; displayName: string; providerId: number; providerName: string; providerSlug: string; providerModelId: string; modelRevision: string | null; enabled: boolean; status: MonitorStatus; lastProbeAt: number | null; ttftMs: number | null; totalMs: number | null; ratePerSec: number | null }
export interface PublicOverview { generatedAt: number; providers: PublicProvider[]; models: CanonicalModel[]; monitors: PublicMonitor[]; worker: WorkerStatus; intervalMinutes: number; slowThresholdMs: number; dateFormat?: DateFormat }
export interface HistoryPoint { ts: number; runId: number; status: MonitorStatus; ttftMs: number | null; totalMs: number | null; tokens: number | null; ratePerSec: number | null; httpCode: number | null; error: string | null; profileVersion: string; modelRevision: string | null; intervalMinutes: number | null }
export interface HistoryBucket { start: number; end: number; status: MonitorStatus; samples: number; failures: number; missing: number; avgTtftMs: number | null }
export interface HistorySummary { samples: number; successes: number; failures: number; missing: number; successRate: number | null; p50TtftMs: number | null; p95TtftMs: number | null; avgTotalMs: number | null; avgRatePerSec: number | null }
export interface ProviderHistory { provider: PublicProvider; providerModelId: string; modelRevision: string | null; status: MonitorStatus; points: HistoryPoint[]; buckets: HistoryBucket[]; summary: HistorySummary }
export interface ModelHistory { model: CanonicalModel; from: number; to: number; bucketMs: number; profiles: Array<{ id: string; label: string }>; selectedProfile: string | null; series: ProviderHistory[]; measurements: { ttft: string; throughput: string; tokens: string }; truncated: boolean }
