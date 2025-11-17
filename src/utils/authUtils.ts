import { supabase } from '../supabaseClient';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at?: string;
}

const APPROVAL_CHAIN = [
  'branch_auditor', 'regional_manager', 'ho_admin', 'ho_auditor', 
  'account_unit', 'dd_operations', 'dd_finance', 'ged'
];

export const getUser = async (userId: string): Promise<UserProfile | null> => {
  const { data, error } = await supabase
    .from('admin_profile')
    .select('*')
    .eq('id', userId)
    .single();

  return error ? null : data;
};

export const isApprover = async (userId: string): Promise<boolean> => {
  const userProfile = await getUser(userId);
  return userProfile ? APPROVAL_CHAIN.includes(userProfile.role) : false;
};

export const getNextApproverInChain = async (currentApproverRole: string): Promise<string | null> => {
  const currentIndex = APPROVAL_CHAIN.indexOf(currentApproverRole);
  if (currentIndex >= 0 && currentIndex < APPROVAL_CHAIN.length - 1) {
    const nextRole = APPROVAL_CHAIN[currentIndex + 1];
    const { data } = await supabase
      .from('admin_profile')
      .select('id')
      .eq('role', nextRole)
      .single();
    
    return data?.id || null;
  }
  return null;
};