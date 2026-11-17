import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import API from '../services/api';

export default function VerifyEmail() {
  const { token } = useParams();
  const [status, setStatus] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/auth/verify/${token}`);
      setStatus(res.data.message);
      setIsVerified(true);
    } catch (err) {
      setStatus(err.response?.data?.message || 'Verification failed or link expired.');
      setIsVerified(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '450px', marginTop: '50px', textAlign: 'center' }}>
      <div className="card">
        <h2>Email Verification 🍕</h2>

        {!isVerified ? (
          <>
            <p style={{ margin: '15px 0', color: 'var(--muted)' }}>
              Tap the button below to verify your email address.
            </p>
            <button onClick={handleVerify} disabled={loading} className="btn" style={{ width: '100%' }}>
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
            {status && (
              <p style={{ marginTop: '15px', color: '#e63946', fontWeight: 'bold' }}>{status}</p>
            )}
          </>
        ) : (
          <>
            <p style={{ margin: '20px 0', fontWeight: 'bold', fontSize: '18px', color: '#2a9d8f' }}>
              ✅ {status}
            </p>
            <Link to="/login" className="btn" style={{ display: 'inline-block', width: '100%' }}>
              Go to Login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}