import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../services/api';
import { useCart } from '../context/CartContext';

export default function CustomPizzaBuilder() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedBase, setSelectedBase] = useState(null);
  const [selectedSauce, setSelectedSauce] = useState(null);
  const [selectedCheese, setSelectedCheese] = useState(null);
  const [selectedVeggies, setSelectedVeggies] = useState([]);

  const { addToCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError('');

    API.get('/pizzas/ingredients')
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.ingredients)
          ? res.data.ingredients
          : [];

        const normalized = list.map((item) => ({
          ...item,
          category: String(item.category || '').toLowerCase().trim(),
          price: Number(item.price || 0),
          stock: Number(item.stock ?? 0),
        }));

        setIngredients(normalized);

        const bases = normalized.filter(
          (i) => i.category === 'base' && i.stock > 0
        );
        const sauces = normalized.filter(
          (i) => i.category === 'sauce' && i.stock > 0
        );
        const cheeses = normalized.filter(
          (i) => i.category === 'cheese' && i.stock > 0
        );

        if (bases[0]) setSelectedBase(bases[0]);
        if (sauces[0]) setSelectedSauce(sauces[0]);
        if (cheeses[0]) setSelectedCheese(cheeses[0]);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error fetching ingredients:', err);
        setError('Could not load pizza ingredients. Please try again.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleVeggie = (veggie) => {
    if (veggie.stock <= 0) return;
    const exists = selectedVeggies.some((v) => v._id === veggie._id);
    if (exists) {
      setSelectedVeggies((prev) => prev.filter((v) => v._id !== veggie._id));
    } else {
      setSelectedVeggies((prev) => [...prev, veggie]);
    }
  };

  const totalPrice =
    Number(selectedBase?.price || 0) +
    Number(selectedSauce?.price || 0) +
    Number(selectedCheese?.price || 0) +
    selectedVeggies.reduce((sum, v) => sum + Number(v.price || 0), 0);

  const handleAddCustomPizza = () => {
    if (!selectedBase || !selectedSauce || !selectedCheese) {
      return alert('Please select a Base, Sauce, and Cheese!');
    }

    const sortedVeggieIds = selectedVeggies
      .map((v) => v._id)
      .sort()
      .join(',');

    const customKey = `custom-${selectedBase._id}-${selectedSauce._id}-${selectedCheese._id}-${sortedVeggieIds}`;

    addToCart({
      _id: customKey,
      id: customKey,
      customKey,
      name: `Custom ${selectedBase.name} Pizza`,
      image:
        selectedBase.image ||
        'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500',
      isCustom: true,
      size: 'custom',
      selectedSize: 'custom',
      qty: 1,
      quantity: 1,
      price: totalPrice,
      unitPrice: totalPrice,
      customDetails: {
        base: { id: selectedBase._id, name: selectedBase.name },
        sauce: { id: selectedSauce._id, name: selectedSauce.name },
        cheese: { id: selectedCheese._id, name: selectedCheese.name },
        veggies: selectedVeggies.map((v) => ({ id: v._id, name: v.name })),
      },
    });

    navigate('/cart');
  };

  const cardStyle = {
    background: '#fff',
    borderRadius: '18px',
    padding: '25px',
    border: '1px solid #edf0f5',
    boxShadow: '0 5px 25px rgba(15,23,42,.045)',
    marginBottom: '20px',
  };

  const renderSection = (
    stepBadge,
    title,
    subtitle,
    category,
    selectedItem,
    onSelect,
    isMulti = false
  ) => {
    const itemsInCategory = ingredients.filter(
      (item) => item.category === category
    );

    return (
      <div style={cardStyle}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <div>
            <span
              style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1.4,
                color: '#f97316',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              {stepBadge}
            </span>
            <h3 style={{ margin: 0, fontSize: 18, color: '#172554' }}>
              {title}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
              {subtitle}
            </p>
          </div>

          {!isMulti && selectedItem && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: 999,
                background: '#fff7ed',
                color: '#ea580c',
                border: '1px solid #fed7aa',
              }}
            >
              ✓ {selectedItem.name}
            </span>
          )}

          {isMulti && selectedVeggies.length > 0 && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: 999,
                background: '#fff7ed',
                color: '#ea580c',
                border: '1px solid #fed7aa',
              }}
            >
              ✓ {selectedVeggies.length} Selected
            </span>
          )}
        </div>

        {itemsInCategory.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>
            No {category} options available right now.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))',
              gap: 12,
            }}
          >
            {itemsInCategory.map((item) => {
              const isSelected = isMulti
                ? selectedVeggies.some((v) => v._id === item._id)
                : selectedItem?._id === item._id;
              const outOfStock = item.stock <= 0;

              return (
                <button
                  key={item._id}
                  type="button"
                  disabled={outOfStock}
                  onClick={() => onSelect(item)}
                  style={{
                    textAlign: 'left',
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: isSelected
                      ? '2px solid #f97316'
                      : '1px solid #e2e8f0',
                    background: outOfStock
                      ? '#f8fafc'
                      : isSelected
                      ? '#fff7ed'
                      : '#ffffff',
                    opacity: outOfStock ? 0.55 : 1,
                    cursor: outOfStock ? 'not-allowed' : 'pointer',
                    transition: 'all 0.18s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 8,
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
                    <strong
                      style={{
                        color: '#172554',
                        fontSize: 14,
                        fontWeight: 700,
                      }}
                    >
                      {item.name}
                    </strong>
                    {isSelected && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#ea580c',
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 800,
                        color: isSelected ? '#ea580c' : '#334155',
                      }}
                    >
                      +₹{item.price}
                    </span>
                    <span
                      style={{
                        color: outOfStock ? '#dc2626' : '#64748b',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {outOfStock ? 'Out of Stock' : 'Available'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f5f7fc',
        padding: '56px 16px 64px',
        fontFamily: 'Inter, Arial, sans-serif',
      }}
    >
      <div style={{ maxWidth: '950px', margin: 'auto' }}>
        <div style={{ marginBottom: 25 }}>
          <p
            style={{
              color: '#f97316',
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: 2,
              margin: 0,
            }}
          >
            CUSTOM PIZZA STUDIO
          </p>

          <h1
            style={{
              color: '#172554',
              fontSize: 32,
              margin: '6px 0',
            }}
          >
            Build Your Custom Pizza
          </h1>

          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
            Pick your crust, sauce, cheese, and fresh toppings to craft your own pizza.
          </p>
        </div>

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 17 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                display: 'grid',
                placeItems: 'center',
                background: '#f97316',
                fontSize: 28,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              🍕
            </div>

            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: 22 }}>
                Live Custom Price: ₹{totalPrice}
              </h2>
              <p style={{ margin: '0 0 6px', color: '#cbd5e1', fontSize: 13 }}>
                {selectedBase?.name || 'Select Base'} •{' '}
                {selectedSauce?.name || 'Select Sauce'} •{' '}
                {selectedCheese?.name || 'Select Cheese'}
                {selectedVeggies.length > 0
                  ? ` • ${selectedVeggies.map((v) => v.name).join(', ')}`
                  : ''}
              </p>
              <span
                style={{
                  color: '#fed7aa',
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                ● FRESHLY BAKED TO ORDER
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link
              to="/menu"
              style={{
                padding: '12px 18px',
                borderRadius: '11px',
                background: 'rgba(255,255,255,0.14)',
                color: '#fff',
                fontWeight: 700,
                textDecoration: 'none',
                fontSize: 14,
              }}
            >
              Classic Menu
            </Link>

            <button
              type="button"
              onClick={handleAddCustomPizza}
              style={{
                padding: '12px 20px',
                border: 'none',
                borderRadius: '11px',
                background: '#f97316',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Add to Cart • ₹{totalPrice} →
            </button>
          </div>
        </div>

        {loading ? (
          <div
            style={{ ...cardStyle, textAlign: 'center', padding: '48px 20px' }}
          >
            <p style={{ color: '#64748b', fontWeight: 700, margin: 0 }}>
              Loading fresh ingredients...
            </p>
          </div>
        ) : error ? (
          <div
            style={{ ...cardStyle, textAlign: 'center', padding: '40px 20px' }}
          >
            <p style={{ color: '#dc2626', fontWeight: 700, margin: '0 0 16px' }}>
              {error}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 20px',
                border: 'none',
                borderRadius: '11px',
                background: '#f97316',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {renderSection(
              'Step 01',
              'Choose Your Pizza Base',
              'Select one fresh dough crust for your pizza',
              'base',
              selectedBase,
              setSelectedBase
            )}

            {renderSection(
              'Step 02',
              'Choose Your Sauce',
              'Pick a rich base sauce for flavor',
              'sauce',
              selectedSauce,
              setSelectedSauce
            )}

            {renderSection(
              'Step 03',
              'Choose Your Cheese',
              'Select gooey melted cheese',
              'cheese',
              selectedCheese,
              setSelectedCheese
            )}

            {renderSection(
              'Step 04',
              'Add Fresh Veggies',
              'Select as many toppings as you like',
              'veggie',
              null,
              toggleVeggie,
              true
            )}

            <div
              style={{
                ...cardStyle,
                marginBottom: 0,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div>
                <p
                  style={{
                    margin: '0 0 4px',
                    fontSize: 12,
                    color: '#64748b',
                    fontWeight: 700,
                  }}
                >
                  YOUR CUSTOM CREATION
                </p>
                <h3 style={{ margin: '0 0 6px', fontSize: 22, color: '#172554' }}>
                  Total: <span style={{ color: '#f97316' }}>₹{totalPrice}</span>
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
                  {selectedBase?.name || 'No Base'} •{' '}
                  {selectedSauce?.name || 'No Sauce'} •{' '}
                  {selectedCheese?.name || 'No Cheese'}
                  {selectedVeggies.length > 0
                    ? ` • Veggies: ${selectedVeggies.map((v) => v.name).join(', ')}`
                    : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddCustomPizza}
                style={{
                  padding: '13px 22px',
                  border: 'none',
                  borderRadius: '11px',
                  background: '#f97316',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 14.5,
                }}
              >
                Add Custom Pizza to Cart →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}