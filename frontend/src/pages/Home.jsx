import { useEffect, useState } from 'react';
import API from '../services/api';
import { useCart } from '../context/CartContext';
import './Home.css';

export default function Home() {
  const [pizzas, setPizzas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSizes, setSelectedSizes] = useState({});
  const [addedPizzaId, setAddedPizzaId] = useState(null);
  const { addToCart } = useCart();

  const fetchPizzas = async () => {
    try {
      setLoading(true);
      setError('');

      const { data } = await API.get('/pizzas');
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.pizzas)
        ? data.pizzas
        : Array.isArray(data?.data)
        ? data.data
        : [];

      setPizzas(list);

      const initialSizes = {};
      list.forEach((pizza) => {
        initialSizes[pizza._id] = 'medium';
      });
      setSelectedSizes(initialSizes);
    } catch (err) {
      console.error('Error fetching pizzas:', err);
      setError(err.response?.data?.message || 'Could not load pizzas right now.');
      setPizzas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPizzas();
  }, []);

  const handleSizeChange = (pizzaId, size) => {
    setSelectedSizes((prev) => ({ ...prev, [pizzaId]: size }));
  };

  const handleAdd = (pizza, size) => {
    addToCart(pizza, size);
    setAddedPizzaId(pizza._id);
    setTimeout(() => {
      setAddedPizzaId((prev) => (prev === pizza._id ? null : prev));
    }, 900);
  };

  const filteredPizzas =
    selectedCategory === 'All'
      ? pizzas
      : pizzas.filter(
          (pizza) =>
            pizza.category?.toLowerCase() === selectedCategory.toLowerCase()
        );

  return (
    <div className="pizza-home">
      {/* Clean Hero Section */}
      <section className="pizza-hero">
        <div className="hero-panel">
          <div className="hero-content">
            <span className="hero-tag">🔥 WOOD-FIRED &amp; FRESH</span>

            <h1>
              Taste The <span>Happiness</span>
              <br />
              One Slice At A Time!
            </h1>

            <p>
              Hand-stretched dough, rich signature sauces, and melted cheese baked
              fresh for every order. Hot pizza delivered right to your door.
            </p>

            <a href="#pizza-menu" className="hero-btn">
              Explore Menu <span>→</span>
            </a>

            <div className="hero-features">
              <div>
                <strong>30 Min</strong>
                <small>Fast Delivery</small>
              </div>
              <div>
                <strong>100%</strong>
                <small>Fresh Quality</small>
              </div>
              <div>
                <strong>4.9 ⭐</strong>
                <small>Customer Rating</small>
              </div>
            </div>
          </div>

          <div className="hero-image">
            <div className="hero-showcase">
              <div className="hero-img-wrap">
                <img
                  src="https://images.unsplash.com/photo-1579751626657-72bc17010498?w=900"
                  alt="Delicious Wood-Fired Pizza"
                />
                <span className="hero-badge-top">🔥 Hot &amp; Fresh</span>
                <span className="hero-badge-rating">⭐ 4.9 Best Seller</span>
              </div>

              <div className="hero-img-caption">
                <div>
                  <strong>Margherita Wood-Fired</strong>
                  <span>Hand-tossed dough &amp; fresh mozzarella</span>
                </div>
                <span className="hero-tag-pill">Fresh Bake</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Menu Section */}
      <section className="menu-section" id="pizza-menu">
        <div className="menu-heading">
          <span>OUR SPECIAL MENU</span>
          <h2>
            Explore Our <b>Delicious Pizzas</b> 🍕
          </h2>
          <p>Handcrafted with love, baked to perfection.</p>

          {!loading && pizzas.length > 0 && (
            <div className="category-filters">
              {['All', 'Veg', 'Non-Veg'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`category-btn ${
                    selectedCategory === cat ? 'active' : ''
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="pizza-loading">
            <div className="loader"></div>
            Preparing your delicious menu...
          </div>
        ) : error ? (
          <div className="empty-menu">
            <h2>⚠️ Unable to Load Menu</h2>
            <p>{error}</p>
            <button type="button" onClick={fetchPizzas} className="retry-btn">
              Retry
            </button>
          </div>
        ) : filteredPizzas.length === 0 ? (
          <div className="empty-menu">
            <h2>🍕 No Pizzas Available</h2>
            <p>Please check back later!</p>
          </div>
        ) : (
          <div className="pizza-grid">
            {filteredPizzas.map((pizza) => {
              const currentSize = selectedSizes[pizza._id] || 'medium';
              const currentPrice = pizza.prices?.[currentSize];
              const isAdded = addedPizzaId === pizza._id;

              return (
                <div className="pizza-card" key={pizza._id}>
                  <div className="pizza-image-box">
                    <img
                      src={
                        pizza.image ||
                        'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800'
                      }
                      alt={pizza.name}
                    />

                    <span
                      className={`pizza-category ${
                        pizza.category?.toLowerCase() === 'veg'
                          ? 'veg'
                          : pizza.category?.toLowerCase() === 'non-veg'
                          ? 'nonveg'
                          : ''
                      }`}
                    >
                      {pizza.category}
                    </span>

                    <span className="popular-tag">⭐ Popular</span>
                  </div>

                  <div className="pizza-content">
                    <h3>{pizza.name}</h3>

                    <p className="pizza-description">{pizza.description}</p>

                    <div className="pizza-sizes">
                      {['small', 'medium', 'large'].map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => handleSizeChange(pizza._id, size)}
                          className={currentSize === size ? 'active' : ''}
                        >
                          {size}
                        </button>
                      ))}
                    </div>

                    <div className="pizza-bottom">
                      <div>
                        <span className="price-label">Starting from</span>
                        <span className="pizza-price">
                          {currentPrice != null ? `₹${currentPrice}` : 'N/A'}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="add-cart-btn"
                        disabled={currentPrice == null}
                        onClick={() => handleAdd(pizza, currentSize)}
                      >
                        {isAdded ? 'Added ✓' : '+ Add to Cart'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Bottom Banner */}
      <section className="offer-banner">
        <div>
          <span>🎉 SPECIAL OFFER</span>
          <h2>Good Food, Great Mood!</h2>
          <p>Order your favourite pizza and enjoy every bite.</p>
        </div>
        <a href="#pizza-menu">Order Now →</a>
      </section>
    </div>
  );
}