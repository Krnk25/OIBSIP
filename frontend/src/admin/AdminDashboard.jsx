import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import API from '../services/api';

const socket = io('http://localhost:5000');
const ORDER_STATUSES = ['Order Received', 'In the Kitchen', 'Sent to Delivery', 'Delivered'];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [newIng, setNewIng] = useState({ name: '', category: 'veggie', price: 30, stock: 50, threshold: 20 });

  const fetchData = async () => {
    try {
      const [ordersRes, ingRes] = await Promise.all([
        API.get('/orders'),
        API.get('/pizzas/ingredients'),
      ]);
      setOrders(ordersRes.data);
      setIngredients(ingRes.data);
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  };

  useEffect(() => {
    fetchData();

    // Real-time listener for newly placed customer orders
    socket.on('newOrderPlaced', (newOrder) => {
      setOrders((prev) => [newOrder, ...prev]);
      fetchData(); // Refresh stock counts after atomic deduction
    });

    return () => socket.off('newOrderPlaced');
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const { data } = await API.put(`/orders/${orderId}/status`, { orderStatus: newStatus });
      setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, orderStatus: data.orderStatus } : o)));
    } catch (error) {
      alert('Failed to update order status');
    }
  };

  const handleRestock = async (id, currentStock) => {
    try {
      const { data } = await API.put(`/pizzas/ingredients/${id}`, { stock: currentStock + 25 });
      setIngredients((prev) => prev.map((item) => (item._id === id ? data : item)));
    } catch (error) {
      alert('Failed to update stock');
    }
  };

  const handleAddIngredient = async (e) => {
    e.preventDefault();
    try {
      const { data } = await API.post('/pizzas/ingredients', newIng);
      setIngredients((prev) => [...prev, data]);
      setNewIng({ name: '', category: 'veggie', price: 30, stock: 50, threshold: 20 });
      alert('✅ Ingredient added to inventory!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error adding ingredient');
    }
  };

  const lowStockCount = ingredients.filter((i) => i.stock <= i.threshold).length;

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1>Kitchen & Inventory Admin Panel 👨‍🍳</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('orders')}
            className={`btn ${activeTab === 'orders' ? '' : 'btn-outline'}`}
          >
            Live Orders ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`btn ${activeTab === 'inventory' ? '' : 'btn-outline'}`}
          >
            Inventory Stock {lowStockCount > 0 && `⚠️ (${lowStockCount} Low)`}
          </button>
        </div>
      </div>

      {activeTab === 'orders' ? (
        <div>
          {orders.length === 0 ? (
            <div className="card">No orders received yet.</div>
          ) : (
            orders.map((order) => (
              <div key={order._id} className="card" style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3>Order #{order._id.slice(-6).toUpperCase()} — ₹{order.totalAmount}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      Customer: <strong>{order.user?.name || 'Guest'}</strong> ({order.user?.email}) | Address: {order.deliveryAddress}
                    </p>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', display: 'block', fontWeight: 'bold' }}>Update Kitchen Status:</label>
                    <select
                      className="input"
                      style={{ margin: '4px 0 0', padding: '8px' }}
                      value={order.orderStatus}
                      onChange={(e) => handleStatusChange(order._id, e.target.value)}
                    >
                      {ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                  {order.items.map((item, idx) => (
                    <div key={idx} style={{ fontSize: '14px', marginBottom: '4px' }}>
                      <strong>• {item.name}</strong> ({item.size}) — ₹{item.price}
                      {item.isCustom && item.customDetails && (
                        <span style={{ color: 'var(--muted)', marginLeft: '8px' }}>
                          [{item.customDetails.base?.name}, {item.customDetails.sauce?.name}, {item.customDetails.cheese?.name}
                          {item.customDetails.veggies?.length > 0 && `, Veggies: ${item.customDetails.veggies.map((v) => v.name).join(', ')}`}]
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div>
          {/* Add New Ingredient Form */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '10px' }}>+ Add New Inventory Item</h3>
            <form onSubmit={handleAddIngredient} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '12px' }}>Item Name</label>
                <input className="input" style={{ margin: 0 }} required placeholder="e.g. Garlic Crust" value={newIng.name} onChange={(e) => setNewIng({ ...newIng, name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '12px' }}>Category</label>
                <select className="input" style={{ margin: 0 }} value={newIng.category} onChange={(e) => setNewIng({ ...newIng, category: e.target.value })}>
                  <option value="base">Base</option>
                  <option value="sauce">Sauce</option>
                  <option value="cheese">Cheese</option>
                  <option value="veggie">Veggie</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px' }}>Price (₹)</label>
                <input className="input" style={{ margin: 0 }} type="number" required value={newIng.price} onChange={(e) => setNewIng({ ...newIng, price: Number(e.target.value) })} />
              </div>
              <div>
                <label style={{ fontSize: '12px' }}>Initial Stock</label>
                <input className="input" style={{ margin: 0 }} type="number" required value={newIng.stock} onChange={(e) => setNewIng({ ...newIng, stock: Number(e.target.value) })} />
              </div>
              <button type="submit" className="btn">Add Item</button>
            </form>
          </div>

          {/* Inventory Grid */}
          <div className="grid">
            {ingredients.map((item) => {
              const isLow = item.stock <= item.threshold;
              return (
                <div
                  key={item._id}
                  className="card"
                  style={{ borderLeft: `5px solid ${isLow ? '#e63946' : '#2a9d8f'}` }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="badge" style={{ textTransform: 'uppercase' }}>{item.category}</span>
                    {isLow && <span style={{ color: '#e63946', fontWeight: 'bold', fontSize: '12px' }}>⚠️ LOW STOCK</span>}
                  </div>
                  <h3 style={{ margin: '8px 0' }}>{item.name}</h3>
                  <p style={{ fontSize: '14px', color: 'var(--muted)' }}>Price: ₹{item.price} | Threshold: {item.threshold}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', color: isLow ? '#e63946' : 'inherit' }}>
                      Stock: {item.stock}
                    </span>
                    <button onClick={() => handleRestock(item._id, item.stock)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                      +25 Restock
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}