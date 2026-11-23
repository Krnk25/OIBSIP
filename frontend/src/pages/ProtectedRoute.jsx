import { Navigate } from 'react-router-dom';

const getCurrentUser = () => {
  try {
    const raw =
      localStorage.getItem('pizzaUser') ||
      localStorage.getItem('userInfo') ||
      localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user || parsed?.data?.user || parsed;
  } catch {
    return null;
  }
};

// Sirf logged-in user ke liye
export function UserRoute({ children }) {
  const user = getCurrentUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Sirf admin ke liye
export function AdminRoute({ children }) {
  const user = getCurrentUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (String(user.role || '').toLowerCase() !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
}