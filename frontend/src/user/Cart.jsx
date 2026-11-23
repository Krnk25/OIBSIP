import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import './Cart.css';

export default function Cart() {
  const {
    cart,
    selectedItems,
    updateQuantity,
    removeFromCart,
    toggleSelectItem,
    toggleSelectAll,
    subtotal,
    deliveryFee,
    totalAmount,
  } = useCart();
  const navigate = useNavigate();

  const getItemPrice = (item) => {
    const size = item.selectedSize || item.size || 'medium';
    return (
      Number(item.prices?.[size]) ||
      Number(item.unitPrice) ||
      Number(item.price) ||
      0
    );
  };

  const allSelected =
    cart.length > 0 && cart.every((item) => item.selectedForOrder !== false);

  const selectedCount = selectedItems.reduce(
    (sum, item) => sum + (Number(item.qty) || 1),
    0
  );

  const handleProceedToCheckout = () => {
    if (selectedItems.length === 0) {
      return alert('Please select at least one pizza to proceed to checkout!');
    }
    navigate('/checkout');
  };

  if (cart.length === 0) {
    return (
      <div className="empty-cart">
        <div className="empty-cart-icon">🍕</div>
        <h2>Your Cart is Empty</h2>
        <p>Looks like you haven&apos;t added any delicious pizzas yet.</p>
        <Link to="/" className="continue-btn">
          Browse Menu →
        </Link>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-container">
        <div className="cart-heading">
          <div>
            <span className="cart-small-title">YOUR SELECTION</span>
            <h1>Shopping Cart 🛒</h1>
            <p>
              <strong>{selectedCount}</strong> of{' '}
              <strong>
                {cart.reduce((sum, item) => sum + (Number(item.qty) || 1), 0)}
              </strong>{' '}
              item(s) selected for order.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-2xs">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => toggleSelectAll(e.target.checked)}
                className="w-4 h-4 accent-[#e94b20] cursor-pointer"
              />
              <span>Select All</span>
            </label>

            <Link to="/" className="back-shopping">
              ← Continue Shopping
            </Link>
          </div>
        </div>

        <div className="cart-layout">
          {/* Cart Items */}
          <div className="cart-items">
            {cart.map((item) => {
              const size = item.selectedSize || item.size || 'medium';
              const unitPrice = getItemPrice(item);
              const qty = Number(item.qty) || 1;
              const lineTotal = unitPrice * qty;
              const isChecked = item.selectedForOrder !== false;

              return (
                <div
                  className={`cart-item transition ${
                    !isChecked ? 'opacity-65 bg-gray-50/70' : ''
                  }`}
                  key={`${item._id}-${size}`}
                >
                  {/* Checkbox for selecting item to order */}
                  <input
                    type="checkbox"
                    aria-label={`Select ${item.name} for order`}
                    checked={isChecked}
                    onChange={() => toggleSelectItem(item._id, size)}
                    className="w-5 h-5 accent-[#e94b20] cursor-pointer shrink-0"
                  />

                  <div className="cart-pizza-image">
                    <img
                      src={
                        item.image ||
                        'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400'
                      }
                      alt={item.name}
                    />
                  </div>

                  <div className="cart-item-details">
                    <h3>{item.name}</h3>
                    <span className="pizza-size">{size}</span>
                    <p className="item-price">Price: ₹{unitPrice} each</p>

                    <div className="quantity-control">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => updateQuantity(item._id, size, -1)}
                      >
                        −
                      </button>
                      <span>{qty}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => updateQuantity(item._id, size, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="cart-item-right">
                    <strong>₹{lineTotal}</strong>
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => removeFromCart(item._id, size)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary (Only Selected Items) */}
          <div className="order-summary">
            <h2>Order Summary</h2>

            <div className="summary-row">
              <span>Selected Items ({selectedCount})</span>
              <strong>₹{subtotal}</strong>
            </div>

            <div className="summary-row">
              <span>Delivery Fee</span>
              <strong>₹{deliveryFee}</strong>
            </div>

            <div className="summary-divider" />

            <div className="summary-total">
              <span>Total Amount</span>
              <strong>₹{totalAmount}</strong>
            </div>

            <button
              type="button"
              className="checkout-btn"
              disabled={selectedItems.length === 0}
              onClick={handleProceedToCheckout}
              style={{
                opacity: selectedItems.length === 0 ? 0.55 : 1,
                cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Proceed to Checkout ({selectedCount}) →
            </button>

            <p className="secure-text">
              🔒 Only checked items will be sent to checkout
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}