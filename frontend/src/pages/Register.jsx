import { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import './Register.css';

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user'
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false); // ✅ यह ट्रैक करने के लिए कि रजिस्ट्रेशन हो गया है या नहीं

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { data } = await API.post('/auth/register', form);
      setMessage(data.message || 'Registration successful! Please check your email to verify.');
      setIsRegistered(true); // ✅ फॉर्म छिपाकर वेरिफिकेशन का मैसेज दिखाने के लिए
    } catch (err) {
      setError(
        err.response?.data?.message || 'Registration failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">

      <div className="register-left">
        <div className="brand-logo">
          🍕 Pizza<span>Zone</span>
        </div>

        <div className="hero-content">
          <span className="hero-tag">FRESH • HOT • DELICIOUS</span>

          <h1>
            Happiness is
            <span> a Slice of Pizza!</span>
          </h1>

          <p>
            Create your account and discover delicious pizzas
            delivered fresh and hot to your doorstep.
          </p>

          <div className="pizza-image">
            🍕
          </div>

          <div className="hero-bottom">
            <span>🔥 Freshly Baked</span>
            <span>🚀 Fast Delivery</span>
          </div>
        </div>
      </div>

      <div className="register-right">

        <div className="register-card">

          <div className="mobile-logo">
            🍕 PizzaZone
          </div>

          <div className="form-heading">
            <span className="welcome-text">WELCOME TO PIZZAZONE</span>
            <h2>Create Account</h2>
            <p>Join us and enjoy your favourite pizza!</p>
          </div>

          {error && (
            <div className="register-error">
              ⚠️ {error}
            </div>
          )}

          {message && (
            <div className="register-success">
              ✅ {message}
            </div>
          )}

          <form onSubmit={handleSubmit}>

            <div className="form-group">
              <label>Full Name</label>
              <div className="input-box">
                <span>👤</span>
                <input
                  type="text"
                  placeholder="Enter your full name"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <div className="input-box">
                <span>✉️</span>
                <input
                  type="email"
                  placeholder="Enter your email"
                  required
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="input-box">
                <span>🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Account Type</label>
              <div className="input-box">
                <span>👨‍🍳</span>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value })
                  }
                >
                  <option value="user">Customer Account</option>
                  <option value="admin">Kitchen Admin</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="register-btn"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account →'}
            </button>

          </form>

          <div className="login-link">
            Already have an account?
            <Link to="/login"> Login Now</Link>
          </div>

          <div className="register-footer">
            © 2026 PizzaZone. Made with ❤️ for pizza lovers.
          </div>

        </div>
      </div>

    </div>
  );
}
