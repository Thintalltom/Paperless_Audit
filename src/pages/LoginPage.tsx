import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContextSupabase';
import { LockIcon, UserIcon } from 'lucide-react';
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const {
    login
  } = useAuth();
  const navigate = useNavigate();
  const handleSubmit = async e => {
    e.preventDefault();
    console.log('=== Form submitted with:', { email, password });
    setError('');
    
    try {
      console.log('=== Calling login function...');
      const result = await login(email, password);
      console.log('=== Login function returned:', result);
      
      if (result.success) {
        console.log('=== Login successful, navigating...');
        navigate('/');
      } else {
        console.log('=== Login failed:', result.message);
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      console.error('=== Login error:', err);
      setError('An error occurred during login');
    }
  };
  return <div className="min-h-screen flex items-center justify-center bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Expense Approval System
          </h2>
          <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
        </div>
        {error && <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
            {error}
          </div>}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input id="email" name="email" type="email" required className="appearance-none rounded-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input id="password" name="password" type="password" required className="appearance-none rounded-none relative block w-full px-3 py-2 pl-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            {/* <p>Demo Accounts:</p>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li>Use your Supabase credentials to login</li>
            </ul> */}
            <button 
              type="button" 
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
              }}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Clear Cache & Reload (if login issues)
            </button>
          </div>
          <div>
            <button type="submit" className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>;
};
export default LoginPage;