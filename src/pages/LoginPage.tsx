import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { loginUser, clearError, checkSession } from '../store/authSlice';
import { supabase } from '../supabaseClient';
import { LockIcon, UserIcon } from 'lucide-react';
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useAppDispatch();
  const { user, loading, error } = useAppSelector((state) => state.auth);
  const navigate = useNavigate();
  
  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    dispatch(clearError());
    
    if (loading) return;
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    try {
      const res: any = await dispatch(loginUser({ email, password })).unwrap();

      // If the account requires a password change, show the change-password prompt
      if (res?.forcePasswordChange) {
        setShowChangePassword(true);
        return;
      }

      navigate('/');
    } catch (err) {
      // Error is handled by Redux
    }
  };

  // Change password modal states
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePwdError, setChangePwdError] = useState('');
  const [changing, setChanging] = useState(false);

  const handleChangePassword = async () => {
    setChangePwdError('');
    if (!oldPassword || !newPassword) {
      setChangePwdError('Please provide both old and new passwords');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePwdError('New passwords do not match');
      return;
    }

    try {
      setChanging(true);

      // Verify old password by attempting sign-in
      const { error: signInOldError } = await supabase.auth.signInWithPassword({
        email,
        password: oldPassword,
      });

      if (signInOldError) {
        setChangePwdError('Old password is incorrect');
        setChanging(false);
        return;
      }

      // Update the user's password and clear the force flag in user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { forcePasswordChange: false },
      });

      if (updateError) {
        // Show detailed error (e.g., weak password) when available
        setChangePwdError(updateError.message || 'Failed to update password');
        setChanging(false);
        return;
      }

      // Re-authenticate with the new password to refresh tokens & metadata
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: newPassword,
      });

      if (signInError) {
        setChangePwdError(signInError.message || 'Password updated but failed to re-authenticate. Please sign in again.');
        setChanging(false);
        return;
      }

      // Refresh session/profile and navigate
      await dispatch(checkSession());
      setShowChangePassword(false);
      navigate('/');
    } catch (err: any) {
      setChangePwdError(err?.message || 'Failed to change password');
    } finally {
      setChanging(false);
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
        {(error || localError) && <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
            {error || localError}
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
           
          </div>
          <div>
            <button 
              type="submit" 
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

        {/* Change password modal */}
        {showChangePassword && <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="absolute inset-0 bg-black opacity-50" onClick={() => setShowChangePassword(false)} />
            <div className="relative bg-white rounded-lg shadow-lg p-6 w-full max-w-md z-10">
              <h3 className="text-lg font-medium text-gray-900">Change your password</h3>
              <p className="text-sm text-gray-600 mt-1">For security, please change the temporary password provided to you.</p>
              {changePwdError && <div className="bg-red-50 text-red-500 p-2 rounded mt-3 text-sm">{changePwdError}</div>}
              <div className="mt-4 space-y-3">
                <input type="password" placeholder="Old password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="w-full px-3 py-2 border rounded" />
                <input type="password" placeholder="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 border rounded" />
                <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border rounded" />
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <button type="button" onClick={() => setShowChangePassword(false)} className="px-4 py-2 rounded border">Cancel</button>
                <button type="button" onClick={handleChangePassword} disabled={changing} className="px-4 py-2 rounded bg-blue-600 text-white">{changing ? 'Updating...' : 'Update password'}</button>
              </div>
            </div>
          </div>}
      </div>
    </div>;
};
export default LoginPage;