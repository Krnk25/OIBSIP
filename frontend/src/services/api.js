import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
});

const getStoredToken = () => {
  const keys = ['pizzaUser', 'userInfo', 'user', 'token'];

  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const token =
        parsed?.token ||
        parsed?.data?.token ||
        parsed?.user?.token ||
        (typeof parsed === 'string' ? parsed : null);

      if (token) {
        return String(token).replace(/^Bearer\s+/i, '').trim();
      }
    } catch {
      return String(raw).replace(/^Bearer\s+/i, '').trim();
    }
  }

  return null;
};

API.interceptors.request.use((req) => {
  const token = getStoredToken();
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export default API;