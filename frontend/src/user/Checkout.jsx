import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import API from "../services/api";
import "./Checkout.css";

const ADDRESS_KEY = "pizzaDeliveryAddresses";
const MOBILE_KEY = "pizzaUserMobile";
const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

const normalizeIndianPhone10 = (raw = "") => {
  const digits = String(raw).replace(/\D/g, "");
  const ten = digits.length >= 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(ten) ? ten : "";
};

const loadRazorpaySdk = () =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector(
      `script[src="${RAZORPAY_SCRIPT_URL}"]`,
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export default function Checkout() {
  const {
    cart,
    selectedItems,
    subtotal,
    discountAmount,
    deliveryFee,
    totalAmount,
    removeOrderedItems,
    clearCart,
  } = useCart();
  const navigate = useNavigate();

  const checkoutItems = Array.isArray(selectedItems) ? selectedItems : cart;

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");

  const [address, setAddress] = useState({
    street: "",
    city: "",
    postalCode: "",
    phone: "",
  });

  const [paymentMethod, setPaymentMethod] = useState("Online");
  const [loading, setLoading] = useState(false);

  const applySavedAddress = (item, fallbackPhone = "") => {
    if (!item) return;
    setSelectedAddressId(String(item.id ?? ""));
    setAddress((prev) => ({
      street: item.address || prev.street || "",
      city: item.city || prev.city || "",
      postalCode: String(item.pincode || prev.postalCode || "")
        .replace(/\D/g, "")
        .slice(0, 6),
      phone:
        normalizeIndianPhone10(item.phone) ||
        normalizeIndianPhone10(fallbackPhone) ||
        prev.phone ||
        "",
    }));
  };

  useEffect(() => {
    const savedMobile = normalizeIndianPhone10(
      localStorage.getItem(MOBILE_KEY) || "",
    );

    if (savedMobile) {
      setAddress((prev) => ({
        ...prev,
        phone: prev.phone || savedMobile,
      }));
    }

    try {
      const parsed = JSON.parse(localStorage.getItem(ADDRESS_KEY) || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) {
        setSavedAddresses(parsed);
        const defaultAddr = parsed.find((a) => a.isDefault) || parsed[0];
        applySavedAddress(defaultAddr, savedMobile);
      }
    } catch {
      setSavedAddresses([]);
    }
  }, []);

  const getItemUnitPrice = (item) => {
    const size = item.selectedSize || item.size || "medium";
    const raw = item.prices?.[size] ?? item.unitPrice ?? item.price ?? 0;
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  };

  const computedSubtotal =
    typeof subtotal === "number"
      ? subtotal
      : checkoutItems.reduce(
          (sum, item) =>
            sum +
            getItemUnitPrice(item) * (Number(item.qty ?? item.quantity) || 1),
          0,
        );

  const computedDiscount =
    typeof discountAmount === "number" ? Math.max(0, discountAmount) : 0;

  const computedDeliveryFee = typeof deliveryFee === "number" ? deliveryFee : 0;

  const computedTotal =
    typeof totalAmount === "number"
      ? Math.max(0, totalAmount)
      : Math.max(0, computedSubtotal - computedDiscount + computedDeliveryFee);

  const isZeroOrder = checkoutItems.length > 0 && computedTotal === 0;

  const buildFormattedItems = () =>
    checkoutItems.map((item) => {
      const size = item.selectedSize || item.size || "medium";
      const qty = Number(item.qty ?? item.quantity) || 1;
      return {
        pizza: item.isCustom ? undefined : item._id,
        name: item.name,
        quantity: qty,
        qty,
        size,
        price: getItemUnitPrice(item),
        image: item.image,
        isCustom: Boolean(item.isCustom),
        customDetails: item.customDetails || null,
      };
    });

  const buildShippingPayload = () => {
    const cleanPhone = normalizeIndianPhone10(address.phone);
    const cleanStreet = String(address.street || "").trim();
    const cleanCity = String(address.city || "").trim();
    const cleanPostal = String(address.postalCode || "")
      .replace(/\D/g, "")
      .slice(0, 6);

    const shippingAddress = {
      street: cleanStreet,
      city: cleanCity,
      postalCode: cleanPostal,
      ...(cleanPhone ? { phone: cleanPhone } : {}),
    };

    const deliveryAddress = [
      cleanStreet,
      cleanCity,
      cleanPostal ? `- ${cleanPostal}` : "",
      cleanPhone ? `Phone: ${cleanPhone}` : "",
    ]
      .filter(Boolean)
      .join(", ");

    return {
      cleanPhone,
      shippingAddress,
      deliveryAddress,
    };
  };

  const finalizeAfterOrderSuccess = (order) => {
    if (typeof removeOrderedItems === "function") {
      removeOrderedItems(checkoutItems);
    } else if (typeof clearCart === "function") {
      clearCart();
    }

    alert("Order placed successfully! 🎉");
    navigate("/my-orders", { state: { newOrder: order } });
  };

  const startOnlinePayment = async (formattedItems) => {
    const safeTotal = Number(computedTotal);
    if (!Number.isFinite(safeTotal) || safeTotal <= 0) {
      setLoading(false);
      return alert("Order total must be greater than ₹0.");
    }

    const { cleanPhone, shippingAddress, deliveryAddress } =
      buildShippingPayload();

    const sdkLoaded = await loadRazorpaySdk();
    if (!sdkLoaded) {
      setLoading(false);
      return alert(
        "Unable to load Razorpay payment gateway. Please check your connection.",
      );
    }

    const { data } = await API.post("/orders/razorpay", {
      amount: safeTotal,
    });

    const rpOrder = data?.order || data;
    const keyId =
      data?.keyId || rpOrder?.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID;

    if (!keyId || !rpOrder?.id) {
      setLoading(false);
      return alert(
        "Razorpay configuration missing. Please check server Razorpay keys.",
      );
    }

    const options = {
      key: keyId,
      amount: rpOrder.amount,
      currency: rpOrder.currency || "INR",
      name: "PizzaHouse",
      description: "Fresh Pizza Delivery Order",
      order_id: rpOrder.id,
      prefill: {
        contact: cleanPhone || "",
      },
      theme: {
        color: "#f97316",
      },
      handler: async (response) => {
        try {
          const { data: verifyData } = await API.post("/orders/verify", {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            items: formattedItems,
            orderItems: formattedItems,
            shippingAddress,
            deliveryAddress,
            ...(cleanPhone ? { phone: cleanPhone } : {}),
            totalAmount: safeTotal,
            discountAmount: computedDiscount,
            deliveryFee: computedDeliveryFee,
          });
          finalizeAfterOrderSuccess(verifyData.order);
        } catch (verifyErr) {
          console.error("Payment verification error:", verifyErr);
          alert(
            verifyErr.response?.data?.message ||
              "Payment verification failed! Please contact support.",
          );
        } finally {
          setLoading(false);
        }
      },
      modal: {
        ondismiss: () => {
          setLoading(false);
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", (paymentFailure) => {
      setLoading(false);
      alert(
        paymentFailure?.error?.description ||
          "Online payment failed. In Test Mode, enter UPI ID success@razorpay instead of scanning QR.",
      );
    });
    rzp.open();
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();

    if (checkoutItems.length === 0) {
      return alert("Please select at least one item in your cart to order!");
    }

    const { cleanPhone, shippingAddress, deliveryAddress } =
      buildShippingPayload();

    if (!cleanPhone) {
      return alert("Please enter a valid 10-digit Indian mobile number.");
    }

    try {
      setLoading(true);
      localStorage.setItem(MOBILE_KEY, cleanPhone);

      const formattedItems = buildFormattedItems();

      if (isZeroOrder) {
        const { data } = await API.post("/orders", {
          orderItems: formattedItems,
          items: formattedItems,
          shippingAddress,
          deliveryAddress,
          phone: cleanPhone,
          paymentMethod: "Free Order",
          totalPrice: 0,
          totalAmount: 0,
          discountAmount: computedDiscount,
          deliveryFee: computedDeliveryFee,
          isPaid: true,
          paymentStatus: "Paid",
        });

        finalizeAfterOrderSuccess(data.order);
        setLoading(false);
        return;
      }

      if (paymentMethod === "Online") {
        await startOnlinePayment(formattedItems);
        return;
      }

      const { data } = await API.post("/orders", {
        orderItems: formattedItems,
        items: formattedItems,
        shippingAddress,
        deliveryAddress,
        phone: cleanPhone,
        paymentMethod: "Cash on Delivery",
        totalPrice: computedTotal,
        totalAmount: computedTotal,
        discountAmount: computedDiscount,
        deliveryFee: computedDeliveryFee,
      });

      finalizeAfterOrderSuccess(data.order);
      setLoading(false);
    } catch (error) {
      console.error("Order submit error:", error);
      alert(error.response?.data?.message || "Failed to place order");
      setLoading(false);
    }
  };

  const updateAddress = (e) => {
    const { name, value } = e.target;
    setSelectedAddressId("");

    let cleanedValue = value;
    if (name === "phone") {
      cleanedValue = value.replace(/\D/g, "").slice(0, 10);
    } else if (name === "postalCode") {
      cleanedValue = value.replace(/\D/g, "").slice(0, 6);
    }

    setAddress((prev) => ({
      ...prev,
      [name]: cleanedValue,
    }));
  };

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <div className="checkout-heading">
          <p className="checkout-kicker">ORDER CHECKOUT</p>
          <h1 className="checkout-title">Complete Your Order</h1>
          <p className="checkout-subtitle">
            Confirm your delivery address, choose payment, and get fresh hot
            pizza.
          </p>
        </div>

        <div className="checkout-banner">
          <div className="checkout-banner-left">
            <div className="checkout-banner-icon">🧾</div>
            <div>
              <h2>Checkout &amp; Delivery</h2>
              <p>
                {checkoutItems.length} item(s) selected • Delivery Fee:{" "}
                {computedDeliveryFee === 0 ? "FREE" : `₹${computedDeliveryFee}`}
              </p>
              <span className="checkout-banner-tag">
                ● READY TO PLACE ORDER
              </span>
            </div>
          </div>

          <div className="checkout-banner-actions">
            <Link to="/cart" className="checkout-btn-ghost">
              ← Back to Cart
            </Link>
            <Link to="/profile" className="checkout-btn-orange">
              Manage Addresses
            </Link>
          </div>
        </div>

        {checkoutItems.length === 0 ? (
          <div className="checkout-card checkout-empty">
            <div className="checkout-empty-icon">🛒</div>
            <h2>No Items Selected for Checkout</h2>
            <p>Go back to your cart and select the pizzas you want to order.</p>
            <div className="checkout-empty-actions">
              <Link to="/cart" className="checkout-btn-orange">
                Back to Cart
              </Link>
              <Link to="/menu" className="checkout-btn-navy">
                Explore Menu
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitOrder} className="checkout-grid">
            <div className="checkout-left-col">
              <div className="checkout-card">
                <div className="checkout-card-header">
                  <div className="checkout-icon-badge">📍</div>
                  <div>
                    <h2>Delivery Details</h2>
                    <p>Where should we deliver your fresh pizza?</p>
                  </div>
                </div>

                {savedAddresses.length > 0 && (
                  <div className="saved-addresses-box">
                    <div className="saved-addresses-top">
                      <span>Saved Profile Addresses</span>
                      <Link to="/profile">+ Add / Edit in Profile</Link>
                    </div>

                    <div className="saved-addresses-grid">
                      {savedAddresses.map((item) => {
                        const isSelected =
                          String(item.id) === String(selectedAddressId);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => applySavedAddress(item)}
                            className={`saved-address-chip ${
                              isSelected ? "selected" : ""
                            }`}
                          >
                            <div className="saved-address-chip-head">
                              <strong>📍 {item.label || "Address"}</strong>
                              {item.isDefault && (
                                <span className="default-badge">DEFAULT</span>
                              )}
                            </div>
                            <p>{item.address}</p>
                            <span>
                              {item.city} - {item.pincode}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="checkout-fields-stack">
                  <div>
                    <label className="checkout-label">Street Address *</label>
                    <input
                      type="text"
                      name="street"
                      required
                      value={address.street}
                      onChange={updateAddress}
                      placeholder="House no, street, landmark, area"
                      className="checkout-input"
                    />
                  </div>

                  <div>
                    <label className="checkout-label">City *</label>
                    <input
                      type="text"
                      name="city"
                      required
                      value={address.city}
                      onChange={updateAddress}
                      placeholder="Enter your city"
                      className="checkout-input"
                    />
                  </div>

                  <div className="checkout-two-col">
                    <div>
                      <label className="checkout-label">Postal Code *</label>
                      <input
                        type="text"
                        name="postalCode"
                        required
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={address.postalCode}
                        onChange={updateAddress}
                        placeholder="6-digit pincode"
                        className="checkout-input"
                      />
                    </div>

                    <div>
                      <label className="checkout-label">Phone Number *</label>
                      <input
                        type="tel"
                        name="phone"
                        required
                        pattern="[6-9][0-9]{9}"
                        maxLength={10}
                        value={address.phone}
                        onChange={updateAddress}
                        placeholder="10-digit mobile number"
                        className="checkout-input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="checkout-card">
                <div className="checkout-card-header">
                  <div className="checkout-icon-badge">💳</div>
                  <div>
                    <h2>Payment Method</h2>
                    <p>
                      {isZeroOrder
                        ? "Order total is ₹0 — no payment gateway required"
                        : "Choose how you want to pay for your order"}
                    </p>
                  </div>
                </div>

                {isZeroOrder ? (
                  <div className="saved-addresses-box">
                    <strong>🎁 Free / ₹0 Order Eligible</strong>
                    <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                      Your final total is ₹0. Click &ldquo;Place Free
                      Order&rdquo; to confirm directly.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="payment-grid">
                      <label
                        className={`payment-option ${
                          paymentMethod === "Online" ? "active" : ""
                        }`}
                      >
                        <div className="payment-option-top">
                          <span>📱</span>
                          <input
                            type="radio"
                            name="payment"
                            value="Online"
                            checked={paymentMethod === "Online"}
                            onChange={() => setPaymentMethod("Online")}
                          />
                        </div>
                        <div>
                          <h3>Online Payment</h3>
                          <p>UPI, Debit/Credit Card, or Net Banking</p>
                        </div>
                      </label>

                      <label
                        className={`payment-option ${
                          paymentMethod === "Cash on Delivery" ? "active" : ""
                        }`}
                      >
                        <div className="payment-option-top">
                          <span>💵</span>
                          <input
                            type="radio"
                            name="payment"
                            value="Cash on Delivery"
                            checked={paymentMethod === "Cash on Delivery"}
                            onChange={() => setPaymentMethod("Cash on Delivery")}
                          />
                        </div>
                        <div>
                          <h3>Cash on Delivery</h3>
                          <p>Pay in cash when your pizza arrives</p>
                        </div>
                      </label>
                    </div>

                    {paymentMethod === "Online" && (
                      <p
                        style={{
                          margin: "12px 0 0",
                          fontSize: 12.5,
                          color: "#64748b",
                        }}
                      >
                        Test Mode tip: Do not scan QR with PhonePe/GPay in Test
                        Mode—enter UPI ID <strong>success@razorpay</strong>.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="checkout-right-col">
              <div className="checkout-summary">
                <div className="checkout-summary-head">
                  <h2>Order Summary</h2>
                  <Link to="/cart">Change</Link>
                </div>

                <div className="checkout-summary-items">
                  {checkoutItems.map((item, index) => {
                    const size = item.selectedSize || item.size || "medium";
                    const qty = Number(item.qty ?? item.quantity) || 1;
                    const lineTotal = getItemUnitPrice(item) * qty;

                    return (
                      <div
                        key={`${item._id || "item"}-${size}-${index}`}
                        className="checkout-item-row"
                      >
                        <img
                          src={
                            item.image ||
                            "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=300"
                          }
                          alt={item.name}
                          className="checkout-item-img"
                        />

                        <div className="checkout-item-info">
                          <h3>{item.name}</h3>
                          <p>
                            {size} • Qty: {qty}
                          </p>
                        </div>

                        <strong className="checkout-item-price">
                          ₹{lineTotal}
                        </strong>
                      </div>
                    );
                  })}
                </div>

                <div className="checkout-price-breakdown">
                  <div className="checkout-price-row">
                    <span>Subtotal</span>
                    <strong>₹{computedSubtotal}</strong>
                  </div>

                  {computedDiscount > 0 && (
                    <div className="checkout-price-row">
                      <span>Discount</span>
                      <strong className="free-text">- ₹{computedDiscount}</strong>
                    </div>
                  )}

                  <div className="checkout-price-row">
                    <span>Delivery Fee</span>
                    <span className="free-text">
                      {computedDeliveryFee === 0
                        ? "FREE"
                        : `₹${computedDeliveryFee}`}
                    </span>
                  </div>

                  <div className="checkout-price-row">
                    <span>Taxes</span>
                    <span>Included</span>
                  </div>
                </div>

                <div className="checkout-total-box">
                  <div className="checkout-total-line">
                    <span>Total Amount</span>
                    <strong>₹{computedTotal}</strong>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="place-order-btn"
                  >
                    {loading
                      ? isZeroOrder
                        ? "Placing Free Order..."
                        : paymentMethod === "Online"
                          ? "Opening Payment..."
                          : "Placing Order..."
                      : isZeroOrder
                        ? "Place Free Order (₹0) →"
                        : paymentMethod === "Online"
                          ? `Pay ₹${computedTotal} Online →`
                          : "Place Order Now →"}
                  </button>

                  <p className="checkout-secure-note">
                    🔒 Safe &amp; Secure Order Processing
                  </p>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}