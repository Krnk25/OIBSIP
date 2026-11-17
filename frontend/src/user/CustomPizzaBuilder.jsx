import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import { useCart } from '../context/CartContext';

export default function CustomPizzaBuilder() {
  const [ingredients, setIngredients] = useState([]);
  const [selectedBase, setSelectedBase] = useState(null);
  const [selectedSauce, setSelectedSauce] = useState(null);
  const [selectedCheese, setSelectedCheese] = useState(null);
  const [selectedVeggies, setSelectedVeggies] = useState([]);
  const { addToCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/pizzas/ingredients')
      .then((res) => {
        setIngredients(res.data);
        const bases = res.data.filter((i) => i.category === 'base' && i.stock > 0);
        const sauces = res.data.filter((i) => i.category === 'sauce' && i.stock > 0);
        const cheeses = res.data.filter((i) => i.category === 'cheese' && i.stock > 0);
        if (bases[0]) setSelectedBase(bases[0]);
        if (sauces[0]) setSelectedSauce(sauces[0]);
        if (cheeses[0]) setSelectedCheese(cheeses[0]);
      })
      .catch((err) => console.error(err));
  }, []);

  const toggleVeggie = (veggie) => {
    const exists = selectedVeggies.find((v) => v._id === veggie._id);
    if (exists) {
      setSelectedVeggies(selectedVeggies.filter((v) => v._id !== veggie._id));
    } else {
      setSelectedVeggies([...selectedVeggies, veggie]);
    }
  };

  const totalPrice =
    (selectedBase?.price || 0) +
    (selectedSauce?.price || 0) +
    (selectedCheese?.price || 0) +
    selectedVeggies.reduce((sum, v) => sum + v.price, 0);

  const handleAddCustomPizza = () => {
    if (!selectedBase || !selectedSauce || !selectedCheese) {
      return alert('Please select a Base, Sauce, and Cheese!');
    }

    addToCart({
      name: `Custom ${selectedBase.name} Pizza`,
      isCustom: true,
      size: 'custom',
      quantity: 1,
      price: totalPrice,
      customDetails: {
        base: { id: selectedBase._id, name: selectedBase.name },
        sauce: { id: selectedSauce._id, name: selectedSauce.name },
        cheese: { id: selectedCheese._id, name: selectedCheese.name },
        veggies: selectedVeggies.map((v) => ({ id: v._id, name: v.name })),
      },
    });

    navigate('/cart');
  };

  const renderSection = (title, category, selectedItem, onSelect, isMulti = false) => (
    <div className="card" style={{ marginBottom: '20px' }}>
      <h3 style={{ marginBottom: '12px' }}>{title}</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {ingredients
          .filter((item) => item.category === category)
          .map((item) => {
            const isSelected = isMulti
              ? selectedVeggies.some((v) => v._id === item._id)
              : selectedItem?._id === item._id;
            const outOfStock = item.stock <= 0;

            return (
              <button
                key={item._id}
                disabled={outOfStock}
                onClick={() => onSelect(item)}
                className={`btn btn-outline ${isSelected ? 'active' : ''}`}
                style={{ opacity: outOfStock ? 0.5 : 1 }}
              >
                {item.name} (+₹{item.price}) {outOfStock && '— Out of Stock'}
              </button>
            );
          })}
      </div>
    </div>
  );

  return (
    <div className="container">
      <h1 style={{ marginBottom: '20px' }}>Build Your Custom Pizza 🛠️🍕</h1>
      {renderSection('1. Choose Your Pizza Base (Select 1)', 'base', selectedBase, setSelectedBase)}
      {renderSection('2. Choose Your Sauce (Select 1)', 'sauce', selectedSauce, setSelectedSauce)}
      {renderSection('3. Choose Your Cheese (Select 1)', 'cheese', selectedCheese, setSelectedCheese)}
      {renderSection('4. Add Fresh Veggies (Select Multiple)', 'veggie', null, toggleVeggie, true)}

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1d3557', color: 'white' }}>
        <div>
          <h3>Total Custom Pizza Price: ₹{totalPrice}</h3>
          <p style={{ fontSize: '14px', opacity: 0.9 }}>
            {selectedBase?.name} • {selectedSauce?.name} • {selectedCheese?.name}
            {selectedVeggies.length > 0 && ` • Veggies: ${selectedVeggies.map((v) => v.name).join(', ')}`}
          </p>
        </div>
        <button onClick={handleAddCustomPizza} className="btn" style={{ background: '#ffb703', color: '#1d3557' }}>
          Add Custom Pizza to Cart →
        </button>
      </div>
    </div>
  );
}