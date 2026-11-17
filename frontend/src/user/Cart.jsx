import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function Cart() {
  const { cart, removeFromCart, clearCart, totalAmount } = useCart();
  const { user } = useAuth();
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCheckout = async () => {
    if (!address.trim()) return alert('Please enter your delivery address!');
    setLoading(true);

    try {
      // 1. Create Razorpay Order on Backend
      const { data: rzpOrder } = await API.post('/orders/razorpay', { amount: totalAmount });

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        amount: rzpOrder.amount,
        currency: 'INR',
        name: 'Pizza House 🍕',
        description: 'Fresh Pizza Order Payment',
        order_id: rzpOrder.id,
        handler: async function (response) {
          // 3. Verify Signature & Deduct Stock Atomically on Backend
          await API.post('/orders/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            items: cart,
            deliveryAddress: address,
            totalAmount,
          });

          clearCart();
          alert('🎉 Payment Verified & Order Placed!');
          navigate('/my-orders');
        },
        prefill: {
          name: user?.name,
          email: user?.email,
        },
        theme: { color: '#e63946' },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      alert(error.response?.data?.message || 'Checkout failed. Check Razorpay keys in .env');
    } finally {
      setLoading(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>
        <div className="card">
          <h2>Your Cart is Empty 🛒</h2>
          <p style={{ margin: '15px 0' }}>Add some delicious pizzas or build your own!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <h1 style={{ marginBottom: '20px' }}>Your Cart & Checkout 🛒</h1>
      {cart.map((item) => (
        <div key={item.cartId} className="card" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>{item.name} ({item.size})</h3>
            {item.isCustom && item.customDetails && (
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Base: {item.customDetails.base?.name} | Sauce: {item.customDetails.sauce?.name} | Cheese: {item.customDetails.cheese?.name}
                {item.customDetails.veggies?.length > 0 && ` | Veggies: ${item.customDetails.veggies.map((v) => v.name).join(', ')}`}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <strong>₹{item.price}</strong>
            <button onClick={() => removeFromCart(item.cartId)} className="btn" style={{ background: '#6c757d', padding: '6px 12px' }}>
              Remove
            </button>
          </div>
        </div>
      ))}

      <div className="card" style={{ marginTop: '20px' }}>
        <label><strong>Delivery Address</strong></label>
        <textarea
          className="input"
          rows="3"
          placeholder="Enter full street address, landmark, and city..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
          <h2>Total Payable: ₹{totalAmount}</h2>
          <button onClick={handleCheckout} disabled={loading} className="btn">
            {loading ? 'Processing...' : 'Pay Now with Razorpay 💳'}
          </button>
        </div>
      </div>
    </div>
  );
}