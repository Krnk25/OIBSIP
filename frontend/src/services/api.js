import axios from "axios";

const BACKEND_ORIGIN = String(
  import.meta.env.VITE_SOCKET_URL || "https://oibsip-njyj.onrender.com",
).replace(/\/+$/, "");

const API_BASE_URL = String(
  import.meta.env.VITE_API_URL || `${BACKEND_ORIGIN}/api`,
).replace(/\/+$/, "");

const API = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 60000,
});

const getStoredToken = () => {
  const keys = ["pizzaUser", "userInfo", "user", "token"];

  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      const token =
        parsed?.token ||
        parsed?.data?.token ||
        parsed?.user?.token ||
        (typeof parsed === "string" ? parsed : null);

      if (token) {
        return String(token).replace(/^Bearer\s+/i, "").trim();
      }
    } catch {
      const cleaned = String(raw).replace(/^Bearer\s+/i, "").trim();
      if (cleaned) return cleaned;
    }
  }

  return null;
};

API.interceptors.request.use(
  (req) => {
    const token = getStoredToken();
    if (token) {
      req.headers = req.headers || {};
      req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
  },
  (error) => Promise.reject(error),
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const authHeader = error?.config?.headers?.Authorization || "";
      if (authHeader) {
        ["pizzaUser", "userInfo", "user", "token"].forEach((k) => {
          const val = localStorage.getItem(k);
          if (val) {
            try {
              const obj = JSON.parse(val);
              if (obj && typeof obj === "object" && "token" in obj) {
                delete obj.token;
                localStorage.setItem(k, JSON.stringify(obj));
              }
            } catch {
              if (k === "token") localStorage.removeItem(k);
            }
          }
        });
      }
    }
    return Promise.reject(error);
  },
);

export { BACKEND_ORIGIN, API_BASE_URL, getStoredToken };
export default API;