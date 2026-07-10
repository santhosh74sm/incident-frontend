import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import ToastProvider from './components/ToastProvider';
import ConfirmProvider from './components/ConfirmProvider';
import DashboardLayout from './components/DashboardLayout';
import AppErrorBoundary from './components/AppErrorBoundary';
import { normalizeRole } from './utils/roles';

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

const pageImports = {
  Login: () => import('./pages/Login'),
  Register: () => import('./pages/Register'),
  ForceChangePassword: () => import('./pages/ForceChangePassword'),
  Dashboard: () => import('./pages/Dashboard'),
  CreateIncident: () => import('./pages/CreateIncident'),
  IncidentList: () => import('./pages/IncidentList'),
  IncidentDetail: () => import('./pages/IncidentDetail'),
  UserManagement: () => import('./pages/UserManagement'),
  StudentUpload: () => import('./pages/StudentUpload'),
  BulkUpload: () => import('./pages/BulkUpload'),
  ProfessionalAnalytics: () => import('./pages/ProfessionalAnalytics'),
  StudentAnalytics: () => import('./pages/StudentAnalytics'),
  Logs: () => import('./pages/Logs'),
  LetterTemplates: () => import('./pages/LetterTemplates'),
  IssuedLetters: () => import('./pages/IssuedLetters'),
  AcademicYearManagement: () => import('./pages/AcademicYearManagement'),
  CommandPalette: () => import('./components/CommandPalette'),
};

const Login = lazyWithChunkRetry(pageImports.Login);
const Register = lazyWithChunkRetry(pageImports.Register);
const ForceChangePassword = lazyWithChunkRetry(pageImports.ForceChangePassword);
const Dashboard = lazyWithChunkRetry(pageImports.Dashboard);
const CreateIncident = lazyWithChunkRetry(pageImports.CreateIncident);
const IncidentList = lazyWithChunkRetry(pageImports.IncidentList);
const IncidentDetail = lazyWithChunkRetry(pageImports.IncidentDetail);
const UserManagement = lazyWithChunkRetry(pageImports.UserManagement);
const StudentUpload = lazyWithChunkRetry(pageImports.StudentUpload);
const BulkUpload = lazyWithChunkRetry(pageImports.BulkUpload);
const ProfessionalAnalytics = lazyWithChunkRetry(pageImports.ProfessionalAnalytics);
const StudentAnalytics = lazyWithChunkRetry(pageImports.StudentAnalytics);
const Logs = lazyWithChunkRetry(pageImports.Logs);
const LetterTemplates = lazyWithChunkRetry(pageImports.LetterTemplates);
const IssuedLetters = lazyWithChunkRetry(pageImports.IssuedLetters);
const AcademicYearManagement = lazyWithChunkRetry(pageImports.AcademicYearManagement);
const CommandPalette = lazyWithChunkRetry(pageImports.CommandPalette);

const PageLoader = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
  </div>
);

const NotFoundPage = () => (
  <div className="flex min-h-[70vh] items-center justify-center px-4 text-center">
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">404</p>
      <h1 className="mt-3 text-2xl font-bold text-slate-900 ">Page Not Found</h1>
      <p className="mt-2 text-sm text-slate-500 ">This workspace page does not exist or is no longer available.</p>
    </div>
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

const scheduleIdleWork = (callback) => {
  if (typeof window === 'undefined') return () => {};
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(callback, { timeout: 2500 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(callback, 600);
  return () => window.clearTimeout(id);
};

const AuthenticatedRoutePreloader = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return undefined;

    const role = normalizeRole(user.role);
    const imports = [
      pageImports.Dashboard,
      pageImports.IncidentList,
      pageImports.IncidentDetail,
      pageImports.CommandPalette,
    ];

    if (['Super Admin', 'Admin', 'Teacher'].includes(role)) {
      imports.push(pageImports.CreateIncident);
    }

    if (['Super Admin', 'Admin'].includes(role)) {
      imports.push(
        pageImports.ProfessionalAnalytics,
        pageImports.StudentAnalytics,
        pageImports.UserManagement,
        pageImports.StudentUpload,
        pageImports.BulkUpload
      );
    }

    if (['Super Admin', 'Admin', 'Teacher'].includes(role)) {
      imports.push(pageImports.LetterTemplates, pageImports.IssuedLetters);
    }

    if (role === 'Super Admin') {
      imports.push(pageImports.Logs, pageImports.AcademicYearManagement);
    }

    return scheduleIdleWork(() => {
      imports.forEach((preload) => preload().catch(() => {}));
    });
  }, [user]);

  return null;
};

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
  return user && ['Super Admin', 'Admin'].includes(normalizeRole(user.role)) ? children : <Navigate to="/dashboard" />;
};

const LetterModuleRoute = ({ children }) => {
  const { user } = useAuth();
  return user && ['Super Admin', 'Admin', 'Teacher'].includes(normalizeRole(user.role)) ? children : <Navigate to="/dashboard" />;
};

const SuperAdminRoute = ({ children }) => {
  const { user } = useAuth();
  return user && normalizeRole(user.role) === 'Super Admin' ? children : <Navigate to="/dashboard" />;
};

const AuditLogRoute = ({ children }) => {
  const { user } = useAuth();
  if (user && normalizeRole(user.role) === 'Super Admin') return children;
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 text-center">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">403</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900 ">Audit Logs Are Restricted</h1>
        <p className="mt-2 text-sm text-slate-500 ">Only Super Admins can access audit logs.</p>
      </div>
    </div>
  );
};

function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <ToastProvider>
            <ConfirmProvider>
            <Router>
              <div className="min-h-screen bg-gray-50 font-sans text-slate-900 transition-colors duration-200 ">
              <Suspense fallback={null}>
                <CommandPalette />
              </Suspense>
              <AuthenticatedRoutePreloader />
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
                  <Route
                    path="/analytics"
                    element={loadPage(
                      <AdminRoute>
                        <ProfessionalAnalytics />
                      </AdminRoute>
                    )}
                  />
                  <Route
                    path="/student-analytics/:admissionNo"
                    element={loadPage(
                      <AdminRoute>
                        <StudentAnalytics />
                      </AdminRoute>
                    )}
                  />
                  <Route
                    path="/student-analytics"
                    element={loadPage(
                      <AdminRoute>
                        <StudentAnalytics />
                      </AdminRoute>
                    )}
                  />
                  <Route path="/incidents" element={loadPage(<IncidentList />)} />
                  <Route path="/incidents/:id" element={loadPage(<IncidentDetail />)} />
                  <Route path="/create-incident" element={loadPage(<CreateIncident />)} />

                  <Route
                    path="/logs"
                    element={loadPage(
                      <AuditLogRoute>
                        <Logs />
                      </AuditLogRoute>
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
                    path="/settings/academic-year"
                    element={loadPage(
                      <SuperAdminRoute>
                        <AcademicYearManagement />
                      </SuperAdminRoute>
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
                      <LetterModuleRoute>
                        <LetterTemplates />
                      </LetterModuleRoute>
                    )}
                  />
                  <Route
                    path="/issued-letters"
                    element={loadPage(
                      <LetterModuleRoute>
                        <IssuedLetters />
                      </LetterModuleRoute>
                    )}
                  />
                </Route>

                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="*" element={loadPage(<NotFoundPage />)} />
              </Routes>
              </div>
            </Router>
            </ConfirmProvider>
          </ToastProvider>
        </NotificationProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;
