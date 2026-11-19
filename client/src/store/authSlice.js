import { createSlice } from '@reduxjs/toolkit';

const KEY = 'homeroom.session';

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return saved?.token ? saved : { token: null, user: null };
  } catch {
    return { token: null, user: null };
  }
}
const persist = (state) => {
  try {
    if (state.token) localStorage.setItem(KEY, JSON.stringify({ token: state.token, user: state.user }));
    else localStorage.removeItem(KEY);
  } catch { /* private mode: stay signed in for this tab only */ }
};

const authSlice = createSlice({
  name: 'auth',
  initialState: load(),
  reducers: {
    signedIn(state, { payload }) {
      state.token = payload.token;
      state.user = payload.user;
      persist(state);
    },
    userUpdated(state, { payload }) {
      state.user = payload;
      persist(state);
    },
    signedOut(state) {
      state.token = null;
      state.user = null;
      persist(state);
    },
  },
});

export const { signedIn, userUpdated, signedOut } = authSlice.actions;
export const selectUser = (state) => state.auth.user;
export const selectToken = (state) => state.auth.token;
export default authSlice.reducer;
