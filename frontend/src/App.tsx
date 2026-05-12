import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import Layout from '@/components/layout/Layout'
import LoginPage from '@/pages/Login'
import DashboardPage from '@/pages/Dashboard'
import PatientsPage from '@/pages/Patients'
import PatientDetailPage from '@/pages/PatientDetail'
import FittingAssistantPage from '@/pages/FittingAssistant'
import OrdersPage from '@/pages/Orders'
import ChatbotPage from '@/pages/Chatbot'
import ReportsPage from '@/pages/Reports'
import AgendaPage from '@/pages/Agenda'
import SettingsPage from '@/pages/Settings'
import LinkedInLeadsPage from '@/pages/LinkedInLeads'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="patients/:id" element={<PatientDetailPage />} />
          <Route path="fitting" element={<FittingAssistantPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="chatbot" element={<ChatbotPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="agenda" element={<AgendaPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="linkedin-leads" element={<LinkedInLeadsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
