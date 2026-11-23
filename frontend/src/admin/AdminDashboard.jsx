import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import API from "../services/api";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

const ORDER_STATUSES = [
  "Order Received",
  "In the Kitchen",
  "Sent to Delivery",
  "Delivered",
  "Cancelled",
];

const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded"];

const EMPTY_OTP_MODAL = {
  open: false,
  order: null,
  otpInput: "",
  error: "",
  submitting: false,
};

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("orders");
  const [orderFilter, setOrderFilter] = useState("ALL");
  const [orders, setOrders] = useState([]);
  const [pizzas, setPizzas] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveConnected, setLiveConnected] = useState(false);

  const [sendingOtpId, setSendingOtpId] = useState(null);
  const [otpBannerMsg, setOtpBannerMsg] = useState("");
  const [otpModal, setOtpModal] = useState(EMPTY_OTP_MODAL);

  const [newPizza, setNewPizza] = useState({
    name: "",
    category: "veg",
    price: 299,
    stock: 40,
    threshold: 10,
    description: "",
    image: "",
  });

  const [newIng, setNewIng] = useState({
    name: "",
    category: "veggie",
    price: 30,
    stock: 50,
    threshold: 20,
  });

  const getOrderStatus = (order) =>
    order?.orderStatus || order?.status || "Order Received";

  const getPaymentStatus = (order) =>
    order?.paymentStatus ||
    order?.paymentInfo?.status ||
    (order?.isPaid ? "Paid" : "Pending");

  const isCodOrder = (order) => {
    const method = String(order?.paymentMethod || "").toLowerCase();
    return method.includes("cash") || method.includes("cod");
  };

  const fetchData = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const [ordersRes, ingRes, pizzasRes] = await Promise.all([
        API.get("/orders"),
        API.get("/pizzas/ingredients"),
        API.get("/pizzas").catch(() => ({ data: [] })),
      ]);

      const orderList = Array.isArray(ordersRes.data)
        ? ordersRes.data
        : ordersRes.data?.orders || [];
      const ingList = Array.isArray(ingRes.data)
        ? ingRes.data
        : ingRes.data?.ingredients || [];
      const pizzaList = Array.isArray(pizzasRes.data)
        ? pizzasRes.data
        : pizzasRes.data?.pizzas || [];

      setOrders(orderList);
      setIngredients(ingList);
      setPizzas(pizzaList);
    } catch (error) {
      console.error("Error loading admin data:", error);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socket.on("connect", () => setLiveConnected(true));
    socket.on("disconnect", () => setLiveConnected(false));

    socket.on("newOrderPlaced", (newOrder) => {
      const payload = newOrder?.order ? newOrder.order : newOrder;
      if (payload) {
        setOrders((prev) => {
          const exists = prev.some((o) => o._id === payload._id);
          return exists ? prev : [payload, ...prev];
        });
      }
      fetchData(false);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("newOrderPlaced");
      socket.disconnect();
    };
  }, []);

  const handleSendDeliveryOtp = async (order) => {
    try {
      setSendingOtpId(order._id);
      setOtpBannerMsg("");

      const { data } = await API.post(`/orders/${order._id}/send-otp`, {
        markOutForDelivery: true,
      });

      setOrders((prev) =>
        prev.map((o) =>
          o._id === order._id
            ? {
                ...o,
                orderStatus: data.orderStatus || "Sent to Delivery",
                otpSentAt: data.otpSentAt || new Date().toISOString(),
                isOtpVerified: false,
              }
            : o
        )
      );

      setOtpBannerMsg(
        `✅ Delivery OTP sent to customer for Order #${String(order._id)
          .slice(-6)
          .toUpperCase()}! Ask customer for OTP to verify delivery.`
      );
    } catch (error) {
      alert(error.response?.data?.message || "Failed to send delivery OTP");
    } finally {
      setSendingOtpId(null);
    }
  };

  const openOtpModalForOrder = (order) => {
    setOtpModal({
      open: true,
      order,
      otpInput: "",
      error: "",
      submitting: false,
    });
  };

  const closeOtpModal = () => {
    if (otpModal.submitting) return;
    setOtpModal(EMPTY_OTP_MODAL);
  };

  const handleStatusChange = async (order, newStatus) => {
    const currentStatus = getOrderStatus(order);

    // Require 4-digit OTP verification before marking order as Delivered
    if (
      newStatus === "Delivered" &&
      currentStatus !== "Delivered" &&
      !order.isOtpVerified
    ) {
      openOtpModalForOrder(order);
      return;
    }

    const nextPaymentStatus =
      newStatus === "Delivered" && isCodOrder(order)
        ? "Paid"
        : getPaymentStatus(order);

    try {
      const { data } = await API.put(`/orders/${order._id}/status`, {
        orderStatus: newStatus,
        paymentStatus: nextPaymentStatus,
        isPaid: nextPaymentStatus === "Paid",
      });

      const updatedOrder = data?.order ? data.order : data;
      const updatedStatus = updatedOrder?.orderStatus || newStatus;
      const updatedPaymentStatus =
        updatedOrder?.paymentStatus ||
        updatedOrder?.paymentInfo?.status ||
        nextPaymentStatus;

      setOrders((prev) =>
        prev.map((o) =>
          o._id === order._id
            ? {
                ...o,
                ...(typeof updatedOrder === "object" ? updatedOrder : {}),
                orderStatus: updatedStatus,
                paymentStatus: updatedPaymentStatus,
                isPaid: updatedPaymentStatus === "Paid",
              }
            : o
        )
      );
    } catch (error) {
      alert(error.response?.data?.message || "Failed to update order status");
    }
  };

  const handleVerifyAndDeliver = async (e) => {
    e.preventDefault();
    const cleanOtp = otpModal.otpInput.replace(/\D/g, "").slice(0, 4);

    if (cleanOtp.length !== 4) {
      return setOtpModal((prev) => ({
        ...prev,
        error: "Please enter a valid 4-digit delivery OTP.",
      }));
    }

    const targetOrder = otpModal.order;
    if (!targetOrder) return;

    const nextPaymentStatus = isCodOrder(targetOrder)
      ? "Paid"
      : getPaymentStatus(targetOrder);

    try {
      setOtpModal((prev) => ({ ...prev, submitting: true, error: "" }));

      const { data } = await API.put(`/orders/${targetOrder._id}/status`, {
        orderStatus: "Delivered",
        otp: cleanOtp,
        paymentStatus: nextPaymentStatus,
        isPaid: nextPaymentStatus === "Paid",
      });

      const updatedOrder = data?.order ? data.order : data;
      const finalPaymentStatus =
        updatedOrder?.paymentStatus ||
        updatedOrder?.paymentInfo?.status ||
        nextPaymentStatus;

      setOrders((prev) =>
        prev.map((o) =>
          o._id === targetOrder._id
            ? {
                ...o,
                ...(typeof updatedOrder === "object" ? updatedOrder : {}),
                orderStatus: updatedOrder?.orderStatus || "Delivered",
                isOtpVerified: true,
                paymentStatus: finalPaymentStatus,
                isPaid: finalPaymentStatus === "Paid",
              }
            : o
        )
      );

      setOtpModal(EMPTY_OTP_MODAL);
      setOtpBannerMsg(
        `🎉 OTP verified! Order #${String(targetOrder._id)
          .slice(-6)
          .toUpperCase()} marked as Delivered.`
      );
    } catch (error) {
      setOtpModal((prev) => ({
        ...prev,
        submitting: false,
        error: error.response?.data?.message || "OTP verification failed.",
      }));
    }
  };

  const handlePaymentStatusChange = async (order, newPaymentStatus) => {
    try {
      const { data } = await API.put(`/orders/${order._id}/status`, {
        orderStatus: getOrderStatus(order),
        paymentStatus: newPaymentStatus,
        isPaid: newPaymentStatus === "Paid",
      });

      const updatedOrder = data?.order ? data.order : data;
      const savedPaymentStatus =
        updatedOrder?.paymentStatus ||
        updatedOrder?.paymentInfo?.status ||
        newPaymentStatus;

      setOrders((prev) =>
        prev.map((o) =>
          o._id === order._id
            ? {
                ...o,
                ...(typeof updatedOrder === "object" ? updatedOrder : {}),
                paymentStatus: savedPaymentStatus,
                isPaid: savedPaymentStatus === "Paid",
              }
            : o
        )
      );
    } catch (error) {
      alert(error.response?.data?.message || "Failed to update payment status");
    }
  };

  const handleAddPizza = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: newPizza.name.trim(),
        category: newPizza.category,
        price: Number(newPizza.price),
        stock: Number(newPizza.stock),
        threshold: Number(newPizza.threshold),
        description:
          newPizza.description.trim() ||
          "Freshly baked artisanal pizza from PizzaHouse.",
        image:
          newPizza.image.trim() ||
          "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500",
      };

      const { data } = await API.post("/pizzas", payload);
      const createdPizza = data?.pizza ? data.pizza : data;
      setPizzas((prev) => [createdPizza, ...prev]);
      setNewPizza({
        name: "",
        category: "veg",
        price: 299,
        stock: 40,
        threshold: 10,
        description: "",
        image: "",
      });
      alert("✅ Pizza added with stock!");
    } catch (error) {
      alert(error.response?.data?.message || "Error adding pizza");
    }
  };

  const handleRestockPizza = async (id, currentStock) => {
    try {
      const nextStock = Number(currentStock || 0) + 25;
      const { data } = await API.put(`/pizzas/${id}`, { stock: nextStock });
      const updatedPizza = data?.pizza ? data.pizza : data;
      setPizzas((prev) =>
        prev.map((p) =>
          p._id === id
            ? typeof updatedPizza === "object" && updatedPizza?._id
              ? updatedPizza
              : { ...p, stock: nextStock }
            : p
        )
      );
    } catch (error) {
      alert(error.response?.data?.message || "Failed to restock pizza");
    }
  };

  const handleRestock = async (id, currentStock) => {
    try {
      const { data } = await API.put(`/pizzas/ingredients/${id}`, {
        stock: Number(currentStock || 0) + 25,
      });
      const updatedIng = data?.ingredient ? data.ingredient : data;
      setIngredients((prev) =>
        prev.map((item) => (item._id === id ? updatedIng : item))
      );
    } catch (error) {
      alert("Failed to update stock");
    }
  };

  const handleAddIngredient = async (e) => {
    e.preventDefault();
    try {
      const { data } = await API.post("/pizzas/ingredients", newIng);
      const createdIng = data?.ingredient ? data.ingredient : data;
      setIngredients((prev) => [...prev, createdIng]);
      setNewIng({
        name: "",
        category: "veggie",
        price: 30,
        stock: 50,
        threshold: 20,
      });
      alert("✅ Ingredient added to inventory!");
    } catch (error) {
      alert(error.response?.data?.message || "Error adding ingredient");
    }
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
      return phone ? `${base} • ${phone}` : base || "Standard Delivery";
    }
    return "Standard Delivery";
  };

  const getOrderStatusBadge = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "delivered") {
      return { bg: "#dcfce7", color: "#15803d", border: "#86efac" };
    }
    if (s === "cancelled") {
      return { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" };
    }
    if (s === "sent to delivery") {
      return { bg: "#e0e7ff", color: "#3730a3", border: "#a5b4fc" };
    }
    return { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
  };

  const getPaymentBadge = (paymentStatus) => {
    const p = String(paymentStatus || "Pending").toLowerCase();
    if (p === "paid") {
      return { bg: "#dcfce7", color: "#15803d", border: "#86efac" };
    }
    if (p === "failed" || p === "refunded") {
      return { bg: "#fee2e2", color: "#b91c1c", border: "#fca5a5" };
    }
    return { bg: "#fef3c7", color: "#b45309", border: "#fcd34d" };
  };

  const lowPizzaStockCount = pizzas.filter(
    (p) => Number(p.stock ?? 0) <= Number(p.threshold ?? 10)
  ).length;

  const lowIngStockCount = ingredients.filter(
    (i) => Number(i.stock ?? 0) <= Number(i.threshold ?? 20)
  ).length;

  const lowStockCount = lowPizzaStockCount + lowIngStockCount;

  const activeOrdersCount = orders.filter((o) => {
    const s = String(getOrderStatus(o)).toLowerCase();
    return s !== "delivered" && s !== "cancelled";
  }).length;

  const deliveredCount = orders.filter(
    (o) => String(getOrderStatus(o)).toLowerCase() === "delivered"
  ).length;

  const cancelledCount = orders.filter(
    (o) => String(getOrderStatus(o)).toLowerCase() === "cancelled"
  ).length;

  const paymentPendingCount = orders.filter((o) => {
    const p = String(getPaymentStatus(o)).toLowerCase();
    const s = String(getOrderStatus(o)).toLowerCase();
    return p === "pending" && s !== "cancelled";
  }).length;

  const totalRevenue = orders
    .filter((o) => String(getOrderStatus(o)).toLowerCase() !== "cancelled")
    .reduce((sum, o) => sum + Number(o.totalAmount ?? o.totalPrice ?? 0), 0);

  const filteredOrders = orders.filter((order) => {
    const status = String(getOrderStatus(order)).toLowerCase();
    const payStatus = String(getPaymentStatus(order)).toLowerCase();

    if (orderFilter === "ACTIVE") {
      return status !== "delivered" && status !== "cancelled";
    }
    if (orderFilter === "DELIVERED") return status === "delivered";
    if (orderFilter === "CANCELLED") return status === "cancelled";
    if (orderFilter === "PAYMENT_PENDING") {
      return payStatus === "pending" && status !== "cancelled";
    }
    if (orderFilter === "COD") {
      return isCodOrder(order);
    }
    return true;
  });

  const cardStyle = {
    background: "#fff",
    borderRadius: "18px",
    padding: "24px",
    border: "1px solid #edf0f5",
    boxShadow: "0 5px 25px rgba(15,23,42,.045)",
    marginBottom: "20px",
  };

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: "11px",
    background: "#f8fafc",
    fontSize: 13.5,
    color: "#1e293b",
    outline: "none",
  };

  const labelStyle = {
    display: "block",
    fontSize: 11.5,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 5,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fc",
        padding: "56px 16px 64px",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1080px", margin: "auto" }}>
        {/* Page Heading */}
        <div style={{ marginBottom: 24 }}>
          <p
            style={{
              color: "#f97316",
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: 2,
              margin: 0,
            }}
          >
            ADMIN CONTROL CENTER
          </p>

          <h1
            style={{
              color: "#172554",
              fontSize: 32,
              margin: "6px 0",
            }}
          >
            Kitchen, Delivery &amp; Payment Panel
          </h1>

          <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
            Send delivery OTPs, verify customer OTP on delivery, and manage pizza &amp; ingredient stocks.
          </p>
        </div>

        {/* Top Banner Card */}
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
              👨‍🍳
            </div>

            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>
                PizzaZone Kitchen Operations
              </h2>
              <p style={{ margin: "0 0 6px", color: "#cbd5e1", fontSize: 13 }}>
                {orders.length} total • {deliveredCount} delivered •{" "}
                {cancelledCount} cancelled • {paymentPendingCount} payment pending
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
                ●{" "}
                {liveConnected
                  ? "LIVE KITCHEN SOCKET CONNECTED"
                  : "ORDER SYNC READY"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              style={{
                padding: "11px 18px",
                borderRadius: "11px",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13.5,
                background:
                  activeTab === "orders" ? "#f97316" : "rgba(255,255,255,0.14)",
                color: "#fff",
              }}
            >
              Orders ({orders.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("inventory")}
              style={{
                padding: "11px 18px",
                borderRadius: "11px",
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13.5,
                background:
                  activeTab === "inventory"
                    ? "#f97316"
                    : "rgba(255,255,255,0.14)",
                color: "#fff",
              }}
            >
              Pizzas &amp; Stock{" "}
              {lowStockCount > 0 ? `• ⚠️ ${lowStockCount} Low` : ""}
            </button>
          </div>
        </div>

        {/* OTP Action Feedback Banner */}
        {otpBannerMsg && (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412",
              borderRadius: 14,
              padding: "12px 16px",
              marginBottom: 18,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              fontSize: 13.5,
              fontWeight: 700,
            }}
          >
            <span>{otpBannerMsg}</span>
            <button
              type="button"
              onClick={() => setOtpBannerMsg("")}
              style={{
                border: "none",
                background: "transparent",
                color: "#9a3412",
                fontWeight: 800,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Stats Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 14,
            marginBottom: 22,
          }}
        >
          {[
            {
              title: "Active Kitchen",
              value: loading ? "..." : activeOrdersCount,
              icon: "🔥",
            },
            {
              title: "Delivered",
              value: loading ? "..." : deliveredCount,
              icon: "✅",
            },
            {
              title: "Cancelled",
              value: loading ? "..." : cancelledCount,
              icon: "❌",
            },
            {
              title: "Payment Pending",
              value: loading ? "..." : paymentPendingCount,
              icon: "⏳",
            },
            {
              title: "Net Revenue",
              value: loading
                ? "..."
                : `₹${totalRevenue.toLocaleString("en-IN")}`,
              icon: "💰",
            },
          ].map((stat) => (
            <div
              key={stat.title}
              style={{ ...cardStyle, marginBottom: 0, padding: "20px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <p
                    style={{
                      color: "#64748b",
                      fontSize: 13,
                      margin: "0 0 6px",
                      fontWeight: 600,
                    }}
                  >
                    {stat.title}
                  </p>
                  <h2 style={{ margin: 0, fontSize: 25, color: "#172554" }}>
                    {stat.value}
                  </h2>
                </div>
                <span style={{ fontSize: 25 }}>{stat.icon}</span>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div
            style={{ ...cardStyle, textAlign: "center", padding: "48px 20px" }}
          >
            <p style={{ color: "#64748b", fontWeight: 700, margin: 0 }}>
              Loading kitchen &amp; inventory data...
            </p>
          </div>
        ) : activeTab === "orders" ? (
          <div>
            {/* Filter Pills */}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 18,
              }}
            >
              {[
                { key: "ALL", label: `All (${orders.length})` },
                { key: "ACTIVE", label: `Active (${activeOrdersCount})` },
                { key: "DELIVERED", label: `✅ Delivered (${deliveredCount})` },
                { key: "CANCELLED", label: `❌ Cancelled (${cancelledCount})` },
                {
                  key: "PAYMENT_PENDING",
                  label: `⏳ Payment Pending (${paymentPendingCount})`,
                },
                { key: "COD", label: "💵 Cash on Delivery" },
              ].map((tab) => {
                const active = orderFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setOrderFilter(tab.key)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 999,
                      border: active
                        ? "1px solid #172554"
                        : "1px solid #e2e8f0",
                      background: active ? "#172554" : "#fff",
                      color: active ? "#fff" : "#475569",
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: "pointer",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {filteredOrders.length === 0 ? (
              <div
                style={{
                  ...cardStyle,
                  textAlign: "center",
                  padding: "48px 20px",
                }}
              >
                <div style={{ fontSize: 42, marginBottom: 10 }}>🧾</div>
                <h3
                  style={{ margin: "0 0 6px", color: "#172554", fontSize: 20 }}
                >
                  No Orders in This Filter
                </h3>
                <p style={{ margin: 0, color: "#64748b", fontSize: 14 }}>
                  Switch filter tabs or wait for new incoming customer orders.
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const items =
                  Array.isArray(order.items) && order.items.length > 0
                    ? order.items
                    : order.orderItems || [];
                const total = Number(order.totalAmount ?? order.totalPrice ?? 0);
                const currentStatus = getOrderStatus(order);
                const isCOD = isCodOrder(order);
                const paymentStatus = getPaymentStatus(order);

                const isDelivered =
                  String(currentStatus).toLowerCase() === "delivered";
                const isCancelled =
                  String(currentStatus).toLowerCase() === "cancelled";

                const statusBadge = getOrderStatusBadge(currentStatus);
                const payBadge = getPaymentBadge(paymentStatus);

                return (
                  <div
                    key={order._id}
                    style={{
                      ...cardStyle,
                      borderLeft: isCancelled
                        ? "5px solid #dc2626"
                        : isDelivered
                        ? "5px solid #16a34a"
                        : "1px solid #edf0f5",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: 16,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 260 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 8,
                            marginBottom: 8,
                          }}
                        >
                          <h3
                            style={{
                              margin: 0,
                              fontSize: 18,
                              color: "#172554",
                            }}
                          >
                            Order #{String(order._id).slice(-6).toUpperCase()}{" "}
                            — <span style={{ color: "#f97316" }}>₹{total}</span>
                          </h3>

                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 800,
                              background: statusBadge.bg,
                              color: statusBadge.color,
                              border: `1px solid ${statusBadge.border}`,
                            }}
                          >
                            {currentStatus}
                          </span>

                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 800,
                              background: isCOD ? "#eef2ff" : "#f0fdf4",
                              color: isCOD ? "#3730a3" : "#166534",
                              border: `1px solid ${
                                isCOD ? "#c7d2fe" : "#bbf7d0"
                              }`,
                            }}
                          >
                            {isCOD ? "💵 Cash on Delivery" : "💳 Online"}
                          </span>

                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 800,
                              background: payBadge.bg,
                              color: payBadge.color,
                              border: `1px solid ${payBadge.border}`,
                            }}
                          >
                            Payment: {paymentStatus}
                          </span>

                          {order.isOtpVerified && (
                            <span
                              style={{
                                padding: "3px 10px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 800,
                                background: "#dcfce7",
                                color: "#15803d",
                                border: "1px solid #86efac",
                              }}
                            >
                              🔐 OTP Verified
                            </span>
                          )}
                        </div>

                        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                          Customer:{" "}
                          <strong style={{ color: "#1e293b" }}>
                            {order.user?.name || "Guest"}
                          </strong>
                          {order.user?.email ? ` (${order.user.email})` : ""} •
                          📍 {formatAddress(order)}
                        </p>

                        {!isDelivered && !isCancelled && (
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                              marginTop: 10,
                            }}
                          >
                            <button
                              type="button"
                              disabled={sendingOtpId === order._id}
                              onClick={() => handleSendDeliveryOtp(order)}
                              style={{
                                padding: "8px 13px",
                                borderRadius: 9,
                                border: "1px solid #c7d2fe",
                                background: "#eef2ff",
                                color: "#3730a3",
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                            >
                              {sendingOtpId === order._id
                                ? "Sending OTP..."
                                : order.otpSentAt
                                ? "🔁 Resend Delivery OTP"
                                : "📤 Send Delivery OTP"}
                            </button>

                            <button
                              type="button"
                              onClick={() => openOtpModalForOrder(order)}
                              style={{
                                padding: "8px 13px",
                                borderRadius: 9,
                                border: "none",
                                background: "#16a34a",
                                color: "#fff",
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                            >
                              🔐 Verify OTP &amp; Deliver
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Status Dropdowns */}
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          flexWrap: "wrap",
                          alignItems: "flex-end",
                        }}
                      >
                        <div style={{ minWidth: 175 }}>
                          <label style={labelStyle}>Delivery / Order Status</label>
                          <select
                            style={{
                              ...inputStyle,
                              cursor: "pointer",
                              fontWeight: 700,
                            }}
                            value={currentStatus}
                            onChange={(e) =>
                              handleStatusChange(order, e.target.value)
                            }
                          >
                            {ORDER_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ minWidth: 155 }}>
                          <label style={labelStyle}>Payment Status</label>
                          <select
                            style={{
                              ...inputStyle,
                              cursor: "pointer",
                              fontWeight: 700,
                            }}
                            value={paymentStatus}
                            onChange={(e) =>
                              handlePaymentStatusChange(order, e.target.value)
                            }
                          >
                            {PAYMENT_STATUSES.map((pStatus) => (
                              <option key={pStatus} value={pStatus}>
                                {pStatus}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Items List */}
                    <div
                      style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: "1px solid #f1f5f9",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {items.map((item, idx) => {
                        const qty = Number(item.qty ?? item.quantity ?? 1);
                        return (
                          <div
                            key={item._id || idx}
                            style={{ fontSize: 13.5, color: "#334155" }}
                          >
                            <strong style={{ color: "#172554" }}>
                              • {item.name}
                            </strong>{" "}
                            ({item.size || "medium"} × {qty}) — ₹
                            {Number(item.price || 0) * qty}
                            {item.isCustom && item.customDetails && (
                              <span
                                style={{
                                  color: "#9a3412",
                                  background: "#fff7ed",
                                  border: "1px solid #fed7aa",
                                  borderRadius: 8,
                                  padding: "2px 8px",
                                  fontSize: 12,
                                  marginLeft: 8,
                                  display: "inline-block",
                                }}
                              >
                                {item.customDetails.base?.name},{" "}
                                {item.customDetails.sauce?.name},{" "}
                                {item.customDetails.cheese?.name}
                                {item.customDetails.veggies?.length > 0 &&
                                  `, Veggies: ${item.customDetails.veggies
                                    .map((v) => v.name)
                                    .join(", ")}`}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div>
            {/* Add New Pizza + Stock Form */}
            <div style={cardStyle}>
              <h3
                style={{ margin: "0 0 14px", fontSize: 18, color: "#172554" }}
              >
                🍕 Add New Pizza &amp; Initial Stock
              </h3>
              <form
                onSubmit={handleAddPizza}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
                  gap: 12,
                  alignItems: "end",
                }}
              >
                <div>
                  <label style={labelStyle}>Pizza Name *</label>
                  <input
                    style={inputStyle}
                    required
                    placeholder="e.g. Farmhouse Pizza"
                    value={newPizza.name}
                    onChange={(e) =>
                      setNewPizza({ ...newPizza, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>Category</label>
                  <select
                    style={inputStyle}
                    value={newPizza.category}
                    onChange={(e) =>
                      setNewPizza({ ...newPizza, category: e.target.value })
                    }
                  >
                    <option value="veg">Veg</option>
                    <option value="non-veg">Non-Veg</option>
                    <option value="special">Special</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Price (₹) *</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    required
                    value={newPizza.price}
                    onChange={(e) =>
                      setNewPizza({ ...newPizza, price: Number(e.target.value) })
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>Initial Stock *</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    required
                    value={newPizza.stock}
                    onChange={(e) =>
                      setNewPizza({ ...newPizza, stock: Number(e.target.value) })
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>Low Stock Alert</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min="1"
                    value={newPizza.threshold}
                    onChange={(e) =>
                      setNewPizza({
                        ...newPizza,
                        threshold: Number(e.target.value),
                      })
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>Image URL</label>
                  <input
                    style={inputStyle}
                    placeholder="https://..."
                    value={newPizza.image}
                    onChange={(e) =>
                      setNewPizza({ ...newPizza, image: e.target.value })
                    }
                  />
                </div>

                <div style={{ gridColumn: "1 / -2" }}>
                  <label style={labelStyle}>Description</label>
                  <input
                    style={inputStyle}
                    placeholder="Short description of toppings and crust"
                    value={newPizza.description}
                    onChange={(e) =>
                      setNewPizza({ ...newPizza, description: e.target.value })
                    }
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    padding: "11px 18px",
                    border: "none",
                    borderRadius: "11px",
                    background: "#f97316",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  + Add Pizza
                </button>
              </form>
            </div>

            {/* Pizza Menu Stock Grid */}
            {pizzas.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3
                  style={{
                    margin: "0 0 12px",
                    fontSize: 18,
                    color: "#172554",
                  }}
                >
                  🍕 Pizza Menu Stock ({pizzas.length})
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(245px, 1fr))",
                    gap: 16,
                  }}
                >
                  {pizzas.map((pizza) => {
                    const pStock = Number(pizza.stock ?? 0);
                    const pThreshold = Number(pizza.threshold ?? 10);
                    const isLow = pStock <= pThreshold;

                    return (
                      <div
                        key={pizza._id}
                        style={{
                          ...cardStyle,
                          marginBottom: 0,
                          borderLeft: `5px solid ${
                            isLow ? "#dc2626" : "#16a34a"
                          }`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: "999px",
                              background: "#fff7ed",
                              color: "#ea580c",
                              border: "1px solid #fed7aa",
                              fontSize: 11,
                              fontWeight: 800,
                              textTransform: "uppercase",
                            }}
                          >
                            {pizza.category || "pizza"}
                          </span>

                          {isLow && (
                            <span
                              style={{
                                color: "#dc2626",
                                fontWeight: 800,
                                fontSize: 11,
                              }}
                            >
                              ⚠️ LOW STOCK
                            </span>
                          )}
                        </div>

                        <h4
                          style={{
                            margin: "10px 0 6px",
                            fontSize: 17,
                            color: "#172554",
                          }}
                        >
                          {pizza.name}
                        </h4>

                        <p
                          style={{ margin: 0, fontSize: 13, color: "#64748b" }}
                        >
                          Price: <strong>₹{pizza.price}</strong> • Alert ≤{" "}
                          {pThreshold}
                        </p>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: 16,
                            paddingTop: 12,
                            borderTop: "1px solid #f1f5f9",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 17,
                              fontWeight: 800,
                              color: isLow ? "#dc2626" : "#172554",
                            }}
                          >
                            Stock: {pStock}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleRestockPizza(pizza._id, pStock)}
                            style={{
                              padding: "7px 12px",
                              border: "none",
                              borderRadius: "9px",
                              background: "#172554",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: 12.5,
                              cursor: "pointer",
                            }}
                          >
                            +25 Restock
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add New Ingredient Form */}
            <div style={cardStyle}>
              <h3
                style={{ margin: "0 0 14px", fontSize: 18, color: "#172554" }}
              >
                + Add New Ingredient Stock
              </h3>
              <form
                onSubmit={handleAddIngredient}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
                  gap: 12,
                  alignItems: "end",
                }}
              >
                <div>
                  <label style={labelStyle}>Item Name</label>
                  <input
                    style={inputStyle}
                    required
                    placeholder="e.g. Garlic Crust"
                    value={newIng.name}
                    onChange={(e) =>
                      setNewIng({ ...newIng, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>Category</label>
                  <select
                    style={inputStyle}
                    value={newIng.category}
                    onChange={(e) =>
                      setNewIng({ ...newIng, category: e.target.value })
                    }
                  >
                    <option value="base">Base</option>
                    <option value="sauce">Sauce</option>
                    <option value="cheese">Cheese</option>
                    <option value="veggie">Veggie</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Price (₹)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    required
                    value={newIng.price}
                    onChange={(e) =>
                      setNewIng({ ...newIng, price: Number(e.target.value) })
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>Initial Stock</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    required
                    value={newIng.stock}
                    onChange={(e) =>
                      setNewIng({ ...newIng, stock: Number(e.target.value) })
                    }
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    padding: "11px 18px",
                    border: "none",
                    borderRadius: "11px",
                    background: "#f97316",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  + Add Item
                </button>
              </form>
            </div>

            {/* Ingredient Inventory Grid */}
            <h3
              style={{ margin: "0 0 12px", fontSize: 18, color: "#172554" }}
            >
              🧂 Custom Pizza Ingredients Stock ({ingredients.length})
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(245px, 1fr))",
                gap: 16,
              }}
            >
              {ingredients.map((item) => {
                const stockVal = Number(item.stock ?? 0);
                const thresholdVal = Number(item.threshold ?? 20);
                const isLow = stockVal <= thresholdVal;

                return (
                  <div
                    key={item._id}
                    style={{
                      ...cardStyle,
                      marginBottom: 0,
                      borderLeft: `5px solid ${isLow ? "#dc2626" : "#16a34a"}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          padding: "4px 10px",
                          borderRadius: "999px",
                          background: "#fff7ed",
                          color: "#ea580c",
                          border: "1px solid #fed7aa",
                          fontSize: 11,
                          fontWeight: 800,
                          textTransform: "uppercase",
                        }}
                      >
                        {item.category}
                      </span>

                      {isLow && (
                        <span
                          style={{
                            color: "#dc2626",
                            fontWeight: 800,
                            fontSize: 11,
                          }}
                        >
                          ⚠️ LOW STOCK
                        </span>
                      )}
                    </div>

                    <h3
                      style={{
                        margin: "10px 0 6px",
                        fontSize: 17,
                        color: "#172554",
                      }}
                    >
                      {item.name}
                    </h3>

                    <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                      Price: <strong>₹{item.price}</strong> • Alert ≤{" "}
                      {thresholdVal}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: 16,
                        paddingTop: 12,
                        borderTop: "1px solid #f1f5f9",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 17,
                          fontWeight: 800,
                          color: isLow ? "#dc2626" : "#172554",
                        }}
                      >
                        Stock: {stockVal}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRestock(item._id, stockVal)}
                        style={{
                          padding: "7px 12px",
                          border: "none",
                          borderRadius: "9px",
                          background: "#172554",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12.5,
                          cursor: "pointer",
                        }}
                      >
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

      {/* Delivery OTP Verification Modal */}
      {otpModal.open && otpModal.order && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              background: "#fff",
              borderRadius: 18,
              padding: 24,
              border: "1px solid #edf0f5",
              boxShadow: "0 20px 45px rgba(15, 23, 42, 0.25)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 11,
                fontWeight: 800,
                color: "#f97316",
                letterSpacing: 1.5,
              }}
            >
              DELIVERY OTP VERIFICATION
            </p>

            <h3
              style={{ margin: "6px 0 8px", fontSize: 20, color: "#172554" }}
            >
              Verify Order #{String(otpModal.order._id).slice(-6).toUpperCase()}
            </h3>

            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#64748b" }}>
              Enter the 4-digit OTP shared by the customer to mark this order as
              Delivered.
            </p>

            <div
              style={{
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: 11,
                padding: "10px 12px",
                marginBottom: 14,
                fontSize: 12,
                lineHeight: 1.5,
                color: "#9a3412",
                fontWeight: 600,
              }}
            >
              📌 <strong>Note:</strong> Mark as <strong>Delivered</strong> only
              after verifying the 4-digit OTP with the customer
              {isCodOrder(otpModal.order)
                ? " and collecting Cash on Delivery payment."
                : "."}
            </div>

            <form onSubmit={handleVerifyAndDeliver}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                placeholder="0000"
                value={otpModal.otpInput}
                onChange={(e) =>
                  setOtpModal((prev) => ({
                    ...prev,
                    otpInput: e.target.value.replace(/\D/g, "").slice(0, 4),
                    error: "",
                  }))
                }
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 11,
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: 10,
                  textAlign: "center",
                  color: "#172554",
                  marginBottom: 10,
                }}
              />

              {otpModal.error && (
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: "#dc2626",
                  }}
                >
                  ⚠️ {otpModal.error}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  disabled={otpModal.submitting}
                  onClick={closeOtpModal}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    color: "#475569",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={otpModal.submitting}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 10,
                    border: "none",
                    background: "#f97316",
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {otpModal.submitting ? "Verifying..." : "Verify & Deliver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}