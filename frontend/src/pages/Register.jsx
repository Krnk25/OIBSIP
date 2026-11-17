import { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { data } = await API.post('/auth/register', form);
      setMessage(data.message);
      setForm({ name: '', email: '', password: '', role: 'user' });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '450px', marginTop: '40px' }}>
      <div className="card">
        <h2 style={{ marginBottom: '15px' }}>Create Account 🍕</h2>

        {error && (
          <p style={{ color: '#e63946', background: '#ffe5ec', padding: '10px', borderRadius: '6px', marginBottom: '12px' }}>
            {error}
          </p>
        )}

        {message && (
          <div style={{ background: '#e6fcf5', padding: '14px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #2a9d8f' }}>
            <p style={{ color: '#0ca678', fontWeight: 'bold' }}>📧 {message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label>Full Name</label>
          <input
            className="input"
            type="text"
            required
            placeholder="Enter your full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <label>Email</label>
          <input
            className="input"
            type="email"
            required
            placeholder="Enter your Gmail address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <label>Password</label>
          <input
            className="input"
            type="password"
            required
            minLength={6}
            placeholder="Minimum 6 characters"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <label>Account Type</label>
          <select
            className="input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="user">Customer (User)</option>
            <option value="admin">Kitchen Admin</option>
          </select>

          <button type="submit" disabled={loading} className="btn" style={{ width: '100%' }}>
            {loading ? 'Sending Verification Email...' : 'Register'}
          </button>
        </form>

        <p style={{ marginTop: '15px', textAlign: 'center' }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}