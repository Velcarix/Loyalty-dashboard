import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Login } from '@/pages/Login'
import { Signup } from '@/pages/Signup'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { ProgramsList } from '@/pages/ProgramsList'
import { ProgramEditor } from '@/pages/ProgramEditor'
import { ProgramDetailLayout } from '@/pages/ProgramDetailLayout'
import { ProgramDashboard } from '@/pages/ProgramDashboard'
import { Customers } from '@/pages/Customers'
import { CustomerDetail } from '@/pages/CustomerDetail'
import { Rewards } from '@/pages/Rewards'
import { Transactions } from '@/pages/Transactions'
import { Anomalies } from '@/pages/Anomalies'
import { Settings } from '@/pages/Settings'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/programas" replace />} />
            <Route path="/programas" element={<ProgramsList />} />
            <Route path="/programas/nuevo" element={<ProgramEditor />} />
            <Route path="/programas/:programId/editar" element={<ProgramEditor />} />
            <Route path="/programas/:programId" element={<ProgramDetailLayout />}>
              <Route index element={<ProgramDashboard />} />
              <Route path="clientes" element={<Customers />} />
              <Route path="clientes/:customerId" element={<CustomerDetail />} />
              <Route path="rewards" element={<Rewards />} />
              <Route path="transacciones" element={<Transactions />} />
              <Route path="anomalias" element={<Anomalies />} />
            </Route>
            <Route path="/ajustes" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/programas" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
