import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import API from '../services/api';

const socket = io('http://localhost:5000');
const STATUS_STEPS = ['Order Received', 'In the Kitchen', 'Sent to Delivery', 'Delivered'];

export default function MyOrders() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    API.get('/orders/my-orders')
      .then((res) => setOrders(res.data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    orders.forEach((order) => {
      socket.on(`orderStatusUpdated_${order._id}`, (updatedOrder) => {
        setOrders((prev) =>
          prev.map((o) => (o._id === updatedOrder._id ? updatedOrder : o))
        );
      });
    });

    return () => {
      orders.forEach((order) => socket.off(`orderStatusUpdated_${order._id}`));
    };
  }, [orders]);

  return (
    <div className="container">
      <h1 style={{ marginBottom: '20px' }}>My Orders & Live Tracking 🛵</h1>
      {orders.length === 0 ? (
        <div className="card">No orders placed yet.</div>
      ) : (
        orders.map((order) => {
          const currentStepIdx = STATUS_STEPS.indexOf(order.orderStatus);
          return (
            <div key={order._id} className="card" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <strong>Order ID: #{order._id.slice(-6).toUpperCase()}</strong>
                  <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    {new Date(order.createdAt).toLocaleString()} • Address: {order.deliveryAddress}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge">{order.orderStatus}</span>
                  <h3 style={{ marginTop: '5px' }}>₹{order.totalAmount}</h3>
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                {order.items.map((item, idx) => (
                  <p key={idx} style={{ fontSize: '14px' }}>• {item.name} ({item.size}) — ₹{item.price}</p>
                ))}
              </div>

              {/* Live Progress Tracker */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                {STATUS_STEPS.map((step, index) => (
                  <div
                    key={step}
                    style={{
                      flex: 1,
                      padding: '8px',
                      textAlign: 'center',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: index <= currentStepIdx ? '#2a9d8f' : '#e2e8f0',
                      color: index <= currentStepIdx ? 'white' : '#6c757d',
                    }}
                  >
                    {step}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}