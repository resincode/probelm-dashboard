import type { DateFormat } from '../../shared/types'

export type Locale = 'en' | 'id'

export interface TranslationDictionary {
  [key: string]: string
}

const en: TranslationDictionary = {
  // Common
  'common.brand': 'probelm',
  'common.tagline': 'Model observability',
  'common.workerOnline': 'Worker online',
  'common.workerOffline': 'Worker offline',
  'common.compare': 'Compare gateways',
  'common.refresh': 'Refresh observations',
  'common.administration': 'Administration',
  'common.providers': 'Providers',
  'common.modelMappings': 'Model mappings',
  'common.settings': 'Settings',
  'common.signOut': 'Sign out',
  'common.signIn': 'Sign in',
  'common.language': 'Language',
  'common.english': 'English',
  'common.indonesian': 'Indonesia',
  'common.save': 'Save',
  'common.saving': 'Saving…',
  'common.cancel': 'Cancel',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.enabled': 'Enabled',
  'common.disabled': 'Disabled',
  'common.retry': 'Retry',
  'common.never': 'Never',
  'common.notAvailable': 'Not available',
  'common.notScheduled': 'Not scheduled',
  'common.idle': 'Idle',
  'common.running': 'Running #{n}',
  'common.switchToLight': 'Switch to light mode',
  'common.switchToDark': 'Switch to dark mode',
  // Time & Relative
  'time.justNow': 'just now',
  'time.secondsAgo': '{n} seconds ago',
  'time.minuteAgo': '1 minute ago',
  'time.minutesAgo': '{n} minutes ago',
  'time.hourAgo': '1 hour ago',
  'time.hoursAgo': '{n} hours ago',
  'time.dayAgo': '1 day ago',
  'time.daysAgo': '{n} days ago',
  'time.monthAgo': '1 month ago',
  'time.monthsAgo': '{n} months ago',
  'time.inFewSeconds': 'in a few seconds',
  'time.inMinute': 'in 1 minute',
  'time.inMinutes': 'in {n} minutes',
  'time.inHour': 'in 1 hour',
  'time.inHours': 'in {n} hours',
  'time.inDay': 'in 1 day',
  'time.inDays': 'in {n} days',

  // Statuses
  'status.all': 'All statuses',
  'status.up': 'up',
  'status.slow': 'slow',
  'status.down': 'down',
  'status.stale': 'stale',
  'status.noData': 'no-data',
  'status.configError': 'configuration-error',

  // Public Workspace / Dashboard
  'workspace.models': 'Models',
  'workspace.searchPlaceholder': 'Find a canonical model…',
  'workspace.searchAria': 'Search models',
  'workspace.statusLabel': 'Status',
  'workspace.providerLabel': 'Provider',
  'workspace.sortLabel': 'Sort by',
  'workspace.sortNameAsc': 'Name (A → Z)',
  'workspace.sortNameDesc': 'Name (Z → A)',
  'workspace.sortTtftAsc': 'TTFT (Fastest first)',
  'workspace.sortTtftDesc': 'TTFT (Slowest first)',
  'workspace.sortRateDesc': 'Throughput (Highest first)',
  'workspace.sortRateAsc': 'Throughput (Lowest first)',
  'workspace.multiProviderSummary': '{n} multi-provider',
  'workspace.includeInactive': 'Include inactive',
  'workspace.inactiveSuffix': ' (inactive)',
  'workspace.inactiveBadge': 'Inactive',
  'workspace.providerRecap': 'Models per provider',
  'workspace.workerModalTitle': 'Worker status & schedule',
  'workspace.scheduleInterval': 'Runs every {n} minutes',
  'workspace.allProviders': 'All providers',
  'workspace.sidebarFooterScheduled': 'Scheduled observations, not an SLA.',
  'workspace.activeRun': 'Active run',
  'workspace.listView': 'List view',
  'workspace.cardView': 'Card view',
  'workspace.closeSelector': 'Close model selector',
  'workspace.openSelector': 'Open model selector',
  'workspace.loadingModels': 'Loading models…',
  'workspace.noModelsMatch': 'No models match these filters.',
  'workspace.noModelsConfigured': 'No models configured yet.',
  'workspace.noMappedProviders': 'No mapped providers',
  'workspace.resizeAria': 'Resize model panel with left and right arrow keys',
  'workspace.showingLastReceived': 'Showing the last received overview.',
  'workspace.selectModelPrompt': 'Select a model once monitoring is configured.',
  'workspace.adminSignIn': 'Administrator sign in',
  'workspace.canonicalModel': 'CANONICAL MODEL',
  'workspace.gatewayComparison': 'GATEWAY COMPARISON',
  'workspace.historyPermalink': 'History permalink',
  'workspace.copyLink': 'Copy model link to clipboard',
  'workspace.copied': 'Link copied!',
  'workspace.last6h': 'Last 6 hours',
  'workspace.last12h': 'Last 12 hours',
  'workspace.last24h': 'Last 24 hours',
  'workspace.last7d': 'Last 7 days',
  'workspace.customRange': 'Custom range',
  'workspace.measurementProfile': 'Measurement profile',
  'workspace.latestCohort': 'Latest available cohort',
  'workspace.fromLocal': 'From (local time)',
  'workspace.toLocal': 'To (local time)',
  'workspace.applyRange': 'Apply range',
  'workspace.ttft': 'TTFT',
  'workspace.ttftHelp': 'Time to first token',
  'workspace.totalLatency': 'Total latency',
  'workspace.totalLatencyHelp': 'Time until response ends',
  'workspace.throughput': 'Throughput',
  'workspace.throughputHelp': 'Tokens per second',
  'workspace.samplesInfo': '{n} samples · gaps are not interpolated',
  'workspace.noProvidersInProfile': 'No providers in this profile',
  'workspace.observedSuccess': 'Observed success',
  'workspace.ttftPercentiles': 'TTFT p50 / p95',
  'workspace.meanTotal': 'Mean total',
  'workspace.meanThroughput': 'Mean throughput',
  'workspace.failedMissing': 'Failed / missing',
  'workspace.loadingHistory': 'Loading selected model history…',
  'workspace.useLatestProfile': 'Use latest profile',
  'workspace.noObservationsRange': 'No observations in this range and profile.',
  'workspace.selectProviderOverlay': 'Select at least one provider overlay.',
  'workspace.noMeasurementsYet': 'No measurements for this model and profile yet.',
  'workspace.limitNotice': 'This response reached the 100,000-sample limit. Narrow the range; displayed statistics may cover only returned observations.',
  'workspace.revision': 'Revision',
  'workspace.unspecified': 'unspecified',
  'workspace.measurementNotesSummary': 'Measurement limitations & comparability',
  'workspace.measurementNotesModalTitle': 'Measurement limitations & comparability',
  'workspace.measurementNotesDisclaimer': 'Only the selected profile and revision cohort is shown. Different prompts, token limits, revisions, and gateway environments are not interchangeable. Sampled success is not continuous uptime; missing observations are not successful probes.',
  'workspace.sampleTableSummary': 'Observation table · {n} observations',
  'workspace.sampleTableNote': 'Observations recorded during scheduled probe runs. Select a row for detailed response metrics.',
  'workspace.colTime': 'Time',
  'workspace.colProvider': 'Provider',
  'workspace.colStatus': 'Status',
  'workspace.colTtft': 'TTFT',
  'workspace.colTotal': 'Total',
  'workspace.colThroughput': 'Throughput',
  'workspace.zoomNote': 'Compact viewport: scroll this workspace to reach all controls, or reduce browser zoom.',
  'workspace.closeSampleDetails': 'Close sample details',
  'workspace.sampleSummary': '{status} · {samples} samples · {failures} failures · {missing} missing observations',
  'workspace.noObservationRecorded': 'No observation was recorded in this interval. Missing data is not a successful probe.',
  'workspace.httpStatus': 'HTTP status',
  'workspace.tokensObserved': 'Tokens observed',
  'workspace.runId': 'Run ID',
  'workspace.previousSamples': '← Newer samples',
  'workspace.nextSamples': 'Older samples →',
  'workspace.showingSamplesRange': 'Showing {from}–{to} of {total}',

  // Login
  'login.title': 'Administrator sign in',
  'login.subtitle': 'Manage providers, model mappings, and monitoring schedule.',
  'login.username': 'Username',
  'login.password': 'Password',
  'login.publicDashboard': '← Public dashboard',
  'login.submit': 'Sign in',
  'login.submitting': 'Signing in…',
  'login.sessionUnavailable': 'Session unavailable. Try signing in again.',
  'login.failed': 'Sign in failed',

  // Admin Shell
  'admin.shellAria': 'Administration',
  'admin.mustChangePasswordNotice': 'Please set a new password before administering this installation.',
  'admin.signOutError': 'Could not sign out',

  // Admin Providers
  'providers.title': 'Providers',
  'providers.subtitle': 'Private endpoints and encrypted credentials',
  'providers.add': 'Add provider',
  'providers.formIconUrl': 'Icon / Logo URL (optional)',
  'providers.formIconUrlPlaceholder': 'https://example.com/logo.png',
  'providers.empty': 'No providers configured. Add an OpenAI-compatible endpoint below.',
  'providers.testConnection': 'Test connection',
  'providers.catalogAndMappings': 'Catalog & mappings',
  'providers.encryptedKeyConfigured': 'Encrypted key configured',
  'providers.noKeyConfigured': 'No key configured',
  'providers.formName': 'Name',
  'providers.formSlug': 'Slug',
  'providers.formSlugPlaceholder': 'e.g. gateway-east',
  'providers.formBaseUrl': 'API base URL',
  'providers.formBaseUrlPlaceholder': 'https://gateway.example/v1 or http://localhost:20128',
  'providers.formApiKey': 'API key',
  'providers.formApiKeyLeaveBlank': '(leave blank to retain existing key)',
  'providers.formEnabled': 'Provider enabled',
  'providers.saveProvider': 'Save provider',
  'providers.cancelEditing': 'Cancel editing',
  'providers.savedNotice': 'Provider saved. Configure and confirm model mappings before monitoring.',
  'providers.testSuccess': '{name}: connection successful; {count} catalog models. No completion probe was run.',
  'providers.testFailed': '{name}: connection check failed.',

  // Admin Models
  'models.title': 'Canonical model mappings',
  'models.subtitle': 'Compare gateways only when they serve the same canonical model. Confirm the exact model and revision yourself.',
  'models.exactRevision': 'Exact model revision',
  'models.exactRevisionPlaceholder': 'Unknown (comparability is limited)',
  'models.brandLogo': 'Brand / Logo icon',
  'models.logoAuto': 'Auto-detect',
  'models.loadCatalog': 'Load catalog',
  'models.syncCatalog': 'Sync catalog',
  'models.catalogSummary': 'Provider catalog · {n} models',
  'models.searchCatalog': 'Search catalog',
  'models.contextTokens': ' · {n} context',
  'models.chooseMapping': 'Choose mapping',
  'models.added': 'Added',
  'models.noCatalogEntries': 'No catalog entries. Load/sync the catalog or add a mapping manually.',
  'models.desiredMappings': 'Desired mappings · {n}',
  'models.addManualMapping': 'Add manual mapping',
  'models.providerModelId': 'Provider model ID',
  'models.canonicalModelName': 'Canonical model name',
  'models.mappingEnabled': 'Mapping enabled',
  'models.removeFromDesired': 'Remove from desired set',
  'models.noMappingsNotice': 'No mappings. Saving an empty set disables all previous mappings for this provider; history remains available.',
  'models.saveNotice': 'Save sends all {n} mappings, including disabled rows. Changing canonical identity or revision changes how results can be compared.',
  'models.confirmationCheckbox': 'I verified canonical identities, revisions, and the entire desired mapping set.',
  'models.unsavedChanges': 'Unsaved changes',
  'models.discardPrompt': 'Discard unsaved model mapping changes?',
  'models.removePrompt': 'Remove this mapping from the desired set? Previous history is retained. You can disable it instead to keep it in this list.',
  'models.catalogLoadedNotice': '{n} catalog models loaded. Nothing has been mapped automatically.',
  'models.savedNotice': 'Complete mapping set saved. Disabled and removed mappings retain their historical samples.',
  'models.noProvidersPrompt': 'Add a provider before mapping models.',

  // Admin Settings
  'settings.title': 'Settings',
  'settings.externalWorker': 'External worker',
  'settings.heartbeatHealthy': 'Heartbeat healthy',
  'settings.workerOfflineStale': 'Worker offline / heartbeat stale',
  'settings.lastHeartbeat': 'Last heartbeat',
  'settings.lastRun': 'Last run',
  'settings.nextRun': 'Next run',
  'settings.monitoringScheduleTitle': 'Monitoring schedule & measurement profile',
  'settings.monitoringEnabled': 'Monitoring enabled',
  'settings.monitoringDescription': 'Probes run only in the external worker through mtest/probelm. Saving does not launch a manual probe. Prompt, limits, and temperature affect comparability; historical profiles remain separate.',
  'settings.intervalMinutes': 'Interval (minutes)',
  'settings.dateFormatLabel': 'Date format',
  'settings.requestTimeoutSeconds': 'Request timeout (seconds)',
  'settings.maxOutputTokens': 'Maximum output tokens',
  'settings.temperature': 'Temperature',
  'settings.concurrency': 'Concurrency',
  'settings.slowTtftThreshold': 'Slow TTFT threshold (ms)',
  'settings.probePrompt': 'Probe prompt',
  'settings.saveMonitoringSettings': 'Save monitoring settings',
  'settings.loadingSettings': 'Loading monitoring settings…',
  'settings.retryLoading': 'Retry loading settings',
  'settings.changePasswordTitle': 'Change administrator password',
  'settings.requiredResetTitle': 'Set new administrator password',
  'settings.passwordGuidance': 'Use a unique password of at least 12 characters. Never reuse a provider API key.',
  'settings.currentPassword': 'Current password',
  'settings.newPassword': 'New password',
  'settings.confirmNewPassword': 'Confirm new password',
  'settings.changePasswordBtn': 'Change password',
  'settings.passwordsDoNotMatch': 'New passwords do not match.',
  'settings.passwordChanged': 'Password changed.',
  'settings.settingsSaved': 'Monitoring settings saved. New runs use a distinct measurement profile when probe inputs change.'
}

const id: TranslationDictionary = {
  // Common
  'common.brand': 'probelm',
  'common.tagline': 'Observabilitas model',
  'common.workerOnline': 'Worker online',
  'common.workerOffline': 'Worker offline',
  'common.compare': 'Bandingkan gateway',
  'common.refresh': 'Perbarui observasi',
  'common.administration': 'Administrasi',
  'common.providers': 'Provider',
  'common.modelMappings': 'Pemetaan model',
  'common.settings': 'Pengaturan',
  'common.signOut': 'Keluar',
  'common.signIn': 'Masuk',
  'common.language': 'Bahasa',
  'common.english': 'English',
  'common.indonesian': 'Indonesia',
  'common.save': 'Simpan',
  'common.saving': 'Menyimpan…',
  'common.cancel': 'Batal',
  'common.edit': 'Ubah',
  'common.delete': 'Hapus',
  'common.enabled': 'Aktif',
  'common.disabled': 'Nonaktif',
  'common.retry': 'Coba lagi',
  'common.never': 'Belum pernah',
  'common.notAvailable': 'Tidak tersedia',
  'common.notScheduled': 'Tidak dijadwalkan',
  'common.idle': 'Siaga',
  'common.running': 'Sedang berjalan #{n}',
  'common.switchToLight': 'Beralih ke mode terang',
  'common.switchToDark': 'Beralih ke mode gelap',
  'time.secondsAgo': '{n} detik lalu',
  'time.minuteAgo': '1 menit lalu',
  'time.minutesAgo': '{n} menit lalu',
  'time.hourAgo': '1 jam lalu',
  'time.hoursAgo': '{n} jam lalu',
  'time.dayAgo': '1 hari lalu',
  'time.daysAgo': '{n} hari lalu',
  'time.monthAgo': '1 bulan lalu',
  'time.monthsAgo': '{n} bulan lalu',
  'time.inFewSeconds': 'beberapa detik lagi',
  'time.inMinute': 'dalam 1 menit',
  'time.inMinutes': 'dalam {n} menit',
  'time.inHour': 'dalam 1 jam',
  'time.inHours': 'dalam {n} jam',
  'time.inDay': 'dalam 1 hari',
  'time.inDays': 'dalam {n} hari',

  // Statuses
  'status.all': 'Semua status',
  'status.up': 'up',
  'status.slow': 'slow',
  'status.down': 'down',
  'status.stale': 'stale',
  'status.noData': 'no-data',
  'status.configError': 'configuration-error',

  // Public Workspace / Dashboard
  'workspace.models': 'Model',
  'workspace.searchPlaceholder': 'Cari model kanonikal…',
  'workspace.searchAria': 'Cari model',
  'workspace.statusLabel': 'Status',
  'workspace.providerLabel': 'Provider',
  'workspace.sortLabel': 'Urutkan',
  'workspace.sortNameAsc': 'Nama (A → Z)',
  'workspace.sortNameDesc': 'Nama (Z → A)',
  'workspace.sortTtftAsc': 'TTFT (Tercepat)',
  'workspace.sortTtftDesc': 'TTFT (Terlambat)',
  'workspace.sortRateDesc': 'Throughput (Tertinggi)',
  'workspace.sortRateAsc': 'Throughput (Terendah)',
  'workspace.multiProviderSummary': '{n} multi-provider',
  'workspace.includeInactive': 'Sertakan yang nonaktif',
  'workspace.inactiveSuffix': ' (nonaktif)',
  'workspace.inactiveBadge': 'Nonaktif',
  'workspace.providerRecap': 'Model per provider',
  'workspace.workerModalTitle': 'Status & jadwal worker',
  'workspace.errorLogTitle': 'Log error probe & diagnostik',
  'workspace.lastRunDuration': 'Durasi eksekusi',
  'workspace.lastRunStatus': 'Status run terakhir',
  'workspace.activeRun': 'Run aktif',
  'workspace.scheduleInterval': 'Berjalan setiap {n} menit',
  'workspace.allProviders': 'Semua provider',
  'workspace.listView': 'Tampilan daftar',
  'workspace.cardView': 'Tampilan kartu',
  'workspace.closeSelector': 'Tutup pemilih model',
  'workspace.openSelector': 'Buka pemilih model',
  'workspace.loadingModels': 'Memuat model…',
  'workspace.noModelsMatch': 'Tidak ada model yang cocok dengan filter ini.',
  'workspace.noModelsConfigured': 'Belum ada model yang dikonfigurasi.',
  'workspace.noMappedProviders': 'Belum ada provider terpetakan',
  'workspace.sidebarFooterScheduled': 'Observasi berkala, bukan SLA.',
  'workspace.sidebarFooterInterval': 'Setiap {n} menit · {date}',
  'workspace.resizeAria': 'Ubah ukuran panel model dengan tombol panah kiri dan kanan',
  'workspace.showingLastReceived': 'Menampilkan gambaran umum terakhir yang diterima.',
  'workspace.selectModelPrompt': 'Pilih model setelah pemantauan dikonfigurasi.',
  'workspace.adminSignIn': 'Masuk administrator',
  'workspace.canonicalModel': 'MODEL KANONIKAL',
  'workspace.gatewayComparison': 'PERBANDINGAN GATEWAY',
  'workspace.historyPermalink': 'Tautan permanen riwayat',
  'workspace.copyLink': 'Salin tautan model ke clipboard',
  'workspace.copied': 'Tautan disalin!',
  'workspace.last6h': '6 jam terakhir',
  'workspace.last12h': '12 jam terakhir',
  'workspace.last24h': '24 jam terakhir',
  'workspace.last7d': '7 hari terakhir',
  'workspace.customRange': 'Rentang kustom',
  'workspace.measurementProfile': 'Profil pengukuran',
  'workspace.latestCohort': 'Kohort terbaru yang tersedia',
  'workspace.fromLocal': 'Dari (waktu lokal)',
  'workspace.toLocal': 'Sampai (waktu lokal)',
  'workspace.applyRange': 'Terapkan rentang',
  'workspace.ttft': 'TTFT',
  'workspace.ttftHelp': 'Waktu sampai token pertama',
  'workspace.totalLatency': 'Latensi total',
  'workspace.totalLatencyHelp': 'Waktu sampai respons selesai',
  'workspace.throughput': 'Throughput',
  'workspace.throughputHelp': 'Token per detik',
  'workspace.samplesInfo': '{n} sampel · celah tidak diinterpolasi',
  'workspace.noProvidersInProfile': 'Tidak ada provider dalam profil ini',
  'workspace.observedSuccess': 'Keberhasilan teramati',
  'workspace.ttftPercentiles': 'TTFT p50 / p95',
  'workspace.meanTotal': 'Rata-rata total',
  'workspace.meanThroughput': 'Rata-rata throughput',
  'workspace.failedMissing': 'Gagal / terlewat',
  'workspace.loadingHistory': 'Memuat riwayat model terpilih…',
  'workspace.useLatestProfile': 'Gunakan profil terbaru',
  'workspace.noObservationsRange': 'Tidak ada observasi pada rentang dan profil ini.',
  'workspace.selectProviderOverlay': 'Pilih setidaknya satu provider.',
  'workspace.noMeasurementsYet': 'Belum ada pengukuran untuk model dan profil ini.',
  'workspace.limitNotice': 'Respons ini mencapai batas 100.000 sampel. Persempit rentang waktu; statistik yang ditampilkan mungkin hanya mencakup data yang diterima.',
  'workspace.revision': 'Revisi',
  'workspace.unspecified': 'tidak ditentukan',
  'workspace.measurementNotesSummary': 'Batasan pengukuran & komparabilitas',
  'workspace.measurementNotesModalTitle': 'Batasan pengukuran & komparabilitas',
  'workspace.measurementNotesDisclaimer': 'Hanya profil dan kohort revisi terpilih yang ditampilkan. Prompt, batasan token, revisi, dan lingkungan gateway yang berbeda tidak dapat saling disamakan. Keberhasilan sampel bukan berarti uptime berkelanjutan; data yang hilang tidak dianggap berhasil.',
  'workspace.sampleTableSummary': 'Tabel observasi · {n} observasi',
  'workspace.sampleTableNote': 'Observasi yang tercatat selama run probe terjadwal. Pilih baris untuk melihat rincian metrik respons.',
  'workspace.colTime': 'Waktu',
  'workspace.colProvider': 'Provider',
  'workspace.colStatus': 'Status',
  'workspace.colTtft': 'TTFT',
  'workspace.colTotal': 'Total',
  'workspace.colThroughput': 'Throughput',
  'workspace.zoomNote': 'Tampilan ringkas: gulir workspace ini untuk melihat semua kontrol, atau kurangi zoom browser.',
  'workspace.closeSampleDetails': 'Tutup detail sampel',
  'workspace.sampleSummary': '{status} · {samples} sampel · {failures} gagal · {missing} data terlewat',
  'workspace.noObservationRecorded': 'Tidak ada observasi yang tercatat dalam interval ini. Data yang hilang bukan pengukuran yang berhasil.',
  'workspace.httpStatus': 'Status HTTP',
  'workspace.tokensObserved': 'Token teramati',
  'workspace.runId': 'ID Run',
  'workspace.previousSamples': '← Sampel lebih baru',
  'workspace.nextSamples': 'Sampel lebih lama →',
  'workspace.showingSamplesRange': 'Menampilkan {from}–{to} dari {total}',

  // Login
  'login.title': 'Masuk administrator',
  'login.subtitle': 'Kelola provider, pemetaan model, dan jadwal pemantauan.',
  'login.username': 'Nama pengguna',
  'login.password': 'Kata sandi',
  'login.publicDashboard': '← Dashboard publik',
  'login.submit': 'Masuk',
  'login.submitting': 'Sedang masuk…',
  'login.sessionUnavailable': 'Sesi tidak tersedia. Silakan masuk kembali.',
  'login.failed': 'Gagal masuk',

  // Admin Shell
  'admin.shellAria': 'Administrasi',
  'admin.mustChangePasswordNotice': 'Silakan perbarui kata sandi Anda sebelum mengelola instalasi ini.',
  'admin.signOutError': 'Tidak dapat keluar',

  // Admin Providers
  'providers.title': 'Provider',
  'providers.subtitle': 'Endpoint privat dan kredensial terenkripsi',
  'providers.add': 'Tambah provider',
  'providers.formIconUrl': 'URL Icon / Logo (opsional)',
  'providers.formApiKey': 'Kunci API',
  'providers.empty': 'Belum ada provider yang dikonfigurasi. Tambahkan endpoint OpenAI-compatible di bawah.',
  'providers.testConnection': 'Uji koneksi',
  'providers.catalogAndMappings': 'Katalog & pemetaan',
  'providers.encryptedKeyConfigured': 'Kunci terenkripsi terkonfigurasi',
  'providers.noKeyConfigured': 'Belum ada kunci terkonfigurasi',
  'providers.formName': 'Nama',
  'providers.formSlug': 'Slug',
  'providers.formSlugPlaceholder': 'contoh: gateway-east',
  'providers.formBaseUrl': 'Base URL API',
  'providers.formBaseUrlPlaceholder': 'https://gateway.example/v1 atau http://localhost:20128',
  'providers.formApiKeyLeaveBlank': '(kosongkan untuk mempertahankan kunci yang ada)',
  'providers.formEnabled': 'Provider aktif',
  'providers.saveProvider': 'Simpan provider',
  'providers.cancelEditing': 'Batal mengubah',
  'providers.savedNotice': 'Provider berhasil disimpan. Konfigurasikan dan konfirmasi pemetaan model sebelum pemantauan.',
  'providers.testSuccess': '{name}: koneksi berhasil; {count} model katalog. Tidak ada probe penyelesaian yang dijalankan.',
  'providers.testFailed': '{name}: uji koneksi gagal.',

  // Admin Models
  'models.title': 'Pemetaan model kanonikal',
  'models.subtitle': 'Bandingkan gateway hanya jika menyajikan model kanonikal yang sama. Pastikan model dan revisi yang tepat secara mandiri.',
  'models.exactRevision': 'Revisi model persis',
  'models.exactRevisionPlaceholder': 'Tidak diketahui (komparabilitas terbatas)',
  'models.brandLogo': 'Logo / Icon brand',
  'models.logoAuto': 'Deteksi otomatis',
  'models.loadCatalog': 'Muat katalog',
  'models.syncCatalog': 'Sinkronkan katalog',
  'models.catalogSummary': 'Katalog provider · {n} model',
  'models.searchCatalog': 'Cari di katalog',
  'models.contextTokens': ' · {n} konteks',
  'models.chooseMapping': 'Pilih pemetaan',
  'models.added': 'Sudah ditambahkan',
  'models.noCatalogEntries': 'Tidak ada entri katalog. Muat/sinkronkan katalog atau tambah pemetaan secara manual.',
  'models.desiredMappings': 'Pemetaan yang diinginkan · {n}',
  'models.addManualMapping': 'Tambah pemetaan manual',
  'models.providerModelId': 'ID model provider',
  'models.canonicalModelName': 'Nama model kanonikal',
  'models.displayName': 'Nama tampilan',
  'models.displayNamePlaceholder': 'Nama yang mudah dikenali (opsional)',
  'models.mappingEnabled': 'Pemetaan aktif',
  'models.removeFromDesired': 'Hapus dari daftar pemetaan',
  'models.noMappingsNotice': 'Tidak ada pemetaan. Menyimpan daftar kosong akan menonaktifkan semua pemetaan sebelumnya untuk provider ini; riwayat data tetap tersimpan.',
  'models.saveNotice': 'Penyimpanan akan mengirim seluruh {n} pemetaan, termasuk yang nonaktif. Mengubah identitas kanonikal atau revisi akan memengaruhi perbandingan hasil.',
  'models.confirmationCheckbox': 'Saya telah memverifikasi identitas kanonikal, revisi, dan seluruh pemetaan yang diinginkan.',
  'models.confirmAndSave': 'Konfirmasi & simpan semua pemetaan',
  'models.unsavedChanges': 'Perubahan belum disimpan',
  'models.discardPrompt': 'Buang perubahan pemetaan model yang belum disimpan?',
  'models.removePrompt': 'Hapus pemetaan ini dari daftar? Riwayat sebelumnya tetap tersimpan. Anda juga dapat menonaktifkannya agar tetap ada di daftar.',
  'models.catalogLoadedNotice': '{n} model katalog dimuat. Belum ada yang dipetakan secara otomatis.',
  'models.savedNotice': 'Seluruh pemetaan berhasil disimpan. Pemetaan yang dinonaktifkan atau dihapus tetap mempertahankan riwayat sampelnya.',
  'models.noProvidersPrompt': 'Tambahkan provider terlebih dahulu sebelum memetakan model.',

  // Admin Settings
  'settings.title': 'Pengaturan',
  'settings.externalWorker': 'Worker eksternal',
  'settings.heartbeatHealthy': 'Heartbeat normal',
  'settings.workerOfflineStale': 'Worker offline / heartbeat usang',
  'settings.lastHeartbeat': 'Heartbeat terakhir',
  'settings.lastRun': 'Run terakhir',
  'settings.nextRun': 'Run berikutnya',
  'settings.monitoringScheduleTitle': 'Jadwal pemantauan & profil pengukuran',
  'settings.monitoringEnabled': 'Pemantauan aktif',
  'settings.monitoringDescription': 'Pengukuran hanya dijalankan oleh worker eksternal melalui mtest/probelm. Menyimpan pengaturan tidak langsung memicu probe manual. Prompt, batasan token, dan suhu memengaruhi komparabilitas; profil historis tetap terpisah.',
  'settings.intervalMinutes': 'Interval (menit)',
  'settings.dateFormatLabel': 'Format tanggal',
  'settings.requestTimeoutSeconds': 'Batas waktu request (detik)',
  'settings.maxOutputTokens': 'Token output maksimum',
  'settings.temperature': 'Suhu (temperature)',
  'settings.concurrency': 'Konkurensi',
  'settings.slowTtftThreshold': 'Ambang batas TTFT lambat (ms)',
  'settings.probePrompt': 'Prompt probe',
  'settings.saveMonitoringSettings': 'Simpan pengaturan pemantauan',
  'settings.loadingSettings': 'Memuat pengaturan pemantauan…',
  'settings.retryLoading': 'Coba lagi memuat pengaturan',
  'settings.changePasswordTitle': 'Ubah kata sandi administrator',
  'settings.requiredResetTitle': 'Tetapkan kata sandi administrator baru',
  'settings.passwordGuidance': 'Gunakan kata sandi unik minimal 12 karakter. Jangan pernah menggunakan kembali kunci API provider.',
  'settings.currentPassword': 'Kata sandi saat ini',
  'settings.newPassword': 'Kata sandi baru',
  'settings.confirmNewPassword': 'Konfirmasi kata sandi baru',
  'settings.changePasswordBtn': 'Ubah kata sandi',
  'settings.passwordsDoNotMatch': 'Kata sandi baru tidak cocok.',
  'settings.passwordChanged': 'Kata sandi berhasil diubah.',
  'settings.settingsSaved': 'Pengaturan pemantauan disimpan. Run baru akan menggunakan profil pengukuran terpisah jika input probe berubah.'
}

const dictionaries: Record<Locale, TranslationDictionary> = { en, id }

export function useI18n() {
  const locale = useState<Locale>('app-locale', () => {
    if (import.meta.client) {
      try {
        const stored = localStorage.getItem('probelm-locale')
        if (stored === 'en' || stored === 'id') return stored
        const nav = navigator.language?.toLowerCase() || ''
        if (nav.startsWith('id')) return 'id'
      } catch {
        // Fallback to default
      }
    }
    return 'en'
  })

  const dateFormat = useState<DateFormat>('app-date-format', () => {
    if (import.meta.client) {
      try {
        const stored = localStorage.getItem('probelm-date-format')
        if (stored === 'DD/MM/YYYY' || stored === 'YYYY-MM-DD' || stored === 'MM/DD/YYYY') return stored
      } catch {
        // Fallback to default
      }
    }
    return 'DD/MM/YYYY'
  })

  function setLocale(newLocale: Locale) {
    locale.value = newLocale
    if (import.meta.client) {
      try {
        localStorage.setItem('probelm-locale', newLocale)
        document.documentElement.lang = newLocale
      } catch {
        // Ignore storage errors
      }
    }
  }

  function setDateFormat(newFormat: DateFormat) {
    dateFormat.value = newFormat
    if (import.meta.client) {
      try {
        localStorage.setItem('probelm-date-format', newFormat)
      } catch {
        // Ignore storage errors
      }
    }
  }

  function t(key: string, params?: Record<string, string | number>): string {
    const dict = dictionaries[locale.value] || dictionaries.en
    let str = dict[key] ?? dictionaries.en[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }
    return str
  }

  function formatDate(value: number | null | undefined, customFormat?: DateFormat): string {
    if (!value) return t('common.never')
    const d = new Date(value)
    if (isNaN(d.getTime())) return t('common.never')
    const fmt = customFormat || dateFormat.value || 'DD/MM/YYYY'
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    const seconds = String(d.getSeconds()).padStart(2, '0')

    let dateStr = `${day}/${month}/${year}`
    if (fmt === 'YYYY-MM-DD') dateStr = `${year}-${month}-${day}`
    else if (fmt === 'MM/DD/YYYY') dateStr = `${month}/${day}/${year}`

    return `${dateStr}, ${hours}:${minutes}:${seconds}`
  }

  function formatNumber(value: number | null | undefined, unit = ''): string {
    if (value == null) return '—'
    const loc = locale.value === 'id' ? 'id-ID' : 'en-US'
    return `${value.toLocaleString(loc, { maximumFractionDigits: 1 })}${unit}`
  }

  function formatRelativeTime(value: number | null | undefined, fallback = ''): string {
    if (!value) return fallback || t('common.never')
    const now = Date.now()
    const diff = value - now
    const absDiff = Math.abs(diff)

    if (absDiff < 45_000) {
      return t('time.justNow')
    }

    if (diff < 0) {
      // Past
      const seconds = Math.floor(absDiff / 1000)
      if (seconds < 90) return t('time.minuteAgo')
      const minutes = Math.floor(seconds / 60)
      if (minutes < 45) return t('time.minutesAgo', { n: minutes })
      if (minutes < 90) return t('time.hourAgo')
      const hours = Math.floor(minutes / 60)
      if (hours < 22) return t('time.hoursAgo', { n: hours })
      if (hours < 36) return t('time.dayAgo')
      const days = Math.floor(hours / 24)
      if (days < 25) return t('time.daysAgo', { n: days })
      if (days < 45) return t('time.monthAgo')
      const months = Math.floor(days / 30)
      return t('time.monthsAgo', { n: months })
    } else {
      // Future
      const seconds = Math.floor(diff / 1000)
      if (seconds < 90) return t('time.inMinute')
      const minutes = Math.floor(seconds / 60)
      if (minutes < 45) return t('time.inMinutes', { n: minutes })
      if (minutes < 90) return t('time.inHour')
      const hours = Math.floor(minutes / 60)
      if (hours < 22) return t('time.inHours', { n: hours })
      if (hours < 36) return t('time.inDay')
      const days = Math.floor(hours / 24)
      return t('time.inDays', { n: days })
    }
  }

  return {
    locale,
    setLocale,
    dateFormat,
    setDateFormat,
    t,
    formatDate,
    formatNumber,
    formatRelativeTime
  }
}
