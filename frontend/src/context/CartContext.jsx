import { createContext, useContext, useState, useEffect, useMemo } from 'react';

const CartContext = createContext();

const STORAGE_KEY = 'pizza_house_cart_v1';

export function CartProvider({ children }) {
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed)
        ? parsed.map((item) => ({
            ...item,
            selectedForOrder: item.selectedForOrder !== false,
          }))
        : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (err) {
      console.error('Failed to save cart:', err);
    }
  }, [cart]);

  const getItemUnitPrice = (item) => {
    const size = item.selectedSize || item.size || 'medium';
    const raw = item.prices?.[size] ?? item.unitPrice ?? item.price ?? 0;
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  };

  const addToCart = (pizza, selectedSize = 'medium', qty = 1) => {
    const size = selectedSize || pizza.selectedSize || 'medium';
    const unitPrice =
      Number(pizza.prices?.[size]) ?? Number(pizza.unitPrice) ?? Number(pizza.price) ?? 0;

    setCart((prev) => {
      const idx = prev.findIndex(
        (it) => it._id === pizza._id && (it.selectedSize || 'medium') === size
      );

      if (idx > -1) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          qty: (Number(updated[idx].qty) || 1) + (Number(qty) || 1),
          selectedForOrder: true,
        };
        return updated;
      }

      return [
        ...prev,
        {
          ...pizza,
          selectedSize: size,
          unitPrice,
          qty: Number(qty) || 1,
          selectedForOrder: true,
        },
      ];
    });
  };

  const updateQuantity = (id, selectedSize, delta) => {
    const size = selectedSize || 'medium';
    setCart((prev) =>
      prev
        .map((it) => {
          if (it._id === id && (it.selectedSize || 'medium') === size) {
            const nextQty = (Number(it.qty) || 1) + delta;
            return nextQty > 0 ? { ...it, qty: nextQty } : null;
          }
          return it;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (id, selectedSize) => {
    const size = selectedSize || 'medium';
    setCart((prev) =>
      prev.filter(
        (it) => !(it._id === id && (it.selectedSize || 'medium') === size)
      )
    );
  };

  const toggleSelectItem = (id, selectedSize) => {
    const size = selectedSize || 'medium';
    setCart((prev) =>
      prev.map((it) =>
        it._id === id && (it.selectedSize || 'medium') === size
          ? { ...it, selectedForOrder: !(it.selectedForOrder !== false) }
          : it
      )
    );
  };

  const toggleSelectAll = (checked) => {
    setCart((prev) =>
      prev.map((it) => ({ ...it, selectedForOrder: Boolean(checked) }))
    );
  };

  // Remove only ordered items after checkout; keep unchecked items in cart
  const removeOrderedItems = (itemsToRemove = cart) => {
    if (!Array.isArray(itemsToRemove) || itemsToRemove.length === 0) {
      setCart([]);
      return;
    }

    setCart((prev) =>
      prev.filter(
        (cartItem) =>
          !itemsToRemove.some(
            (ordered) =>
              ordered._id === cartItem._id &&
              (ordered.selectedSize || 'medium') ===
                (cartItem.selectedSize || 'medium')
          )
      )
    );
  };

  const clearCart = () => setCart([]);

  const selectedItems = useMemo(
    () => cart.filter((it) => it.selectedForOrder !== false),
    [cart]
  );

  const subtotal = useMemo(
    () =>
      selectedItems.reduce(
        (sum, it) => sum + getItemUnitPrice(it) * (Number(it.qty) || 1),
        0
      ),
    [selectedItems]
  );

  const deliveryFee = useMemo(
    () => (selectedItems.length > 0 ? 40 : 0),
    [selectedItems]
  );

  const totalAmount = useMemo(
    () => subtotal + deliveryFee,
    [subtotal, deliveryFee]
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        selectedItems,
        addToCart,
        updateQuantity,
        removeFromCart,
        toggleSelectItem,
        toggleSelectAll,
        removeOrderedItems,
        clearCart,
        subtotal,
        deliveryFee,
        totalAmount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}