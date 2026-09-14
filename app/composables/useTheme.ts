export type Theme = 'dark' | 'light'

export function useTheme() {
  const theme = useState<Theme>('app-theme', () => {
    if (import.meta.client) {
      try {
        const stored = localStorage.getItem('probelm-theme')
        if (stored === 'dark' || stored === 'light') return stored
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
          return 'light'
        }
      } catch {
        // Ignore
      }
    }
    return 'dark'
  })

  function applyTheme(newTheme: Theme) {
    theme.value = newTheme
    if (import.meta.client) {
      try {
        localStorage.setItem('probelm-theme', newTheme)
        const root = document.documentElement
        root.classList.remove('dark', 'light')
        root.classList.add(newTheme)
        root.setAttribute('data-theme', newTheme)
        root.style.colorScheme = newTheme
      } catch {
        // Ignore
      }
    }
  }

  function toggleTheme() {
    applyTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return {
    theme,
    setTheme: applyTheme,
    toggleTheme
  }
}
