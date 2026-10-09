import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { persistor, store } from "./store/store";
import "./styles/global.scss";
import { StyledEngineProvider } from "@mui/material";
import App from "./App";
import { ToastContainer } from "react-toastify";


ReactDOM.createRoot(document.getElementById("root")!).render(
  <Provider store={store}>
    <StyledEngineProvider>
      <PersistGate loading={null} persistor={persistor}>
      <ToastContainer />
          <App/>
      </PersistGate>
    </StyledEngineProvider>
  </Provider>
);
