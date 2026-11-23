import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await API.post('/auth/login', {
        email,
        password,
      });

      const loggedInUser = await login(data);

      const role = String(
        data?.role ??
          data?.user?.role ??
          loggedInUser?.role ??
          'user'
      )
        .toLowerCase()
        .trim();

      if (role === 'admin') {
        navigate('/admin/AdminDashboard', { replace: true });
      } else {
       
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* LEFT SIDE */}
      <div className="login-left">
        <div className="login-brand">
          🍕 Pizza<span>Zone</span>
        </div>

        <div className="login-hero">
          <span className="login-tag">FRESH • HOT • DELICIOUS</span>

          <h1>
            Welcome Back,
            <span> Pizza Lover!</span>
          </h1>

          <p>
            Your favourite pizza is just one click away. Login and enjoy
            delicious food delivered fresh to your doorstep.
          </p>

          <div className="login-pizza">🍕</div>

          <div className="login-features">
            <span>🔥 Fresh Pizza</span>
            <span>🚀 Fast Delivery</span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-mobile-logo">🍕 PizzaZone</div>

          <div className="login-heading">
            <span className="login-welcome">WELCOME BACK</span>

            <h2>Login to Account</h2>

            <p>Enter your details to continue your journey.</p>
          </div>

          {error && <div className="login-error">⚠️ {error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="login-form-group">
              <label>Email Address</label>

              <div className="login-input-box">
                <span>✉️</span>

                <input
                  type="email"
                  placeholder="Enter your email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="login-form-group">
              <label>Password</label>

              <div className="login-input-box">
                <span>🔒</span>

                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button
                  type="button"
                  className="login-show-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login Now →'}
            </button>
          </form>

          <div className="login-register-text">
            New to PizzaZone?
            <Link to="/register"> Create Account</Link>
          </div>

          <div className="login-footer">
            © 2026 PizzaZone. Made with ❤️ for pizza lovers.
          </div>
        </div>
      </div>
    </div>
  );
}