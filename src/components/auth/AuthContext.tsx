import React, { useEffect, useState, createContext, useContext } from 'react';
// Sample user data
const USERS = [{
  id: 1,
  username: 'manager',
  password: 'password',
  name: 'Manager (Initiator)',
  role: 'initiator'
}, {
  id: 2,
  username: 'branch-auditor',
  password: 'password',
  name: 'Branch Auditor',
  role: 'branch_auditor'
}, {
  id: 3,
  username: 'regional-manager',
  password: 'password',
  name: 'Regional Manager Operations',
  role: 'regional_manager'
}, {
  id: 4,
  username: 'ho-admin',
  password: 'password',
  name: 'Head Office Admin',
  role: 'ho_admin'
}, {
  id: 5,
  username: 'ho-auditor',
  password: 'password',
  name: 'Head Office Auditor',
  role: 'ho_auditor'
}, {
  id: 6,
  username: 'account-unit',
  password: 'password',
  name: 'Account Unit',
  role: 'account_unit'
}, {
  id: 7,
  username: 'dd-operations',
  password: 'password',
  name: 'Deputy Director Operations',
  role: 'dd_operations'
}, {
  id: 8,
  username: 'dd-finance',
  password: 'password',
  name: 'DD Finance',
  role: 'dd_finance'
}, {
  id: 9,
  username: 'ged',
  password: 'password',
  name: 'GED Supersaver Group',
  role: 'ged'
}];
// Define the approval chain order
const APPROVAL_CHAIN = ['branch_auditor', 'regional_manager', 'ho_admin', 'ho_auditor', 'account_unit', 'dd_operations', 'dd_finance', 'ged'];
const AuthContext = createContext(null);
export const AuthProvider = ({
  children
}) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);
  const login = (username, password) => {
    const foundUser = USERS.find(u => u.username === username && u.password === password);
    if (foundUser) {
      const userInfo = {
        ...foundUser
      };
      delete userInfo.password; // Don't store password in state
      setUser(userInfo);
      localStorage.setItem('currentUser', JSON.stringify(userInfo));
      return {
        success: true,
        user: userInfo
      };
    }
    return {
      success: false,
      message: 'Invalid credentials'
    };
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };
  // Get all users in the approval chain for selection in forms
  const getApprovalChain = () => {
    return APPROVAL_CHAIN.map(role => {
      const approver = USERS.find(user => user.role === role);
      return {
        id: approver.id,
        name: approver.name,
        role: approver.role
      };
    });
  };
  const getUser = userId => {
    const user = USERS.find(u => u.id === userId);
    return user ? {
      id: user.id,
      name: user.name,
      role: user.role
    } : null;
  };
  // Check if a user is an approver (has any role in the approval chain)
  const isApprover = userId => {
    const user = USERS.find(u => u.id === userId);
    return user ? APPROVAL_CHAIN.includes(user.role) : false;
  };
  // Get the next approver in the chain
  const getNextApproverInChain = currentApproverRole => {
    const currentIndex = APPROVAL_CHAIN.indexOf(currentApproverRole);
    if (currentIndex >= 0 && currentIndex < APPROVAL_CHAIN.length - 1) {
      const nextRole = APPROVAL_CHAIN[currentIndex + 1];
      return USERS.find(u => u.role === nextRole).id;
    }
    return null; // No next approver (end of chain)
  };
  // Get approver index in the chain
  const getApproverIndexInChain = approverRole => {
    return APPROVAL_CHAIN.indexOf(approverRole);
  };
  if (loading) {
    return <div className="flex items-center justify-center h-screen">
        Loading...
      </div>;
  }
  return <AuthContext.Provider value={{
    user,
    login,
    logout,
    getApprovalChain,
    getUser,
    isApprover,
    getNextApproverInChain,
    getApproverIndexInChain,
    APPROVAL_CHAIN
  }}>
      {children}
    </AuthContext.Provider>;
};
export const useAuth = () => useContext(AuthContext);