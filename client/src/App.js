import React, { useState, useEffect } from "react";
import {
  Briefcase,
  ShoppingCart,
  TrendingUp,
  HelpCircle,
} from "lucide-react";
import Dashboard from "./Dashboard";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

// ===== Static Pages =====
const AboutPage = () => (
  <div className="p-8 text-center bg-white rounded-xl shadow-lg border mt-8 max-w-2xl mx-auto">
    <h2 className="text-3xl font-bold mb-4 text-blue-600">About Grow Stocks</h2>
    <p className="text-gray-700 leading-relaxed">
      Grow Stocks is an AI-powered trading platform that helps you analyze your
      investments, make data-driven decisions, and access Gemini AI predictions.
      Built with React, Firebase, and Gemini API for real-time insights.
    </p>
  </div>
);

const PricingPage = () => (
  <div className="p-8 text-center bg-gray-50 rounded-xl shadow-lg mt-8 max-w-4xl mx-auto">
    <h2 className="text-3xl font-bold mb-6 text-blue-600">Pricing & Plans</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="p-6 border rounded-xl bg-white shadow-md hover:shadow-lg transition">
        <h3 className="font-bold text-lg mb-2">Basic</h3>
        <p className="text-2xl font-semibold text-blue-600">₹0</p>
        <ul className="text-gray-600 mt-3 text-sm">
          <li>✔ Free brokerage</li>
          <li>✔ Basic charts</li>
          <li>✔ Real-time quotes</li>
        </ul>
      </div>
      <div className="p-6 border rounded-xl bg-blue-600 text-white shadow-lg scale-105">
        <h3 className="font-bold text-lg mb-2">Pro</h3>
        <p className="text-2xl font-semibold">₹99/mo</p>
        <ul className="mt-3 text-sm">
          <li>✔ Everything in Basic</li>
          <li>✔ Advanced analytics</li>
          <li>✔ Priority support</li>
        </ul>
      </div>
      <div className="p-6 border rounded-xl bg-white shadow-md hover:shadow-lg transition">
        <h3 className="font-bold text-lg mb-2">AI Analyst</h3>
        <p className="text-2xl font-semibold text-blue-600">₹499/mo</p>
        <ul className="text-gray-600 mt-3 text-sm">
          <li>✔ Everything in Pro</li>
          <li>✔ Gemini AI Recommendations</li>
          <li>✔ Predictive Market Insights</li>
        </ul>
      </div>
    </div>
  </div>
);

const SupportPage = () => (
  <div className="p-8 text-center bg-white rounded-xl shadow-lg border mt-8 max-w-2xl mx-auto">
    <h2 className="text-3xl font-bold mb-4 text-blue-600">Support Center</h2>
    <p className="text-gray-700">
      Need help? Email us at{" "}
      <a
        href="mailto:support@growstocks.com"
        className="text-blue-600 underline"
      >
        support@growstocks.com
      </a>
      . We’re happy to assist!
    </p>
  </div>
);

// ===== Main App =====
const App = () => {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("Dashboard");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setPage("Dashboard");
    });
    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setPage("Dashboard");
  };

  const renderPage = () => {
    switch (page) {
      case "Dashboard":
        return <Dashboard />;
      case "About":
        return <AboutPage />;
      case "Pricing":
        return <PricingPage />;
      case "Support":
        return <SupportPage />;
      default:
        return <Dashboard />;
    }
  };

  const navItems = [
    { name: "Dashboard", page: "Dashboard", icon: Briefcase },
    { name: "About", page: "About", icon: HelpCircle },
    { name: "Pricing", page: "Pricing", icon: ShoppingCart },
    { name: "Support", page: "Support", icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10 border-b">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center h-16">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-blue-600 mr-2" />
            <span className="text-xl font-bold text-gray-800">
              Grow Stocks
            </span>
          </div>

          <nav className="flex items-center space-x-4">
            {navItems.map((n) => (
              <button
                key={n.name}
                onClick={() => setPage(n.page)}
                className={`text-sm px-3 py-2 rounded-lg transition ${
                  page === n.page
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {n.name}
              </button>
            ))}
            {user && (
              <button
                onClick={handleLogout}
                className="text-sm px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                Logout
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main>{renderPage()}</main>

      {/* Footer */}
      <footer className="text-center text-gray-500 py-6 border-t mt-8">
        © {new Date().getFullYear()} Grow Stocks — Built with ❤️ using React, Firebase & Gemini AI
      </footer>
    </div>
  );
};

export default App;
