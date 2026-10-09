import { createSlice } from "@reduxjs/toolkit";

export interface LoginState {
  userInfo: any;
  token: string;
  roles: {
    roles: any[];
  };
}

const initialState: LoginState = {
  userInfo: null,
  token: "",
  roles: {
    roles: [],
  },
};

export const User = createSlice({
  name: "userInfo",
  initialState,
  reducers: {
    setUserInfo: (state, action) => {
      console.log(action,'ffff')
      state.userInfo = action.payload;
    },
    setToken: (state, action) => {
      state.token = action.payload;
    },
    setRoles: (state, action) => {
      state.roles = action.payload;
    },
  },
});

export const { setUserInfo, setToken, setRoles } = User.actions;

export const getUserInfo = (state: any) => state.userInfo;
export const getListRoles = (state: any) => state.roles.roles;
export const getToken = (state: any) => state.userInfo.token;

export default User.reducer;
