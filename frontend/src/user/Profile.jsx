import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API from '../services/api';

const ADDRESS_KEY = 'pizzaDeliveryAddresses';
const MOBILE_KEY = 'pizzaUserMobile';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    mobile: '',
  });

  const [addresses, setAddresses] = useState([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    address: '',
    city: '',
    pincode: '',
  });

  const [ordersCount, setOrdersCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const savedMobile = localStorage.getItem(MOBILE_KEY) || '';
    setProfile({
      name: user?.name || '',
      email: user?.email || '',
      mobile: user?.mobile || user?.phone || savedMobile,
    });

    try {
      const saved = JSON.parse(localStorage.getItem(ADDRESS_KEY) || '[]');
      if (Array.isArray(saved)) {
        setAddresses(saved);
      } else {
        setAddresses([]);
      }
    } catch {
      setAddresses([]);
    }
  }, [user]);

  useEffect(() => {
    let active = true;

    API.get('/orders/my-orders')
      .then(({ data }) => {
        if (!active) return;

        const orders = Array.isArray(data) ? data : data?.orders || [];
        setOrdersCount(orders.length);

        setTotalSpent(
          orders.reduce(
            (sum, order) =>
              sum + Number(order.totalAmount ?? order.totalPrice ?? 0),
            0
          )
        );
      })
      .catch(console.error)
      .finally(() => {
        if (active) setLoadingStats(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const saveAddresses = (updated) => {
    setAddresses(updated);
    localStorage.setItem(ADDRESS_KEY, JSON.stringify(updated));
  };

  const handleProfileSave = (e) => {
    e.preventDefault();
    localStorage.setItem(MOBILE_KEY, profile.mobile.trim());
    setMessage('Profile & mobile number saved for checkout.');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleAddressSave = (e) => {
    e.preventDefault();

    if (
      !addressForm.address.trim() ||
      !addressForm.city.trim() ||
      !addressForm.pincode.trim()
    ) {
      return;
    }

    const cleanForm = {
      label: addressForm.label,
      address: addressForm.address.trim(),
      city: addressForm.city.trim(),
      pincode: addressForm.pincode.trim(),
    };

    let updated;

    if (editingId !== null) {
      updated = addresses.map((item) =>
        item.id === editingId ? { ...item, ...cleanForm } : item
      );
    } else {
      const newAddress = {
        ...cleanForm,
        id: Date.now(),
        isDefault: addresses.length === 0,
      };
      updated = [...addresses, newAddress];
    }

    saveAddresses(updated);
    resetAddressForm();
  };

  const resetAddressForm = () => {
    setAddressForm({
      label: 'Home',
      address: '',
      city: '',
      pincode: '',
    });

    setEditingId(null);
    setShowAddressForm(false);
  };

  const editAddress = (item) => {
    setAddressForm({
      label: item.label,
      address: item.address,
      city: item.city,
      pincode: item.pincode,
    });

    setEditingId(item.id);
    setShowAddressForm(true);
  };

  const deleteAddress = (id) => {
    const updated = addresses.filter((item) => item.id !== id);

    if (
      addresses.find((item) => item.id === id)?.isDefault &&
      updated.length > 0
    ) {
      updated[0].isDefault = true;
    }

    saveAddresses(updated);
  };

  const setDefaultAddress = (id) => {
    saveAddresses(
      addresses.map((item) => ({
        ...item,
        isDefault: item.id === id,
      }))
    );
  };

  const handleLogout = () => {
    if (typeof logout === 'function') {
      logout();
    } else {
      ['pizzaUser', 'userInfo', 'user', 'token'].forEach((key) =>
        localStorage.removeItem(key)
      );
    }

    navigate('/login', { replace: true });
  };

  const inputStyle = {
    width: '100%',
    padding: '13px 15px',
    border: '1px solid #e2e8f0',
    borderRadius: '11px',
    background: '#f8fafc',
    outline: 'none',
    fontSize: '14px',
    boxSizing: 'border-box',
    color: '#1e293b',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 700,
    color: '#334155',
    marginBottom: '8px',
  };

  const cardStyle = {
    background: '#fff',
    borderRadius: '18px',
    padding: '25px',
    border: '1px solid #edf0f5',
    boxShadow: '0 5px 25px rgba(15,23,42,.045)',
    marginBottom: '20px',
  };

  const primaryButton = {
    padding: '12px 20px',
    border: 'none',
    borderRadius: '11px',
    background: '#f97316',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f7fc',
        padding: '35px 16px 55px',
        fontFamily: 'Inter, Arial, sans-serif',
      }}
    >
      <div style={{ maxWidth: '950px', margin: 'auto' }}>
        {/* Heading */}
        <div style={{ marginBottom: 25 }}>
          <p
            style={{
              color: '#f97316',
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: 2,
            }}
          >
            ACCOUNT SETTINGS
          </p>

          <h1
            style={{
              color: '#172554',
              fontSize: 32,
              margin: '5px 0',
            }}
          >
            My Profile
          </h1>

          <p style={{ color: '#64748b', fontSize: 14 }}>
            Manage your personal information and delivery addresses.
          </p>
        </div>

        {/* Profile Header */}
        <div
          style={{
            ...cardStyle,
            background: 'linear-gradient(120deg,#172554,#312e81)',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 18,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 17,
            }}
          >
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: 20,
                display: 'grid',
                placeItems: 'center',
                background: '#f97316',
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              {(profile.name || 'U')[0].toUpperCase()}
            </div>

            <div>
              <h2 style={{ margin: '0 0 7px' }}>
                {profile.name || 'Welcome User'}
              </h2>
              <p
                style={{
                  margin: '0 0 8px',
                  color: '#cbd5e1',
                  fontSize: 13,
                }}
              >
                {profile.email || 'Email not available'}
              </p>
              <span
                style={{
                  color: '#fed7aa',
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}
              >
                ● {user?.role || 'Customer'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Link
              to="/my-orders"
              style={{
                ...primaryButton,
                textDecoration: 'none',
              }}
            >
              My Orders
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                ...primaryButton,
                background: '#dc3545',
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
            gap: 16,
            marginBottom: 20,
          }}
        >
          {[
            {
              title: 'Total Orders',
              value: loadingStats ? '...' : ordersCount,
              icon: '🛍️',
            },
            {
              title: 'Total Spent',
              value: loadingStats
                ? '...'
                : `₹${totalSpent.toLocaleString('en-IN')}`,
              icon: '💰',
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                ...cardStyle,
                marginBottom: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <p style={{ color: '#64748b', fontSize: 14 }}>{item.title}</p>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 30,
                      color: '#172554',
                    }}
                  >
                    {item.value}
                  </h2>
                </div>
                <span style={{ fontSize: 30 }}>{item.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Personal Information */}
        <div style={cardStyle}>
          <h3 style={{ color: '#172554', marginTop: 0 }}>
            👤 Personal Information
          </h3>

          <p
            style={{
              color: '#94a3b8',
              fontSize: 13,
              marginBottom: 22,
            }}
          >
            Your basic account details
          </p>

          <form onSubmit={handleProfileSave}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
                gap: 18,
              }}
            >
              <div>
                <label style={labelStyle}>Full Name</label>
                <input
                  style={inputStyle}
                  value={profile.name}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      name: e.target.value,
                    })
                  }
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Email Address</label>
                <input
                  type="email"
                  style={inputStyle}
                  value={profile.email}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      email: e.target.value,
                    })
                  }
                  placeholder="Enter your email"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>Mobile Number</label>
                <input
                  type="tel"
                  style={inputStyle}
                  value={profile.mobile}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      mobile: e.target.value,
                    })
                  }
                  placeholder="Enter mobile number"
                  maxLength={10}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{
                ...primaryButton,
                marginTop: 20,
              }}
            >
              Save Profile
            </button>

            {message && (
              <p style={{ color: '#059669', fontSize: 13, marginTop: 10 }}>
                {message}
              </p>
            )}
          </form>
        </div>

        {/* Address Section */}
        <div style={cardStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <h3
                style={{
                  color: '#172554',
                  margin: '0 0 7px',
                }}
              >
                📍 My Delivery Addresses
              </h3>
              <p
                style={{
                  color: '#94a3b8',
                  fontSize: 13,
                  margin: 0,
                }}
              >
                Manage multiple delivery locations
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                resetAddressForm();
                setShowAddressForm(true);
              }}
              style={primaryButton}
            >
              + Add New Address
            </button>
          </div>

          {/* Add / Edit Address Form */}
          {showAddressForm && (
            <form
              onSubmit={handleAddressSave}
              style={{
                background: '#f8fafc',
                padding: 20,
                borderRadius: 15,
                marginTop: 22,
                border: '1px solid #e2e8f0',
              }}
            >
              <h4 style={{ color: '#172554', marginTop: 0 }}>
                {editingId !== null ? 'Edit Address' : 'Add New Address'}
              </h4>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                  gap: 15,
                }}
              >
                <div>
                  <label style={labelStyle}>Address Type</label>
                  <select
                    style={inputStyle}
                    value={addressForm.label}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
                        label: e.target.value,
                      })
                    }
                  >
                    <option>Home</option>
                    <option>Work</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Street / House Address</label>
                  <input
                    style={inputStyle}
                    value={addressForm.address}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
                        address: e.target.value,
                      })
                    }
                    placeholder="House no, street, area"
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>City</label>
                  <input
                    style={inputStyle}
                    value={addressForm.city}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
                        city: e.target.value,
                      })
                    }
                    placeholder="Enter city"
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>Pincode</label>
                  <input
                    style={inputStyle}
                    value={addressForm.pincode}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
                        pincode: e.target.value,
                      })
                    }
                    placeholder="Enter pincode"
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  marginTop: 18,
                }}
              >
                <button type="submit" style={primaryButton}>
                  Save Address
                </button>

                <button
                  type="button"
                  onClick={resetAddressForm}
                  style={{
                    ...primaryButton,
                    background: '#64748b',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Saved Addresses */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
              gap: 15,
              marginTop: 22,
            }}
          >
            {addresses.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: 18,
                  borderRadius: 15,
                  border: item.isDefault
                    ? '2px solid #f97316'
                    : '1px solid #e2e8f0',
                  background: item.isDefault ? '#fff7ed' : '#fff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <strong style={{ color: '#172554' }}>📍 {item.label}</strong>

                  {item.isDefault && (
                    <span
                      style={{
                        fontSize: 10,
                        color: '#ea580c',
                        fontWeight: 800,
                      }}
                    >
                      DEFAULT
                    </span>
                  )}
                </div>

                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: '#64748b',
                  }}
                >
                  {item.address}
                  <br />
                  {item.city} - {item.pincode}
                </p>

                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => editAddress(item)}
                    style={{
                      border: 0,
                      background: 'none',
                      color: '#2563eb',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteAddress(item.id)}
                    style={{
                      border: 0,
                      background: 'none',
                      color: '#dc2626',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    Delete
                  </button>

                  {!item.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefaultAddress(item.id)}
                      style={{
                        border: 0,
                        background: 'none',
                        color: '#ea580c',
                        cursor: 'pointer',
                        fontWeight: 700,
                      }}
                    >
                      Set Default
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {addresses.length === 0 && !showAddressForm && (
            <div
              style={{
                textAlign: 'center',
                padding: '35px 10px',
                color: '#94a3b8',
              }}
            >
              <div style={{ fontSize: 40 }}>📍</div>
              <p>No saved addresses yet.</p>
              <p style={{ fontSize: 12 }}>
                Click Add New Address to get started.
              </p>
            </div>
          )}
        </div>

        <p
          style={{
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: 12,
          }}
        >
          🍕 Made with love for pizza lovers
        </p>
      </div>
    </div>
  );
}