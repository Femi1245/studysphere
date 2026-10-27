import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute } from '@/components/auth/admin-route'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { AppLayout } from '@/components/layout/app-layout'
import { PublicLayout } from '@/components/layout/public-layout'
import { ForgotPasswordPage } from '@/pages/auth/forgot-password'
import { LoginPage } from '@/pages/auth/login'
import { ResetPasswordPage } from '@/pages/auth/reset-password'
import { SignupPage } from '@/pages/auth/signup'
import { AdminPage } from '@/pages/app/admin'
import { AiTutorPage } from '@/pages/app/ai-tutor'
import { DashboardPage } from '@/pages/app/dashboard'
import { FlashcardsPage } from '@/pages/app/flashcards'
import { NoteEditorPage } from '@/pages/app/notes/editor'
import { NotesPage } from '@/pages/app/notes'
import { NotificationsPage } from '@/pages/app/notifications'
import { OnboardingPage } from '@/pages/app/onboarding'
import { PlannerPage } from '@/pages/app/planner'
import { ProgressPage } from '@/pages/app/progress'
import { QuizDetailPage } from '@/pages/app/quizzes/detail'
import { QuizzesPage } from '@/pages/app/quizzes'
import { SettingsPage } from '@/pages/app/settings'
import { SubjectDetailPage } from '@/pages/app/subjects/detail'
import { SubjectsPage } from '@/pages/app/subjects'
import { TimerPage } from '@/pages/app/timer'
import { AboutPage } from '@/pages/public/about'
import { ContactPage } from '@/pages/public/contact'
import { FeaturesPage } from '@/pages/public/features'
import { HomePage } from '@/pages/public/home'
import { PricingPage } from '@/pages/public/pricing'
import { PrivacyPage } from '@/pages/public/privacy'
import { TermsPage } from '@/pages/public/terms'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="features" element={<FeaturesPage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
      </Route>

      <Route path="login" element={<LoginPage />} />
      <Route path="signup" element={<SignupPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />

      <Route path="app" element={<ProtectedRoute />}>
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="subjects/:id" element={<SubjectDetailPage />} />
          <Route path="planner" element={<PlannerPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="notes/new" element={<NoteEditorPage />} />
          <Route path="notes/:id" element={<NoteEditorPage />} />
          <Route path="quizzes" element={<QuizzesPage />} />
          <Route path="quizzes/:id" element={<QuizDetailPage />} />
          <Route path="flashcards" element={<FlashcardsPage />} />
          <Route path="timer" element={<TimerPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="ai" element={<AiTutorPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route element={<AdminRoute />}>
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
