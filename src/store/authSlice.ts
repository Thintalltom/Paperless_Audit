import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../supabaseClient';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at?: string;
}

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  needsPasswordChange: boolean;
}

const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
  needsPasswordChange: false,
};

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    console.log(data);

    if (error) {
      throw new Error(error.message);
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('admin_profile')
        .select('*')
        .eq('id', data.user.id)
        .single();
      
      // Return both profile and user data (including metadata)
      return {
        profile,
        user: data.user
      };
    }

    throw new Error('Login failed');
  }
);

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  await supabase.auth.signOut();
});

export const checkSession = createAsyncThunk('auth/checkSession', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.user) {
    const { data: profile } = await supabase
      .from('admin_profile')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    return profile;
  }
  
  return null;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action) => {
      state.user = action.payload;
    },
    completePasswordChange: (state, action) => {
      state.user = action.payload;
      state.needsPasswordChange = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        const needsPasswordChange = action.payload.user?.user_metadata?.needs_password_change;
        const hasNeverChangedPassword = !action.payload.user?.user_metadata?.password_changed;
        
        if (needsPasswordChange || hasNeverChangedPassword) {
          state.needsPasswordChange = true;
          // Don't set user yet - wait for password change
        } else {
          state.user = action.payload.profile;
          state.needsPasswordChange = false;
        }
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Login failed';
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.error = null;
      })
      .addCase(checkSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.loading = false;
      });
  },
});

export const { clearError, setUser, completePasswordChange } = authSlice.actions;
export default authSlice.reducer;