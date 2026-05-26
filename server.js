const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname))); // Serve static files like index.html

const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

function parseCount(raw) {
  let s = String(raw).trim().replace(/,/g, "");
  let mult = 1;
  if (s.endsWith("K")) { mult = 1e3; s = s.slice(0, -1); }
  else if (s.endsWith("M")) { mult = 1e6; s = s.slice(0, -1); }
  else if (s.endsWith("B")) { mult = 1e9; s = s.slice(0, -1); }
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * mult) : null;
}

async function fetchFollowers(handle) {
  const url = `https://www.instagram.com/${encodeURIComponent(handle)}/`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-GB,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`Instagram returned HTTP ${res.status}`);
  const html = await res.text();

  let m = html.match(/"edge_followed_by":\s*\{\s*"count":\s*(\d+)\s*\}/);
  if (m) return parseInt(m[1], 10);

  m = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/);
  if (m) {
    const m2 = m[1].match(/([\d,.]+[KMB]?)\s+Followers/i);
    if (m2) {
      const n = parseCount(m2[1]);
      if (n !== null) return n;
    }
  }

  m = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/);
  if (m) {
    const m2 = m[1].match(/([\d,.]+[KMB]?)\s+Followers/i);
    if (m2) {
      const n = parseCount(m2[1]);
      if (n !== null) return n;
    }
  }

  throw new Error("Could not find follower count in page");
}

app.get('/api/followers', async (req, res) => {
  const handle = (req.query.handle || process.env.IG_HANDLE || "").trim();
  if (!handle) {
    return res.status(400).json({ error: "Provide ?handle=yourshop or set IG_HANDLE env var" });
  }

  try {
    const count = await fetchFollowers(handle);
    return res.status(200).json({
      count,
      handle,
      fetched_at: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(503).json({
      error: e.message,
      handle,
      count: 0,
    });
  }
});

// Default fallback to index.html for other routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  const networkInterfaces = require('os').networkInterfaces();
  const ips = [];
  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  
  console.log(`\n======================================================`);
  console.log(`✅ LOCAL SHOP SERVER RUNNING`);
  console.log(`======================================================`);
  console.log(`Open this address on your iPad's Safari Browser:`);
  if (ips.length > 0) {
    ips.forEach(ip => {
      console.log(`👉 http://${ip}:${PORT}`);
    });
  } else {
    console.log(`👉 http://localhost:${PORT}`);
  }
  console.log(`======================================================\n`);
  console.log(`To stop the server, press CTRL+C`);
});
