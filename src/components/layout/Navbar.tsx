import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logoutUser } from '../../store/authSlice';
import { LogOutIcon, UserIcon } from 'lucide-react';
const Navbar = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state?.auth?.user);
  
  const handleLogout = () => {
    dispatch(logoutUser());
  };
  return <nav className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
      <div className="font-semibold text-lg text-gray-800">
        Expense Approval System
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center text-sm">
          <UserIcon className="h-5 w-5 text-gray-500 mr-2" />
          <span className="mr-1 text-gray-700">{user?.name || user?.email}</span>
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full capitalize">
            {user?.role}
          </span>
        </div>
        <button onClick={handleLogout} className="text-gray-500 hover:text-gray-700 flex items-center">
          <LogOutIcon className="h-5 w-5" />
          <span className="ml-1 text-sm">Logout</span>
        </button>
      </div>
    </nav>;
};
export default Navbar;