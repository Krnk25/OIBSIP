import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { useCart } from '../context/CartContext';

export default function Menu() {
  const [pizzas, setPizzas] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState({});
  const { addToCart } = useCart();

  useEffect(() => {
    API.get('/pizzas')
      .then((res) => {
        setPizzas(res.data);
        const initialSizes = {};
        res.data.forEach((p) => (initialSizes[p._id] = 'medium'));
        setSelectedSizes(initialSizes);
      })
      .catch((err) => console.error(err));
  }, []);

  const handleAdd = (pizza) => {
    const size = selectedSizes[pizza._id] || 'medium';
    addToCart({
      name: pizza.name,
      isCustom: false,
      size,
      quantity: 1,
      price: pizza.prices[size],
    });
    alert(`✅ Added ${pizza.name} (${size}) to Cart!`);
  };

  return (
    <div className="container">
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #1d3557, #e63946)',
          color: 'white',
          marginBottom: '30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px',
        }}
      >
        <div>
          <h1>Craft Your Dream Pizza 🍕</h1>
          <p>Choose from 5 bases, 5 signature sauces, rich cheeses, and fresh veggies.</p>
        </div>
        <Link to="/build-pizza" className="btn" style={{ background: '#ffb703', color: '#1d3557' }}>
          ✨ Open Custom Pizza Builder
        </Link>
      </div>

      <h2 style={{ marginBottom: '20px' }}>Signature Pizza Varieties</h2>
      <div className="grid">
        {pizzas.map((pizza) => {
          const currentSize = selectedSizes[pizza._id] || 'medium';
          return (
            <div key={pizza._id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <img
                  src={pizza.image}
                  alt={pizza.name}
                  style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '12px' }}
                />
                <span className="badge">{pizza.category}</span>
                <h3 style={{ margin: '8px 0' }}>{pizza.name}</h3>
                <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '14px' }}>{pizza.description}</p>
              </div>

              <div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                  {['small', 'medium', 'large'].map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setSelectedSizes({ ...selectedSizes, [pizza._id]: sz })}
                      className={`btn btn-outline ${currentSize === sz ? 'active' : ''}`}
                      style={{ flex: 1, padding: '6px', fontSize: '12px', textTransform: 'capitalize' }}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '20px', fontWeight: 'bold' }}>₹{pizza.prices[currentSize]}</span>
                  <button onClick={() => handleAdd(pizza)} className="btn">
                    + Add to Cart
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}