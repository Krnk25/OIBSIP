import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import API from '../services/api';

const CartContext = createContext();

const STORAGE_KEY = 'pizza_house_cart_v1';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const DEFAULT_STORE_SETTINGS = {
  deliveryFee: 0,
  discountType: 'none',
  discountValue: 0,
  minOrderAmount: 0,
};

const normalizeStoreSettings = (raw) => {
  const source = raw?.settings ? raw.settings : raw || {};
  const discountType = ['none', 'flat', 'percentage'].includes(
    source.discountType
  )
    ? source.discountType
    : 'none';

  let discountValue = Math.max(0, Number(source.discountValue ?? 0));
  if (discountType === 'percentage' && discountValue > 100) {
    discountValue = 100;
  }

  return {
    deliveryFee: Math.max(0, Number(source.deliveryFee ?? 0)),
    discountType,
    discountValue: Number.isFinite(discountValue) ? discountValue : 0,
    minOrderAmount: Math.max(0, Number(source.minOrderAmount ?? 0)),
  };
};

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

  const [storeSettings, setStoreSettings] = useState(DEFAULT_STORE_SETTINGS);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (err) {
      console.error('Failed to save cart:', err);
    }
  }, [cart]);

  useEffect(() => {
    let active = true;

    API.get('/settings')
      .then((res) => {
        if (active && res?.data) {
          setStoreSettings(normalizeStoreSettings(res.data));
        }
      })
      .catch((err) => {
        console.error('Failed to load store settings:', err);
      });

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socket.on('storeSettingsUpdated', (updatedSettings) => {
      if (active) {
        setStoreSettings(normalizeStoreSettings(updatedSettings));
      }
    });

    return () => {
      active = false;
      socket.off('storeSettingsUpdated');
      socket.disconnect();
    };
  }, []);

  const getItemUnitPrice = (item) => {
    const size = item.selectedSize || item.size || 'medium';
    const raw = item.prices?.[size] ?? item.unitPrice ?? item.price ?? 0;
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  };

  const addToCart = (pizza, selectedSize = 'medium', qty = 1) => {
    const size = selectedSize || pizza.selectedSize || 'medium';
    const unitPrice =
      Number(pizza.prices?.[size]) ??
      Number(pizza.unitPrice) ??
      Number(pizza.price) ??
      0;

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

  const discountAmount = useMemo(() => {
    if (selectedItems.length === 0 || subtotal <= 0) return 0;

    const minOrder = Number(storeSettings.minOrderAmount ?? 0);
    const val = Math.max(0, Number(storeSettings.discountValue ?? 0));

    if (subtotal < minOrder || val <= 0) return 0;

    if (storeSettings.discountType === 'flat') {
      return Math.min(val, subtotal);
    }

    if (storeSettings.discountType === 'percentage') {
      return Math.round((subtotal * Math.min(val, 100)) / 100);
    }

    return 0;
  }, [selectedItems.length, subtotal, storeSettings]);

  const deliveryFee = useMemo(
    () =>
      selectedItems.length > 0
        ? Math.max(0, Number(storeSettings.deliveryFee ?? 0))
        : 0,
    [selectedItems.length, storeSettings.deliveryFee]
  );

  const totalAmount = useMemo(
    () => Math.max(0, subtotal - discountAmount + deliveryFee),
    [subtotal, discountAmount, deliveryFee]
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        selectedItems,
        storeSettings,
        addToCart,
        updateQuantity,
        removeFromCart,
        toggleSelectItem,
        toggleSelectAll,
        removeOrderedItems,
        clearCart,
        subtotal,
        discountAmount,
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