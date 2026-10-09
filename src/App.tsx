import React, { useEffect, useState } from "react";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { RouterProvider } from "react-router-dom";
import { router } from "@/router";
import { LoadingProgress } from "@/page/loading";
import { LocalizationProvider } from "@mui/x-date-pickers";
import "react-toastify/dist/ReactToastify.css";
import { DialogView } from "./components/dialog";
import { ToastView } from "./components/toast";
import { onAuthStateChanged } from "firebase/auth";
import LoginPage from "./page/login";
import { auth } from "../firebase";

const App: React.FC = () => {
  const [isLogin, setIsLogin] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setIsLogin(!!user?.uid);
    });
  }, []);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      {!isLogin ? <LoginPage /> : <RouterProvider router={router} />}
      <LoadingProgress />
      <DialogView />
      <ToastView />
    </LocalizationProvider>
  );
};

export default App;
