import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { cart } = useCart();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navHeight, setNavHeight] = useState(76);
  const navRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const updateHeight = () => {
      setNavHeight(el.offsetHeight || 76);
    };

    updateHeight();

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateHeight)
        : null;

    if (observer) observer.observe(el);
    window.addEventListener('resize', updateHeight);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [menuOpen]);

  const role = String(user?.role || user?.user?.role || '')
    .toLowerCase()
    .trim();
  const isAdmin = role === 'admin';
  const isUser = role === 'user';

  const adminDashboardPath = '/admin/admindashboard';
  const brandTarget = isAdmin ? adminDashboardPath : '/';

  const totalItems = Array.isArray(cart)
    ? cart.reduce(
        (sum, item) => sum + (Number(item.qty ?? item.quantity) || 1),
        0
      )
    : 0;

  const desktopNavClass = ({ isActive }) =>
    `font-semibold whitespace-nowrap transition-colors duration-200 text-sm lg:text-[15px] ${
      isActive
        ? 'text-[#e63946]'
        : 'text-gray-700 hover:text-[#e63946]'
    }`;

  const mobileNavClass = ({ isActive }) =>
    `block px-3 py-2.5 rounded-xl font-semibold transition-colors duration-200 text-sm ${
      isActive
        ? 'bg-red-50 text-[#e63946]'
        : 'text-gray-700 hover:bg-orange-50 hover:text-[#e63946]'
    }`;

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <>
      <nav
        ref={navRef}
        className="fixed top-0 left-0 right-0 w-full z-50 bg-white/80 backdrop-blur-md saturate-150 shadow-[0_4px_20px_rgba(0,0,0,0.06)] border-b border-gray-200/70"
      >
        <div className="w-full max-w-[1360px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between w-full gap-4">
            {/* Left: Logo */}
            <Link
              to={brandTarget}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 group shrink-0"
            >
              <span className="text-3xl sm:text-4xl group-hover:rotate-12 transition-transform duration-300">
                🍕
              </span>
              <div>
                <span className="block text-xl sm:text-2xl font-black tracking-tight text-gray-900 leading-none">
                  Pizza<span className="text-[#e63946]">House</span>
                </span>
                <span className="block mt-1 text-[10px] font-bold tracking-[2.6px] text-gray-400 uppercase leading-none">
                  {isAdmin ? 'Admin Kitchen' : 'Fresh & Delicious'}
                </span>
              </div>
            </Link>

            {/* Right Side Desktop Links */}
            <div className="hidden md:flex items-center gap-5 lg:gap-6 ml-auto md:mr-4 lg:mr-8">
              {isAdmin ? (
                <>
                  <NavLink to={adminDashboardPath} className={desktopNavClass}>
                    Dashboard 📊
                  </NavLink>

                  <NavLink to="/admin/adminprofile" className={desktopNavClass}>
                    Profile
                  </NavLink>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-4 py-2 rounded-xl bg-red-50 text-[#e63946] font-bold hover:bg-red-100 transition duration-200 text-sm whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/" end className={desktopNavClass}>
                    Our Menu
                  </NavLink>

                  <NavLink to="/build-pizza" className={desktopNavClass}>
                    Build Pizza 🛠️
                  </NavLink>

                  <NavLink to="/my-orders" className={desktopNavClass}>
                    My Orders 📦
                  </NavLink>

                  {isUser && (
                    <NavLink
                      to="/profile"
                      className={({ isActive }) =>
                        `font-semibold whitespace-nowrap transition-colors duration-200 text-sm lg:text-[15px] ${
                          isActive
                            ? 'text-purple-800 underline underline-offset-4'
                            : 'text-purple-600 hover:text-purple-800'
                        }`
                      }
                    >
                      Profile
                    </NavLink>
                  )}

                  <Link
                    to="/cart"
                    className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-50 text-gray-800 hover:bg-orange-100 transition duration-200 shrink-0"
                  >
                    <span className="text-base leading-none">🛒</span>
                    <span className="font-bold text-sm">Cart</span>

                    {totalItems > 0 && (
                      <span className="absolute -top-2 -right-2 bg-[#e63946] text-white text-[11px] font-bold min-w-5 h-5 px-1 rounded-full flex items-center justify-center shadow">
                        {totalItems}
                      </span>
                    )}
                  </Link>

                  {user ? (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="px-4 py-2 rounded-xl bg-red-50 text-[#e63946] font-bold hover:bg-red-100 transition duration-200 text-sm whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Logout
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#e63946] to-[#ff7043] text-white font-bold shadow-md shadow-red-200/70 hover:shadow-lg hover:scale-[1.03] transition duration-200 text-sm whitespace-nowrap shrink-0"
                    >
                      Login →
                    </Link>
                  )}
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl text-2xl text-gray-800 hover:bg-gray-100 focus:outline-none shrink-0 cursor-pointer"
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>

          {/* Mobile Navigation Drawer */}
          {menuOpen && (
            <div className="md:hidden mt-3 pb-3 border-t border-gray-100 pt-3 flex flex-col gap-1.5">
              {isAdmin ? (
                <>
                  <NavLink
                    to={adminDashboardPath}
                    onClick={() => setMenuOpen(false)}
                    className={mobileNavClass}
                  >
                    📊 Admin Dashboard
                  </NavLink>
                  <NavLink
                    to="/admin/adminprofile"
                    onClick={() => setMenuOpen(false)}
                    className={mobileNavClass}
                  >
                    👤 Admin Profile
                  </NavLink>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 text-center bg-red-50 text-[#e63946] py-2.5 rounded-xl font-bold cursor-pointer"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <NavLink
                    to="/"
                    end
                    onClick={() => setMenuOpen(false)}
                    className={mobileNavClass}
                  >
                    🍕 Our Menu
                  </NavLink>
                  <NavLink
                    to="/build-pizza"
                    onClick={() => setMenuOpen(false)}
                    className={mobileNavClass}
                  >
                    🛠️ Build Custom Pizza
                  </NavLink>
                  <NavLink
                    to="/my-orders"
                    onClick={() => setMenuOpen(false)}
                    className={mobileNavClass}
                  >
                    📦 My Orders
                  </NavLink>
                  {isUser && (
                    <NavLink
                      to="/profile"
                      onClick={() => setMenuOpen(false)}
                      className="block px-3 py-2.5 rounded-xl font-semibold text-purple-600 hover:bg-purple-50 text-sm"
                    >
                      👤 Profile
                    </NavLink>
                  )}
                  <Link
                    to="/cart"
                    onClick={() => setMenuOpen(false)}
                    className="mt-1 font-semibold text-gray-800 flex items-center justify-between bg-orange-50 hover:bg-orange-100 px-4 py-2.5 rounded-xl text-sm transition"
                  >
                    <span>🛒 Cart</span>
                    <span className="bg-[#e63946] text-white px-2.5 py-0.5 rounded-full text-xs font-bold">
                      {totalItems} {totalItems === 1 ? 'item' : 'items'}
                    </span>
                  </Link>
                  {user ? (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="mt-1 text-center bg-red-50 text-[#e63946] py-2.5 rounded-xl font-bold cursor-pointer"
                    >
                      Logout
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      onClick={() => setMenuOpen(false)}
                      className="mt-1 text-center bg-gradient-to-r from-[#e63946] to-[#ff7043] text-white py-2.5 rounded-xl font-bold shadow-md text-sm"
                    >
                      Login →
                    </Link>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Spacer so page content starts cleanly below fixed navbar */}
      <div style={{ height: `${navHeight}px` }} aria-hidden="true" />
    </>
  );
}