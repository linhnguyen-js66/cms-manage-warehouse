export const Authorization = {
  saveToken: (token: string) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('refresh_token', token);
  },
  getToken: () => {
    return localStorage.getItem('access_token');
  },
  removeToken: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};
