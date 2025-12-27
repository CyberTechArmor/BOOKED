import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { AppLayout } from './components/layout';

// Lazy load pages
import { lazy, Suspense, useEffect } from 'react';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/app/DashboardPage'));
const BookingsPage = lazy(() => import('./pages/app/BookingsPage'));
const EventTypesPage = lazy(() => import('./pages/app/EventTypesPage'));
const AvailabilityPage = lazy(() => import('./pages/app/AvailabilityPage'));
const SettingsPage = lazy(() => import('./pages/app/SettingsPage'));
const PublicBookingPage = lazy(() => import('./pages/public/BookingPage'));
const BookingConfirmationPage = lazy(() => import('./pages/public/BookingConfirmationPage'));

function LoadingSpinner(): JSX.Element {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)]"></div>
    </div>
  );
}

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps): JSX.Element {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

function App(): JSX.Element {
  const { checkAuth } = useAuthStore();

  // Check authentication status on app mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/:orgSlug/:eventSlug" element={<PublicBookingPage />} />
        <Route path="/booking/:uid" element={<BookingConfirmationPage />} />

        {/* Protected routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/bookings"
          element={
            <ProtectedRoute>
              <BookingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/event-types"
          element={
            <ProtectedRoute>
              <EventTypesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/availability"
          element={
            <ProtectedRoute>
              <AvailabilityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
