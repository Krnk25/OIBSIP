import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <Link to="/" style={{ marginLeft: 0, fontSize: '22px', fontWeight: 'bold' }}>
        🍕 Pizza House
      </Link>
      <div>
        {user ? (
          <>
            {user.role === 'admin' ? (
              <Link to="/admin">Admin Dashboard</Link>
            ) : (
              <>
                <Link to="/">Menu</Link>
                <Link to="/build-pizza">Custom Builder</Link>
                <Link to="/cart">Cart ({cart.length})</Link>
                <Link to="/my-orders">My Orders</Link>
              </>
            )}
            <button
              onClick={handleLogout}
              className="btn"
              style={{ marginLeft: '20px', padding: '6px 14px' }}
            >
              Logout ({user.name})
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}