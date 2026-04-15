import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/hooks/use-auth'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import AppLayout from '@/components/AppLayout'
import { ProtectedRoute, AdminRoute } from '@/components/ProtectedRoute'

// Direct Imports
import Index from './pages/Index'
import NotFound from './pages/NotFound'

// Lazy Loading Auth Routes
const Login = lazy(() => import('./pages/auth/Login'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))

// Lazy Loading Admin Routes
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const Tenants = lazy(() => import('./pages/admin/Tenants'))
const TenantDetail = lazy(() => import('./pages/admin/TenantDetail'))
const Bots = lazy(() => import('./pages/admin/Bots'))
const BotDetail = lazy(() => import('./pages/admin/BotDetail'))
const Integrations = lazy(() => import('./pages/admin/Integrations'))
const Logs = lazy(() => import('./pages/admin/Logs'))

// Lazy Loading Client Routes
const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'))
const CRM = lazy(() => import('./pages/client/CRM'))
const Agenda = lazy(() => import('./pages/client/Agenda'))
const Whatsapp = lazy(() => import('./pages/client/Whatsapp'))
const Email = lazy(() => import('./pages/client/Email'))
const Automations = lazy(() => import('./pages/client/Automations'))
const Reports = lazy(() => import('./pages/client/Reports'))
const Settings = lazy(() => import('./pages/client/Settings'))

const App = () => (
  <ErrorBoundary>
    <ThemeProvider defaultTheme="dark">
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Routes>
              {/* Public Auth Routes */}
              <Route
                path="/login"
                element={
                  <Suspense fallback={<div />}>
                    <Login />
                  </Suspense>
                }
              />
              <Route
                path="/forgot-password"
                element={
                  <Suspense fallback={<div />}>
                    <ForgotPassword />
                  </Suspense>
                }
              />

              {/* Main App Layout Routes */}
              <Route element={<AppLayout />}>
                <Route path="/" element={<Index />} />

                {/* Admin Area */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin">
                    <Route index element={<AdminDashboard />} />
                    <Route path="tenants" element={<Tenants />} />
                    <Route path="tenants/:id" element={<TenantDetail />} />
                    <Route path="bots" element={<Bots />} />
                    <Route path="bots/:id" element={<BotDetail />} />
                    <Route path="integrations" element={<Integrations />} />
                    <Route path="logs" element={<Logs />} />
                  </Route>
                </Route>

                {/* Client Area */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<ClientDashboard />} />
                  <Route path="/crm" element={<CRM />} />
                  <Route path="/agenda" element={<Agenda />} />
                  <Route path="/whatsapp" element={<Whatsapp />} />
                  <Route path="/email" element={<Email />} />
                  <Route path="/automations" element={<Automations />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/settings" element={<Settings />} />
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TooltipProvider>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </ErrorBoundary>
)

export default App
