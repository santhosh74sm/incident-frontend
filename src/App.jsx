import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ToastProvider from './components/ToastProvider';
import CommandPalette from './components/CommandPalette';
import DashboardLayout from './components/DashboardLayout';
import AppErrorBoundary from './components/AppErrorBoundary';
import { ThemeProvider } from './context/ThemeContext';

const CHUNK_RELOAD_KEY = 'st-incident-system:chunk-reload';

const isChunkLoadError = (error) =>
  error?.name === 'ChunkLoadError' ||
  error?.message?.includes('Loading chunk') ||
  error?.message?.includes('Failed to fetch dynamically imported module');

const lazyWithChunkRetry = (importPage) =>
  lazy(() =>
    importPage()
      .then((module) => {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        return module;
      })
      .catch((error) => {
        if (isChunkLoadError(error) && sessionStorage.getItem(CHUNK_RELOAD_KEY) !== 'true') {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, 'true');
          window.location.reload();
          return new Promise(() => {});
        }

        throw error;
      })
  );

const Login = lazyWithChunkRetry(() => import('./pages/Login'));
const Register = lazyWithChunkRetry(() => import('./pages/Register'));
const ForceChangePassword = lazyWithChunkRetry(() => import('./pages/ForceChangePassword'));
const Dashboard = lazyWithChunkRetry(() => import('./pages/Dashboard'));
const CreateIncident = lazyWithChunkRetry(() => import('./pages/CreateIncident'));
const IncidentList = lazyWithChunkRetry(() => import('./pages/IncidentList'));
const IncidentDetail = lazyWithChunkRetry(() => import('./pages/IncidentDetail'));
const UserManagement = lazyWithChunkRetry(() => import('./pages/UserManagement'));
const StudentUpload = lazyWithChunkRetry(() => import('./pages/StudentUpload'));
const BulkUpload = lazyWithChunkRetry(() => import('./pages/BulkUpload'));
const ProfessionalAnalytics = lazyWithChunkRetry(() => import('./pages/ProfessionalAnalytics'));
const StudentAnalytics = lazyWithChunkRetry(() => import('./pages/StudentAnalytics'));
const Logs = lazyWithChunkRetry(() => import('./pages/Logs'));
const LetterTemplates = lazyWithChunkRetry(() => import('./pages/LetterTemplates'));
const IssuedLetters = lazyWithChunkRetry(() => import('./pages/IssuedLetters'));

const PageLoader = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
  </div>
);

class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    if (isChunkLoadError(error)) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return <PageLoader />;
    }
    return this.props.children;
  }
}

const loadPage = (element) => (
  <ChunkErrorBoundary>
    <Suspense fallback={<PageLoader />}>{element}</Suspense>
  </ChunkErrorBoundary>
);

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  if (user?.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  return user && ['Super Admin', 'Admin'].includes(user.role) ? children : <Navigate to="/dashboard" />;
};

function App() {
  return (
    <AppErrorBoundary>
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <ToastProvider>
            <Router>
              <div className="min-h-screen bg-gray-50 font-sans text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
              <CommandPalette />
              <Routes>
                <Route path="/login" element={loadPage(<Login />)} />
                <Route path="/register" element={loadPage(<Register />)} />

                <Route
                  element={
                    <PrivateRoute>
                      <DashboardLayout />
                    </PrivateRoute>
                  }
                >
                  <Route path="/dashboard" element={loadPage(<Dashboard />)} />
                  <Route path="/change-password" element={loadPage(<ForceChangePassword />)} />
                  <Route path="/analytics" element={loadPage(<ProfessionalAnalytics />)} />
                  <Route path="/student-analytics/:admissionNo" element={loadPage(<StudentAnalytics />)} />
                  <Route path="/student-analytics" element={loadPage(<StudentAnalytics />)} />
                  <Route path="/incidents" element={loadPage(<IncidentList />)} />
                  <Route path="/incidents/:id" element={loadPage(<IncidentDetail />)} />
                  <Route path="/create-incident" element={loadPage(<CreateIncident />)} />

                  <Route
                    path="/logs"
                    element={loadPage(
                      <AdminRoute>
                        <Logs />
                      </AdminRoute>
                    )}
                  />
                  <Route
                    path="/user-management"
                    element={loadPage(
                      <AdminRoute>
                        <UserManagement />
                      </AdminRoute>
                    )}
                  />
                  <Route
                    path="/upload-students"
                    element={loadPage(
                      <AdminRoute>
                        <StudentUpload />
                      </AdminRoute>
                    )}
                  />
                  <Route
                    path="/upload-incidents"
                    element={loadPage(
                      <AdminRoute>
                        <BulkUpload />
                      </AdminRoute>
                    )}
                  />
                  <Route
                    path="/letter-templates"
                    element={loadPage(
                      <AdminRoute>
                        <LetterTemplates />
                      </AdminRoute>
                    )}
                  />
                  <Route
                    path="/issued-letters"
                    element={loadPage(
                      <AdminRoute>
                        <IssuedLetters />
                      </AdminRoute>
                    )}
                  />
                </Route>

                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="*" element={<Navigate to="/dashboard" />} />
              </Routes>
              </div>
            </Router>
          </ToastProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
    </AppErrorBoundary>
  );
}

export default App;
