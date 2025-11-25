import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store/store';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { checkSession } from './store/authSlice';
import { RequestProvider } from './components/requests/RequestContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import CreateRequest from './pages/CreateRequest';
import RequestDetails from './pages/RequestDetails';
import Layout from './components/layout/Layout';
import { Toaster } from 'sonner';
import NotificationsSystem, { atalhoTheme, dismissNotification } from 'reapop'
// Protected route wrapper
const ProtectedRoute = ({ children }: React.PropsWithChildren) => {
  const user = useAppSelector((state) => state.auth.user);
  
  if (!user) return <Navigate to="/login" replace />;
  return <RequestProvider>{children}</RequestProvider>;
};

// Public route wrapper
const PublicRoute = ({ children }: React.PropsWithChildren) => {
  const user = useAppSelector((state) => state.auth.user);
  
  if (user) return <Navigate to="/" replace />;
  return children;
};

// App content with Redux
const AppContent = () => {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector((state) => state.notifications?.notifications || []);
  
  useEffect(() => {
    dispatch(checkSession());
  }, [dispatch]);
  
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <NotificationsSystem 
        notifications={notifications} 
        theme={atalhoTheme}
        dismissNotification={(id) => dispatch(dismissNotification(id))}
      />
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/" element={<ProtectedRoute>
              <Layout />
            </ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="create-request" element={<CreateRequest />} />
          <Route path="requests/:requestId" element={<RequestDetails />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={<div>Loading...</div>} persistor={persistor}>
        <AppContent />
      </PersistGate>
    </Provider>
  );
}