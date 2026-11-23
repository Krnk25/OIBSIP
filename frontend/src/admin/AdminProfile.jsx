import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ADMIN_PHONE_KEY = "pizzaAdminContactMobile";
const ADMIN_KITCHEN_KEY = "pizzaAdminKitchenInfo";

export default function AdminProfile() {
  const { user } = useAuth();

  const [phone, setPhone] = useState("");
  const [phoneSavedMsg, setPhoneSavedMsg] = useState("");

  const [kitchenInfo, setKitchenInfo] = useState({
    kitchenName: "PizzaHouse Central Kitchen",
    branchCity: "",
    supportNote: "",
  });
  const [kitchenSavedMsg, setKitchenSavedMsg] = useState("");

  useEffect(() => {
    const savedMobile = (localStorage.getItem(ADMIN_PHONE_KEY) || "")
      .replace(/\D/g, "")
      .slice(0, 10);
    if (savedMobile) {
      setPhone(savedMobile);
    }

    try {
      const parsed = JSON.parse(localStorage.getItem(ADMIN_KITCHEN_KEY) || "{}");
      if (parsed && typeof parsed === "object") {
        setKitchenInfo((prev) => ({
          ...prev,
          ...parsed,
        }));
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  const handleSavePhone = (e) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, "").slice(0, 10);
    setPhone(cleanPhone);
    localStorage.setItem(ADMIN_PHONE_KEY, cleanPhone);
    setPhoneSavedMsg("Saved!");
    setTimeout(() => setPhoneSavedMsg(""), 2000);
  };

  const handleSaveKitchen = (e) => {
    e.preventDefault();
    const cleanData = {
      kitchenName:
        kitchenInfo.kitchenName.trim() || "PizzaHouse Central Kitchen",
      branchCity: kitchenInfo.branchCity.trim(),
      supportNote: kitchenInfo.supportNote.trim(),
    };
    setKitchenInfo(cleanData);
    localStorage.setItem(ADMIN_KITCHEN_KEY, JSON.stringify(cleanData));
    setKitchenSavedMsg("Kitchen details updated!");
    setTimeout(() => setKitchenSavedMsg(""), 2500);
  };

  const displayName = user?.name || user?.user?.name || "Kitchen Admin";
  const displayEmail = user?.email || user?.user?.email || "admin@pizzahouse.com";
  const displayRole = String(
    user?.role || user?.user?.role || "admin",
  ).toUpperCase();

  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AD";

  const cardStyle = {
    background: "#fff",
    borderRadius: "18px",
    padding: "25px",
    border: "1px solid #edf0f5",
    boxShadow: "0 5px 25px rgba(15,23,42,.045)",
    marginBottom: "20px",
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #e2e8f0",
    borderRadius: "11px",
    background: "#f8fafc",
    fontSize: 14,
    color: "#1e293b",
    outline: "none",
  };

  const labelStyle = {
    display: "block",
    fontSize: 12.5,
    fontWeight: 700,
    color: "#334155",
    marginBottom: 6,
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
      <div style={{ maxWidth: "950px", margin: "auto" }}>
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
            ADMIN ACCOUNT &amp; KITCHEN SETTINGS
          </p>

          <h1
            style={{
              color: "#172554",
              fontSize: 32,
              margin: "6px 0",
            }}
          >
            Admin Profile
          </h1>

          <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
            View your administrator account details and manage kitchen dispatch
            settings.
          </p>
        </div>

        {/* Profile Banner Card */}
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
                fontSize: 22,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {initials}
            </div>

            <div>
              <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>{displayName}</h2>
              <p style={{ margin: "0 0 6px", color: "#cbd5e1", fontSize: 13 }}>
                {displayEmail}
              </p>
              <span
                style={{
                  color: "#fed7aa",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.8,
                }}
              >
                ● ROLE: {displayRole}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              to="/admin/admindashboard"
              style={{
                padding: "11px 18px",
                borderRadius: "11px",
                background: "#f97316",
                color: "#fff",
                fontWeight: 700,
                textDecoration: "none",
                fontSize: 13.5,
              }}
            >
              Go to Dashboard →
            </Link>
          </div>
        </div>

        {/* Account Overview Card */}
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 14px", fontSize: 18, color: "#172554" }}>
            Administrator Account Info
          </h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 700 }}>
                ADMIN NAME
              </span>
              <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700, color: "#172554" }}>
                {displayName}
              </p>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 700 }}>
                EMAIL ADDRESS
              </span>
              <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700, color: "#172554" }}>
                {displayEmail}
              </p>
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 700 }}>
                ACCESS LEVEL
              </span>
              <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700, color: "#f97316" }}>
                {displayRole} (Orders, OTP &amp; Stock)
              </p>
            </div>
          </div>
        </div>

        {/* Dispatch Contact Number Card */}
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 6px", fontSize: 18, color: "#172554" }}>
            Kitchen / Dispatch Contact Number
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>
            Contact number for order coordination and delivery desk reference.
          </p>

          <form
            onSubmit={handleSavePhone}
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              type="tel"
              maxLength={10}
              placeholder="10-digit contact number"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              style={{ ...inputStyle, maxWidth: 280 }}
            />
            <button
              type="submit"
              style={{
                padding: "12px 20px",
                border: "none",
                borderRadius: "11px",
                background: "#f97316",
                color: "#fff",
                fontWeight: 700,
                fontSize: 13.5,
                cursor: "pointer",
              }}
            >
              Save Contact
            </button>
            {phoneSavedMsg && (
              <span
                style={{
                  color: "#16a34a",
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                ✓ {phoneSavedMsg}
              </span>
            )}
          </form>
        </div>

        {/* Kitchen Branch Details Card */}
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 6px", fontSize: 18, color: "#172554" }}>
            Kitchen &amp; Dispatch Details
          </h3>
          <p style={{ margin: "0 0 18px", fontSize: 13, color: "#64748b" }}>
            Keep your active kitchen name and delivery zone note up to date.
          </p>

          <form
            onSubmit={handleSaveKitchen}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 14,
              }}
            >
              <div>
                <label style={labelStyle}>Kitchen Name</label>
                <input
                  type="text"
                  placeholder="PizzaHouse Kitchen"
                  value={kitchenInfo.kitchenName}
                  onChange={(e) =>
                    setKitchenInfo({
                      ...kitchenInfo,
                      kitchenName: e.target.value,
                    })
                  }
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>City / Zone</label>
                <input
                  type="text"
                  placeholder="Enter kitchen city or delivery zone"
                  value={kitchenInfo.branchCity}
                  onChange={(e) =>
                    setKitchenInfo({
                      ...kitchenInfo,
                      branchCity: e.target.value,
                    })
                  }
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Delivery / OTP Instructions Note</label>
              <input
                type="text"
                placeholder="e.g. Always verify 4-digit OTP before marking Delivered"
                value={kitchenInfo.supportNote}
                onChange={(e) =>
                  setKitchenInfo({
                    ...kitchenInfo,
                    supportNote: e.target.value,
                  })
                }
                style={inputStyle}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                paddingTop: 4,
              }}
            >
              {kitchenSavedMsg ? (
                <span
                  style={{
                    color: "#16a34a",
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  ✓ {kitchenSavedMsg}
                </span>
              ) : (
                <span />
              )}

              <button
                type="submit"
                style={{
                  padding: "12px 22px",
                  border: "none",
                  borderRadius: "11px",
                  background: "#172554",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Save Kitchen Info
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}