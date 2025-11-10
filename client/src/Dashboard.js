import React, { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Cpu } from "lucide-react";
import { auth } from "./firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";

// ===== Mock fallback data =====
const portfolioDistribution = [
  { name: "Technology", value: 40000, color: "#3b82f6" },
  { name: "Finance", value: 25000, color: "#10b981" },
  { name: "Healthcare", value: 15000, color: "#ef4444" },
  { name: "Energy", value: 10000, color: "#f59e0b" },
];

const historicalPnl = [
  { name: "Jan", pnl: 400 },
  { name: "Feb", pnl: 300 },
  { name: "Mar", pnl: 800 },
  { name: "Apr", pnl: -200 },
  { name: "May", pnl: 600 },
  { name: "Jun", pnl: 500 },
];

// ===== Login / Signup =====
const LoginSignup = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState("");

  const handleAuth = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        setMessage("✅ Logged in successfully!");
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage("✅ Account created!");
      }
      onLogin();
    } catch (err) {
      console.error("🔥 Firebase Auth Error:", err);
      setMessage("❌ " + err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full border">
        <h2 className="text-2xl font-bold text-center mb-6 text-blue-600">
          {isLogin ? "Welcome Back!" : "Create Your Account"}
        </h2>
        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 border rounded-lg"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 border rounded-lg"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
          >
            {isLogin ? "Login" : "Sign Up"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          {isLogin ? "New here?" : "Already have an account?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 hover:underline font-semibold"
          >
            {isLogin ? "Sign up" : "Login"}
          </button>
        </p>
        {message && <p className="mt-4 text-center text-gray-700">{message}</p>}
      </div>
    </div>
  );
};

// ===== AI Recommender =====
const AIRecommender = () => {
  const [ticker, setTicker] = useState("");
  const [prediction, setPrediction] = useState("");
  const [loading, setLoading] = useState(false);
  const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

  const getPrediction = async (e) => {
    e.preventDefault();
    if (!ticker) return;
    setLoading(true);
    setPrediction("");
    try {
      const res = await fetch(`${API_BASE}/api/stocks/analysis/${ticker}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPrediction(data.analysis);
    } catch {
      setPrediction("⚠️ Gemini AI failed to fetch recommendation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg border">
      <h3 className="text-xl font-bold text-blue-600 mb-4 flex items-center">
        <Cpu className="w-5 h-5 mr-2" /> AI Trend Recommender
      </h3>
      <form onSubmit={getPrediction} className="space-y-4">
        <input
          type="text"
          placeholder="Enter Stock Symbol (e.g. TSLA)"
          className="w-full p-3 border rounded-lg"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
        />
        <button
          disabled={loading}
          className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {loading ? "Analyzing..." : "Get AI Forecast"}
        </button>
      </form>
      {prediction && (
        <div className="mt-4 p-3 bg-blue-50 border rounded-lg text-sm text-gray-800 whitespace-pre-wrap">
          {prediction}
        </div>
      )}
    </div>
  );
};

// ===== Trade Form =====
const TradeForm = ({ onTradePlaced }) => {
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState("BUY");
  const [message, setMessage] = useState("");
  const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;

      console.log("📤 Sending token (addOrder):", token?.slice(0, 20) + "...");

      const res = await fetch(`${API_BASE}/api/addOrder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          symbol,
          quantity: Number(quantity),
          price: Number(price),
          type,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage("✅ Order placed successfully!");
        setSymbol("");
        setQuantity("");
        setPrice("");
        onTradePlaced();
      } else throw new Error(data.error);
    } catch (err) {
      setMessage("❌ " + err.message);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg border">
      <h3 className="text-xl font-bold text-blue-600 mb-4">Place a Trade</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="Stock Symbol"
          className="w-full p-3 border rounded-lg"
          required
        />
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Quantity"
          className="w-full p-3 border rounded-lg"
          required
        />
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price"
          className="w-full p-3 border rounded-lg"
          required
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full p-3 border rounded-lg"
        >
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>
        <button className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
          Submit
        </button>
      </form>
      {message && <p className="mt-3 text-center text-gray-700">{message}</p>}
    </div>
  );
};

// ===== Dashboard =====
const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        console.log("👤 Logged in as:", currentUser.uid);
        refreshData();
      }
    });
    return unsub;
  }, []);

  const fetchData = async (endpoint, setter) => {
    try {
      const token = await auth.currentUser.getIdToken();
      console.log("📡 Fetching", endpoint, "with token:", token.slice(0, 20) + "...");
      const res = await fetch(`${API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setter(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn(`⚠️ Fetch failed for ${endpoint}:`, err.message);
      setter([]);
    }
  };

  const refreshData = async () => {
    await Promise.all([
      fetchData("/api/holdings", setHoldings),
      fetchData("/api/positions", setPositions),
      fetchData("/api/orders", setOrders),
    ]);
  };

  if (!user) return <LoginSignup onLogin={() => setUser(auth.currentUser)} />;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mb-6 bg-blue-100 border border-blue-200 p-4 rounded-xl shadow-sm">
        <p className="text-lg font-semibold text-blue-800">
          👋 Welcome, <span className="font-bold">{user.email}</span>
        </p>
        <p className="text-sm text-blue-700">
          Track your portfolio and get AI insights.
        </p>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-md border">
          <h2 className="text-xl font-semibold mb-4">Monthly P&L Trend</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={historicalPnl}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v) => [`₹${v}`, "P&L"]} />
              <Bar dataKey="pnl" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md border">
          <h2 className="text-xl font-semibold mb-4">Portfolio Distribution</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={portfolioDistribution}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
              >
                {portfolioDistribution.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`₹${v}`, "Value"]} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Live Positions */}
        <div className="bg-white p-6 rounded-xl shadow-lg border">
          <h2 className="text-lg font-semibold mb-4 text-blue-600">Live Positions</h2>
          <table className="min-w-full border divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Symbol", "Qty", "Avg", "LTP", "P&L"].map((h) => (
                  <th key={h} className="px-4 py-2 text-xs text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.length > 0 ? (
                positions.map((p) => (
                  <tr key={p.symbol}>
                    <td className="px-4 py-2">{p.symbol}</td>
                    <td className="px-4 py-2">{p.quantity}</td>
                    <td className="px-4 py-2">₹{p.avgPrice}</td>
                    <td className="px-4 py-2">₹{p.livePrice}</td>
                    <td className={p.pnl >= 0 ? "text-green-600" : "text-red-600"}>
                      ₹{p.pnl}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center text-gray-500 py-4">
                    No positions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Recent Orders */}
        <div className="bg-white p-6 rounded-xl shadow-lg border">
          <h2 className="text-lg font-semibold mb-4 text-blue-600">Recent Orders</h2>
          <table className="min-w-full border divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Symbol", "Type", "Qty", "Price", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2 text-xs text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.length > 0 ? (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2">{o.symbol}</td>
                    <td
                      className={`px-4 py-2 ${
                        o.type === "BUY" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {o.type}
                    </td>
                    <td className="px-4 py-2">{o.quantity}</td>
                    <td className="px-4 py-2">₹{o.price}</td>
                    <td className="px-4 py-2">{o.status}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="text-center text-gray-500 py-4">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Holdings */}
      <div className="bg-white rounded-xl shadow-lg border mb-8 p-6">
        <h2 className="text-lg font-semibold mb-4 text-blue-600">Holdings Overview</h2>
        <table className="min-w-full border divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Symbol", "Qty", "Avg", "LTP", "MTM"].map((h) => (
                <th key={h} className="px-4 py-2 text-xs text-gray-500 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holdings.length > 0 ? (
              holdings.map((h) => {
                const mtm = ((h.ltp || h.avgPrice) - h.avgPrice) * h.quantity;
                return (
                  <tr key={h.symbol}>
                    <td className="px-4 py-2">{h.symbol}</td>
                    <td className="px-4 py-2">{h.quantity}</td>
                    <td className="px-4 py-2">₹{h.avgPrice}</td>
                    <td className="px-4 py-2">₹{h.ltp}</td>
                    <td className={mtm >= 0 ? "text-green-600" : "text-red-600"}>
                      ₹{mtm.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="5" className="text-center text-gray-500 py-4">
                  No holdings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* AI + Trade Section */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <AIRecommender />
        <TradeForm onTradePlaced={refreshData} />
      </div>
    </div>
  );
};

export default Dashboard;
