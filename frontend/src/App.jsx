import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import AdminDashboard from "./admin/AdminDashboard";
import AdminProfile from "./admin/AdminProfile";
import Navbar from "./components/Navbar";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import Cart from "./user/Cart";
import Checkout from "./user/Checkout";
import CustomPizzaBuilder from "./user/CustomPizzaBuilder";
import Menu from "./user/Menu";
import MyOrders from "./user/MyOrders";
import Profile from "./user/Profile";

const HIDE_NAVBAR_PATHS = ["/login", "/register"];
const ADMIN_DASHBOARD_PATH = "/admin/admindashboard";

const getUserRole = (user) =>
  String(user?.role || user?.user?.role || "")
    .toLowerCase()
    .trim();

const RouteLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center text-gray-500 font-semibold">
    Loading...
  </div>
);

const UserRoute = ({ children, requireAuth = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <RouteLoader />;

  const role = getUserRole(user);

  if (role === "admin") {
    return <Navigate to={ADMIN_DASHBOARD_PATH} replace />;
  }

  if (requireAuth && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <RouteLoader />;

  const role = getUserRole(user);

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
};

function AppRoutes() {
  const { pathname } = useLocation();
  const shouldHideNavbar = HIDE_NAVBAR_PATHS.includes(pathname.toLowerCase());

  return (
    <>
      {!shouldHideNavbar && <Navbar />}

      <Routes>
        {/* Public Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />

        {/* User / Guest Routes */}
        <Route
          path="/"
          element={
            <UserRoute>
              <Home />
            </UserRoute>
          }
        />
        <Route
          path="/menu"
          element={
            <UserRoute>
              <Menu />
            </UserRoute>
          }
        />
        <Route
          path="/build-pizza"
          element={
            <UserRoute>
              <CustomPizzaBuilder />
            </UserRoute>
          }
        />
        <Route
          path="/cart"
          element={
            <UserRoute>
              <Cart />
            </UserRoute>
          }
        />

        {/* Protected User Routes */}
        <Route
          path="/checkout"
          element={
            <UserRoute requireAuth>
              <Checkout />
            </UserRoute>
          }
        />
        <Route
          path="/my-orders"
          element={
            <UserRoute requireAuth>
              <MyOrders />
            </UserRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <UserRoute requireAuth>
              <Profile />
            </UserRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={<Navigate to={ADMIN_DASHBOARD_PATH} replace />}
        />
        <Route
          path={ADMIN_DASHBOARD_PATH}
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/adminprofile"
          element={
            <AdminRoute>
              <AdminProfile />
            </AdminRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}