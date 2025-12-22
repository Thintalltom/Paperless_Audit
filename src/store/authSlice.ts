import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../supabaseClient';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  forcePasswordChange?: boolean;
  created_at?: string;
}

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
};

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from('admin_profile')
        .select('*')
        .eq('id', data.user.id)
        .single();
      // include a flag for whether the user should be forced to change password
      const forcePasswordChange = !!data.user.user_metadata?.forcePasswordChange;

      return { ...profile, forcePasswordChange };
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
    const forcePasswordChange = !!session.user.user_metadata?.forcePasswordChange;
    return { ...profile, forcePasswordChange };
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        // If the login indicates the user must change password, do not set the user in state
        // This prevents components (like LoginPage) that redirect on user presence from navigating
        if (action.payload && (action.payload as any).forcePasswordChange) {
          state.error = null;
          return;
        }

        state.user = action.payload;
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
        // If the session's user metadata requires a password change, do not set user
        if (action.payload && (action.payload as any).forcePasswordChange) {
          state.loading = false;
          return;
        }

        state.user = action.payload;
        state.loading = false;
      });
  },
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;