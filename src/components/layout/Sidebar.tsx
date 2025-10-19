import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContextSupabase';
import { HomeIcon, PlusCircleIcon, ClipboardListIcon } from 'lucide-react';
const Sidebar = () => {
  const {
    user
  } = useAuth();
  const navItems = [{
    name: 'Dashboard',
    path: '/',
    icon: <HomeIcon className="h-5 w-5" />
  }];
  // Add role-specific navigation items
  if (user.role === 'initiator') {
    navItems.push({
      name: 'Create Request',
      path: '/create-request',
      icon: <PlusCircleIcon className="h-5 w-5" />
    });
  }
  if (user.role === 'approver') {
    navItems.push({
      name: 'Pending Approvals',
      path: '/',
      icon: <ClipboardListIcon className="h-5 w-5" />
    });
  }
  if (user.role === 'finance') {
    navItems.push({
      name: 'Payment Processing',
      path: '/',
      icon: <div className="h-5 w-5" />
    });
  }
  return <div className="bg-gray-800 text-white w-64 flex-shrink-0 hidden md:block">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold">Expense System</h2>
      </div>
      <nav className="mt-6">
        <ul>
          {navItems.map((item, index) => <li key={index}>
              <NavLink to={item.path} className={({
            isActive
          }) => `flex items-center px-6 py-3 hover:bg-gray-700 ${isActive ? 'bg-gray-700' : ''}`}>
                {item.icon}
                <span className="ml-3">{item.name}</span>
              </NavLink>
            </li>)}
        </ul>
      </nav>
    </div>;
};
export default Sidebar;