import { combineReducers, configureStore } from '@reduxjs/toolkit'
import counterReducer from './coutNumber/index'
import storage from 'redux-persist/lib/storage';
import persistReducer from 'redux-persist/es/persistReducer';
import { FLUSH, PAUSE, PERSIST, PURGE, REGISTER, REHYDRATE } from 'redux-persist';
import persistStore from 'redux-persist/es/persistStore';
import  UserReducer  from './login/index';

const persistConfig = {
  key: 'root',
  storage,
  whitelist:['counter',"userInfo"]
};

const rootReducer = combineReducers({
  counter: counterReducer,
  userInfo:UserReducer, 
  roles: UserReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;