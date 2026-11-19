import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import auth, { signedOut, signedIn } from './authSlice.js';
import ui from './uiSlice.js';
import { api } from './api.js';

export const store = configureStore({
  reducer: { auth, ui, [api.reducerPath]: api.reducer },
  middleware: (getDefault) =>
    getDefault().concat(api.middleware, (storeApi) => (next) => (action) => {
      const result = next(action);
      // A new session (or none) means every cached response may now be wrong for this viewer.
      if (signedOut.match(action) || signedIn.match(action)) storeApi.dispatch(api.util.resetApiState());
      return result;
    }),
});

setupListeners(store.dispatch);
