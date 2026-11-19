import { createSlice, nanoid } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: { toasts: [] },
  reducers: {
    toastAdded: {
      reducer(state, { payload }) {
        state.toasts = [...state.toasts.slice(-3), payload];
      },
      prepare: (toast) => ({ payload: { id: nanoid(6), type: 'info', ...toast } }),
    },
    toastDismissed(state, { payload }) {
      state.toasts = state.toasts.filter((t) => t.id !== payload);
    },
  },
});

export const { toastAdded, toastDismissed } = uiSlice.actions;
export default uiSlice.reducer;

/** dispatch(toast.success('Saved')) */
export const toast = {
  success: (message) => toastAdded({ type: 'success', message }),
  error: (message) => toastAdded({ type: 'error', message }),
  info: (message) => toastAdded({ type: 'info', message }),
};
