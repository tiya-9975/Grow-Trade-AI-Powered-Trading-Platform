// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Allow Authorization header and preflight
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ========== FIREBASE ADMIN INITIALIZATION ==========
let db = null;
try {
  const serviceAccountPath = path.resolve(__dirname, "serviceAccountKey.json");
  console.log("🔍 Using serviceAccountPath:", serviceAccountPath);

  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = getFirestore();
  console.log("✅ Firebase Admin initialized successfully (Firestore ready)");
} catch (error) {
  console.error("❌ Failed to initialize Firebase Admin:", error.message);
}

// ========== VERIFY TOKEN MIDDLEWARE ==========
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ Invalid token:", err && err.message ? err.message : err);
    res.status(403).json({ error: "Forbidden: Invalid token" });
  }
};

// ========== ALPHAVANTAGE LIVE PRICE CACHE ==========
const priceCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchLivePrice(symbol) {
  const now = Date.now();
  const cached = priceCache.get(symbol);
  if (cached && now - cached.timestamp < CACHE_TTL) return cached.price;

  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) {
    // no key — bail out
    return null;
  }
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${key}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.Note) {
      console.warn("⚠️ AlphaVantage rate limit hit or Note returned:", data.Note);
      return cached ? cached.price : null;
    }

    const price = parseFloat(data?.["Global Quote"]?.["05. price"] || "0");
    if (price > 0) {
      priceCache.set(symbol, { price, timestamp: now });
      return price;
    }
  } catch (err) {
    console.warn(`⚠️ Error fetching price for ${symbol}:`, err.message || err);
  }
  return null;
}

// ========== GET HOLDINGS ==========
app.get("/api/holdings", verifyToken, async (req, res) => {
  try {
    const snap = await db
      .collection("holdings")
      .where("userId", "==", req.user.uid)
      .get();

    const INR = 83.1;
    const holdings = [];

    for (const doc of snap.docs) {
      const h = doc.data();
      let ltp = (await fetchLivePrice(h.symbol)) || h.avgPrice;
      if (["TSLA", "AAPL", "GOOGL", "MSFT"].includes(h.symbol)) ltp *= INR;
      const mtm = (ltp - h.avgPrice) * h.quantity;

      holdings.push({
        id: doc.id,
        ...h,
        ltp: Number((ltp || 0).toFixed(2)),
        mtm: Number((mtm || 0).toFixed(2)),
      });
    }

    res.json(holdings);
  } catch (err) {
    console.error("❌ Holdings error:", err.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ========== GET ORDERS ==========
app.get("/api/orders", verifyToken, async (req, res) => {
  try {
    console.log("📥 Fetching orders for UID:", req.user.uid);

    const snap = await db
      .collection("orders")
      .where("userId", "==", req.user.uid)
      .orderBy("createdAt", "desc")
      .get();

    const orders = snap.docs.map((doc) => {
      const data = doc.data();

      // robust createdAt parsing
      let createdAt = "N/A";
      if (data.createdAt && typeof data.createdAt.toDate === "function") {
        createdAt = data.createdAt.toDate().toLocaleString();
      } else if (data.createdAt && data.createdAt._seconds) {
        createdAt = new Date(data.createdAt._seconds * 1000).toLocaleString();
      }

      return { id: doc.id, ...data, createdAt };
    });

    console.log(`🧾 Orders returned: ${orders.length}`);
    res.json(orders);
  } catch (err) {
    console.error("❌ Error fetching orders:", err.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ========== ADD ORDER ==========
app.post("/api/addOrder", verifyToken, async (req, res) => {
  try {
    const { symbol, quantity, price, type } = req.body;
    if (!symbol || !quantity || !price || !type) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalized = symbol.trim().toUpperCase();
    const userId = req.user.uid;

    // 1) Save order
    const orderRef = await db.collection("orders").add({
      userId,
      symbol: normalized,
      quantity,
      price,
      type,
      status: "Completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ Order saved:", orderRef.id, normalized, "user:", userId);

    // 2) Update positions collection
    const posSnap = await db
      .collection("positions")
      .where("userId", "==", userId)
      .where("symbol", "==", normalized)
      .get();

    let newQty = quantity;
    let newAvg = price;

    if (!posSnap.empty) {
      const doc = posSnap.docs[0];
      const cur = doc.data();

      if (type === "BUY") {
        newQty = cur.quantity + quantity;
        newAvg = (cur.avgPrice * cur.quantity + price * quantity) / newQty;
      } else if (type === "SELL") {
        newQty = Math.max(0, cur.quantity - quantity);
      }

      if (newQty === 0) {
        await db.collection("positions").doc(doc.id).delete();
      } else {
        await db.collection("positions").doc(doc.id).update({
          quantity: newQty,
          avgPrice: newAvg,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } else {
      await db.collection("positions").add({
        userId,
        symbol: normalized,
        quantity,
        avgPrice: price,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // 3) Update holdings
    const holdSnap = await db
      .collection("holdings")
      .where("userId", "==", userId)
      .where("symbol", "==", normalized)
      .get();

    if (!holdSnap.empty) {
      const doc = holdSnap.docs[0];
      const cur = doc.data();
      const totalQty =
        type === "BUY" ? cur.quantity + quantity : Math.max(0, cur.quantity - quantity);
      const newAvg =
        type === "BUY"
          ? (cur.avgPrice * cur.quantity + price * quantity) / totalQty
          : cur.avgPrice;

      if (totalQty === 0) {
        await db.collection("holdings").doc(doc.id).delete();
      } else {
        await db.collection("holdings").doc(doc.id).update({
          quantity: totalQty,
          avgPrice: newAvg,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } else if (type === "BUY") {
      await db.collection("holdings").add({
        userId,
        symbol: normalized,
        quantity,
        avgPrice: price,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.json({ success: true, message: "✅ Order placed successfully!", orderId: orderRef.id });
  } catch (err) {
    console.error("❌ Order add error:", err.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ========== GET POSITIONS ==========
app.get("/api/positions", verifyToken, async (req, res) => {
  try {
    const INR = 83.1;
    const snap = await db
      .collection("positions")
      .where("userId", "==", req.user.uid)
      .get();

    const positions = [];
    for (const doc of snap.docs) {
      const p = doc.data();
      let ltp = (await fetchLivePrice(p.symbol)) || p.avgPrice;
      if (["TSLA", "AAPL", "GOOGL", "MSFT"].includes(p.symbol)) ltp *= INR;
      const pnl = (ltp - p.avgPrice) * p.quantity;

      positions.push({
        id: doc.id,
        ...p,
        livePrice: Number((ltp || 0).toFixed(2)),
        pnl: Number((pnl || 0).toFixed(2)),
      });
    }

    res.json(positions);
  } catch (err) {
    console.error("❌ Positions error:", err.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ========== AI RECOMMENDER (Gemini) ==========
app.get("/api/stocks/analysis/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const ALPHA_KEY = process.env.ALPHA_VANTAGE_API_KEY;

  try {
    let price = 0;
    if (ALPHA_KEY) {
      const priceRes = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_KEY}`
      );
      const priceJson = await priceRes.json();
      price = parseFloat(priceJson?.["Global Quote"]?.["05. price"] || "0");
    }

    const payload = {
      contents: [{ parts: [{ text: `Analyze stock ${symbol}. Predict short-term trend and explain briefly.` }] }],
    };

    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const aiJson = await aiRes.json();
    const analysis = aiJson?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini AI.";

    res.json({ symbol, price, analysis });
  } catch (err) {
    console.error("❌ Gemini error:", err.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ========== DEBUG - check current token UID and order UIDs ==========
app.get("/api/debug/uid", verifyToken, async (req, res) => {
  try {
    const userUid = req.user.uid;
    const snap = await db.collection("orders").get();
    const firestoreUserIds = snap.docs.map((d) => d.data().userId);
    console.log("🔎 Debug UID:", { userUid, firestoreUserIds });
    res.json({ currentUserUid: userUid, firestoreUserIds });
  } catch (err) {
    console.error("❌ Debug error:", err.message || err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
