import axios from 'axios';

const API = axios.create({
  baseURL: 'http://10.191.114.156:5000/api',
});

API.interceptors.request.use((req) => {
  const userInfo = localStorage.getItem('pizzaUser');
  if (userInfo) {
    const { token } = JSON.parse(userInfo);
    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }
  }
  return req;
});

export default API;