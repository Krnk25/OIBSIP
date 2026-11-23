import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import API from "../services/api";

const ORDER_STEPS = [
  { label: "Order Received", icon: "🧾" },
  { label: "In the Kitchen", icon: "👨‍🍳" },
  { label: "Sent to Delivery", icon: "🛵" },
  { label: "Delivered", icon: "🍕" },
];

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liveConnected, setLiveConnected] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchMyOrders = async () => {
      try {
        setLoading(true);
        setError("");
        const { data } = await API.get("/orders/my-orders");
        if (!isMounted) return;
        setOrders(Array.isArray(data) ? data : data.orders || []);
      } catch (err) {
        if (!isMounted) return;
        console.error("Error fetching orders:", err);
        setError(err.response?.data?.message || "Failed to load your orders.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMyOrders();
    return () => {
      isMounted = false;
    };
  }, []);

  // Live Socket.io order status & delivery OTP updates
  useEffect(() => {
    if (!orders.length) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socket.on("connect", () => setLiveConnected(true));
    socket.on("disconnect", () => setLiveConnected(false));

    const listeners = orders.flatMap((order) => {
      const statusEvent = `orderStatusUpdated_${order._id}`;
      const otpEvent = `deliveryOtpSent_${order._id}`;

      const statusHandler = (updatedOrder) => {
        const payload = updatedOrder?.order ? updatedOrder.order : updatedOrder;
        if (!payload) return;
        setOrders((prev) =>
          prev.map((item) =>
            item._id === order._id
              ? {
                  ...item,
                  ...payload,
                  deliveryOtp: payload.deliveryOtp ?? item.deliveryOtp,
                }
              : item,
          ),
        );
      };

      const otpHandler = (otpPayload) => {
        if (!otpPayload) return;
        setOrders((prev) =>
          prev.map((item) =>
            item._id === order._id
              ? {
                  ...item,
                  deliveryOtp: otpPayload.deliveryOtp ?? item.deliveryOtp,
                  otpSentAt: otpPayload.otpSentAt ?? new Date().toISOString(),
                  orderStatus: otpPayload.orderStatus ?? item.orderStatus,
                  isOtpVerified: false,
                }
              : item,
          ),
        );
      };

      socket.on(statusEvent, statusHandler);
      socket.on(otpEvent, otpHandler);

      return [
        { eventName: statusEvent, handler: statusHandler },
        { eventName: otpEvent, handler: otpHandler },
      ];
    });

    return () => {
      listeners.forEach(({ eventName, handler }) => {
        socket.off(eventName, handler);
      });
      socket.disconnect();
    };
  }, [orders.map((o) => o._id).join(",")]);

  const getOrderStatus = (order) =>
    order?.orderStatus || order?.status || "Order Received";

  const getStatusStyle = (status) => {
    const s = String(status).toLowerCase();
    if (s === "delivered") {
      return {
        background: "#dcfce7",
        color: "#15803d",
        border: "1px solid #86efac",
      };
    }
    if (s === "cancelled") {
      return {
        background: "#fee2e2",
        color: "#b91c1c",
        border: "1px solid #fca5a5",
      };
    }
    if (s === "sent to delivery" || s === "out for delivery") {
      return {
        background: "#e0f2fe",
        color: "#0369a1",
        border: "1px solid #7dd3fc",
      };
    }
    if (s === "in the kitchen" || s === "preparing") {
      return {
        background: "#fef3c7",
        color: "#b45309",
        border: "1px solid #fcd34d",
      };
    }
    return {
      background: "#ffedd5",
      color: "#c2410c",
      border: "1px solid #fdba74",
    };
  };

  const getStepIndex = (status) => {
    const normalized = String(status).toLowerCase();
    const idx = ORDER_STEPS.findIndex(
      (step) => step.label.toLowerCase() === normalized,
    );
    if (idx !== -1) return idx;
    if (normalized === "placed") return 0;
    if (normalized === "preparing") return 1;
    if (normalized === "out for delivery") return 2;
    return 0;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAddress = (order) => {
    if (
      typeof order?.deliveryAddress === "string" &&
      order.deliveryAddress.trim()
    ) {
      return order.deliveryAddress;
    }
    if (order?.shippingAddress && typeof order.shippingAddress === "object") {
      const { street, city, postalCode, phone } = order.shippingAddress;
      const base = [street, city, postalCode].filter(Boolean).join(", ");
      return phone ? `${base} • ${phone}` : base;
    }
    return "Standard Delivery";
  };

  const renderCustomSummary = (item) => {
    if (!item?.isCustom || !item?.customDetails) return null;
    const { base, sauce, cheese, veggies } = item.customDetails;
    const parts = [
      base?.name,
      sauce?.name,
      cheese?.name,
      Array.isArray(veggies) && veggies.length > 0
        ? veggies.map((v) => v.name).join(", ")
        : null,
    ].filter(Boolean);

    if (!parts.length) return null;
    return (
      <p
        style={{
          margin: "6px 0 0",
          padding: "6px 10px",
          borderRadius: 9,
          background: "#fff7ed",
          border: "1px solid #fed7aa",
          color: "#9a3412",
          fontSize: 12,
        }}
      >
        <strong>Custom:</strong> {parts.join(" • ")}
      </p>
    );
  };

  const totalSpent = orders
    .filter(
      (o) => String(getOrderStatus(o)).toLowerCase() !== "cancelled",
    )
    .reduce((sum, o) => sum + Number(o.totalAmount ?? o.totalPrice ?? 0), 0);

  const activeOrdersCount = orders.filter((o) => {
    const s = String(getOrderStatus(o)).toLowerCase();
    return s !== "delivered" && s !== "cancelled";
  }).length;

  const cardStyle = {
    background: "#fff",
    borderRadius: "18px",
    padding: "25px",
    border: "1px solid #edf0f5",
    boxShadow: "0 5px 25px rgba(15,23,42,.045)",
    marginBottom: "20px",
  };

  const primaryButton = {
    padding: "12px 20px",
    border: "none",
    borderRadius: "11px",
    background: "#f97316",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fc",
        padding: "56px 16px 60px",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "950px", margin: "auto" }}>
        {/* Page Heading */}
        <div style={{ marginBottom: 25 }}>
          <p
            style={{
              color: "#f97316",
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: 2,
              margin: 0,
            }}
          >
            ORDER TRACKER
          </p>

          <h1
            style={{
              color: "#172554",
              fontSize: 32,
              margin: "6px 0",
            }}
          >
            My Orders
          </h1>

          <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
            Track your live pizza deliveries, delivery OTP, and past orders.
          </p>
        </div>

        {/* Top Banner Card (Profile Header style) */}
        <div
          style={{
            ...cardStyle,
            background: "linear-gradient(120deg,#172554,#312e81)",
            color: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 17 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                display: "grid",
                placeItems: "center",
                background: "#f97316",
                fontSize: 28,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              📦
            </div>

            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>
                Pizza Delivery History
              </h2>
              <p style={{ margin: "0 0 6px", color: "#cbd5e1", fontSize: 13 }}>
                Real-time kitchen &amp; delivery status updates
              </p>
              <span
                style={{
                  color: liveConnected ? "#86efac" : "#fed7aa",
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 0.6,
                }}
              >
                ● {liveConnected ? "Live Updates Connected" : "Order Sync Ready"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/menu" style={primaryButton}>
              + Order More Pizza
            </Link>
            <Link
              to="/profile"
              style={{
                ...primaryButton,
                background: "rgba(255,255,255,0.14)",
              }}
            >
              Profile
            </Link>
          </div>
        </div>

        {/* Stats Row (Profile Statistics style) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
            gap: 16,
            marginBottom: 22,
          }}
        >
          {[
            {
              title: "Total Orders",
              value: loading ? "..." : orders.length,
              icon: "🛍️",
            },
            {
              title: "Active Orders",
              value: loading ? "..." : activeOrdersCount,
              icon: "🍕",
            },
            {
              title: "Total Spent",
              value: loading ? "..." : `₹${totalSpent.toLocaleString("en-IN")}`,
              icon: "💰",
            },
          ].map((stat) => (
            <div
              key={stat.title}
              style={{
                ...cardStyle,
                marginBottom: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 6px" }}>
                    {stat.title}
                  </p>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 28,
                      color: "#172554",
                    }}
                  >
                    {stat.value}
                  </h2>
                </div>
                <span style={{ fontSize: 28 }}>{stat.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Loading / Error / Empty / Orders List */}
        {loading ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "48px 20px" }}>
            <p style={{ color: "#64748b", fontWeight: 700, margin: 0 }}>
              Fetching your orders...
            </p>
          </div>
        ) : error ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "40px 20px" }}>
            <p style={{ color: "#dc2626", fontWeight: 700, margin: "0 0 16px" }}>
              {error}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={primaryButton}
            >
              Try Again
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "48px 20px" }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🍕</div>
            <h3 style={{ color: "#172554", margin: "0 0 8px", fontSize: 22 }}>
              No Orders Yet
            </h3>
            <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 20px" }}>
              You haven&apos;t placed any pizza orders yet.
            </p>
            <Link to="/menu" style={primaryButton}>
              Explore Menu →
            </Link>
          </div>
        ) : (
          <div>
            {orders.map((order) => {
              const status = getOrderStatus(order);
              const currentStep = getStepIndex(status);
              const lowerStatus = String(status).toLowerCase();
              const isCancelled = lowerStatus === "cancelled";
              const isDelivered = lowerStatus === "delivered";
              const orderList =
                Array.isArray(order.items) && order.items.length > 0
                  ? order.items
                  : order.orderItems || [];
              const total = Number(order.totalAmount ?? order.totalPrice ?? 0);
              const paymentMethod = order.paymentMethod || "Cash on Delivery";
              const paymentStatus =
                order.paymentStatus ||
                order.paymentInfo?.status ||
                (order.isPaid ? "Paid" : "Pending");

              return (
                <div key={order._id} style={cardStyle}>
                  {/* Order Top Header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 12,
                      paddingBottom: 16,
                      borderBottom: "1px solid #edf0f5",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <strong style={{ color: "#172554", fontSize: 17 }}>
                          Order #{String(order._id).slice(-6).toUpperCase()}
                        </strong>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: 999,
                            background: "#eef2ff",
                            color: "#3730a3",
                            border: "1px solid #c7d2fe",
                          }}
                        >
                          {paymentMethod}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: 999,
                            background:
                              String(paymentStatus).toLowerCase() === "paid"
                                ? "#dcfce7"
                                : "#fef3c7",
                            color:
                              String(paymentStatus).toLowerCase() === "paid"
                                ? "#15803d"
                                : "#b45309",
                            border:
                              String(paymentStatus).toLowerCase() === "paid"
                                ? "1px solid #86efac"
                                : "1px solid #fcd34d",
                          }}
                        >
                          Payment: {paymentStatus}
                        </span>
                      </div>
                      {order.createdAt && (
                        <p
                          style={{
                            margin: "6px 0 0",
                            color: "#94a3b8",
                            fontSize: 12,
                          }}
                        >
                          Placed on {formatDate(order.createdAt)}
                        </p>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      {!isDelivered && !isCancelled && order.deliveryOtp && (
                        <span
                          style={{
                            padding: "6px 12px",
                            borderRadius: 999,
                            background: "#172554",
                            color: "#fff",
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: 0.6,
                          }}
                        >
                          🔐 Delivery OTP: {order.deliveryOtp}
                        </span>
                      )}

                      <span
                        style={{
                          ...getStatusStyle(status),
                          padding: "6px 14px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {status}
                      </span>
                    </div>
                  </div>

                  {/* Stepper */}
                  {!isCancelled && (
                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: 14,
                        padding: 16,
                        margin: "18px 0",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: 10,
                        }}
                      >
                        {ORDER_STEPS.map((step, index) => {
                          const completed = index <= currentStep;
                          const active = index === currentStep;
                          return (
                            <div key={step.label}>
                              <div
                                style={{
                                  height: 6,
                                  borderRadius: 999,
                                  background: completed ? "#f97316" : "#e2e8f0",
                                  marginBottom: 8,
                                }}
                              />
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: active ? 800 : 600,
                                  color: active
                                    ? "#f97316"
                                    : completed
                                      ? "#172554"
                                      : "#94a3b8",
                                }}
                              >
                                {step.icon} {step.label}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Items */}
                  <div>
                    {orderList.map((item, idx) => {
                      const qty = Number(item.quantity ?? item.qty ?? 1);
                      const price = Number(item.price ?? 0);

                      return (
                        <div
                          key={item._id || idx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 14,
                            padding: "12px 0",
                            borderBottom:
                              idx < orderList.length - 1
                                ? "1px solid #f1f5f9"
                                : "none",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 14,
                              minWidth: 0,
                            }}
                          >
                            <img
                              src={
                                item.image ||
                                "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=200"
                              }
                              alt={item.name}
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: 12,
                                objectFit: "cover",
                                background: "#fff7ed",
                                flexShrink: 0,
                              }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <strong style={{ color: "#172554", fontSize: 15 }}>
                                {item.name}
                              </strong>
                              <p
                                style={{
                                  margin: "4px 0 0",
                                  color: "#64748b",
                                  fontSize: 12,
                                  textTransform: "capitalize",
                                }}
                              >
                                Size: {item.size || "medium"} • Qty: {qty}
                              </p>
                              {renderCustomSummary(item)}
                            </div>
                          </div>

                          <strong
                            style={{
                              color: "#172554",
                              fontSize: 16,
                              flexShrink: 0,
                            }}
                          >
                            ₹{price * qty}
                          </strong>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 14,
                      borderTop: "1px dashed #cbd5e1",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
                      📍 {formatAddress(order)}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          color: "#64748b",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        Total Amount:
                      </span>
                      <strong style={{ color: "#f97316", fontSize: 22 }}>
                        ₹{total}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}