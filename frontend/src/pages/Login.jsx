import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await API.post('/auth/login', { email, password });
      login(data);
      navigate(data.role === 'admin' ? '/admin' : '/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="container" style={{ maxWidth: '420px', marginTop: '40px' }}>
      <div className="card">
        <h2 style={{ marginBottom: '15px' }}>Welcome Back 🍕</h2>
        {error && <p style={{ color: 'red', marginBottom: '10px' }}>{error}</p>}
        <form onSubmit={handleSubmit}>
          <label>Email</label>
          <input
            className="input"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label>Password</label>
          <input
            className="input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn" style={{ width: '100%' }}>
            Login
          </button>
        </form>
        <p style={{ marginTop: '15px', textAlign: 'center' }}>
          New to Pizza House? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}