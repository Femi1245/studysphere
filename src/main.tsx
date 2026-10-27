import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ActiveQuizProvider } from '@/contexts/active-quiz-context'
import { AuthProvider } from '@/contexts/auth-context'
import { ThemeProvider } from '@/hooks/use-theme'
import { ToastProvider } from '@/components/ui/toast'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ActiveQuizProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </ActiveQuizProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
