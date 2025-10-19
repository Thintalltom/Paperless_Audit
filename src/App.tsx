import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/auth/AuthContextSupabase';
import { RequestProvider } from './components/requests/RequestContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import CreateRequest from './pages/CreateRequest';
import RequestDetails from './pages/RequestDetails';
import Layout from './components/layout/Layout';
import { Toaster } from 'sonner';
// Protected route wrapper
const ProtectedRoute = ({
  children
}) => {
  const {
    user,
    loading
  } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  if (!user) return <Navigate to="/login" replace />;
  return <RequestProvider>{children}</RequestProvider>;
};
export function App() {
  return <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute>
                <Layout />
              </ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="create-request" element={<CreateRequest />} />
            <Route path="requests/:requestId" element={<RequestDetails />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>;
}