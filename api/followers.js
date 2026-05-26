// api/followers.js
//
// Vercel serverless function — Instagram follower counter
// --------------------------------------------------------
// Scrapes a public IG profile, returns { count, handle, fetched_at }.
// Edge-cached for 60s so Instagram is hit at most once per minute regardless
// of how often the iPad polls.
//
// Usage from the shop display:
//   https://YOUR-PROJECT.vercel.app/api/followers?handle=yourshop
//
// Or set IG_HANDLE env var in the Vercel project and just call:
//   https://YOUR-PROJECT.vercel.app/api/followers

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

  // 1. Embedded JSON: "edge_followed_by":{"count":12345}
  let m = html.match(/"edge_followed_by":\s*\{\s*"count":\s*(\d+)\s*\}/);
  if (m) return parseInt(m[1], 10);

  // 2. og:description meta — "1,234 Followers, 567 Following..."
  m = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/);
  if (m) {
    const m2 = m[1].match(/([\d,.]+[KMB]?)\s+Followers/);
    if (m2) {
      const n = parseCount(m2[1]);
      if (n !== null) return n;
    }
  }

  // 3. name="description" fallback
  m = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/);
  if (m) {
    const m2 = m[1].match(/([\d,.]+[KMB]?)\s+Followers/);
    if (m2) {
      const n = parseCount(m2[1]);
      if (n !== null) return n;
    }
  }

  throw new Error("Could not find follower count in page");
}

export default async function handler(req, res) {
  // CORS — let the iPad display fetch this from any domain
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  // Edge-cache: Vercel caches this response for 60s and serves stale up to 5min while refreshing
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=300"
  );

  const handle = (req.query?.handle || process.env.IG_HANDLE || "").trim();
  if (!handle) {
    return res
      .status(400)
      .json({ error: "Provide ?handle=yourshop or set IG_HANDLE env var" });
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
}
