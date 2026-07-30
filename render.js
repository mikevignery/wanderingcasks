/* ============================================================================
   api/render.js  —  Crawler prerender for Wandering Casks
   ----------------------------------------------------------------------------
   Only bot / crawler traffic is routed here (see vercel.json). Real visitors
   are served the static index.html untouched, so this function can never slow
   down or break the site for humans.

   For each requested path it:
     1. Loads the static index.html shell.
     2. Works out which page it is (home, discover, bottle, cocktail, region…).
     3. For a bottle it pulls the real record from Supabase so the title,
        description, share image and on-page text are accurate.
     4. Rewrites the <head> tags (title, description, canonical, robots,
        Open Graph, Twitter, JSON-LD) and injects readable content into <main>.
     5. Returns the finished HTML — or, if anything goes wrong, the plain shell.

   Nothing here is secret: the Supabase anon key is already public in the
   client HTML. You can move the two SUPABASE_* values to Environment
   Variables in Vercel if you prefer; the fallbacks below keep it working
   either way.
   ========================================================================== */

const SITE = "Wandering Casks";
const WC_SITE = "https://wanderingcasks.com";
// Optional default share image used when a page has no image of its own.
// Paste a full https URL to a 1200x630 image here to get nicer link previews
// on the home page and category pages.
const WC_OG_IMAGE = "";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://pqbpmcshkwdngesnlzgi.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxYnBtY3Noa3dkbmdlc25semdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MDE1MTQsImV4cCI6MjA5OTI3NzUxNH0.xlJpUcADnfpMsKqiNtfP84Fp2xm9YvyB4Lo9J_V3j7I";

const CAT_LABEL = {
  bourbon: "Bourbon",
  rye: "Rye",
  "scotch-single": "Scotch (Single Malt)",
  "scotch-blend": "Scotch (Blended)",
  irish: "Irish Whiskey",
  japanese: "Japanese Whisky"
};

/* ---------- small helpers ---------- */
const slugify = s =>
  String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function escHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escAttr(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function clamp(t, n) {
  t = String(t || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).replace(/[\s,;:.\-]+$/, "") + "\u2026" : t;
}
function firstSentence(s) {
  const m = String(s || "").match(/[^.!?]+[.!?]?/);
  return m ? m[0].trim() : "";
}
function pick() {
  for (let i = 0; i < arguments.length; i++) {
    const v = arguments[i];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

/* Canonical whiskey type -> site category id. MUST match TYPE_TO_CATEGORY in
   index.html; if the two drift, a crawler or link preview will file a bottle
   under a different category than the live page does. */
const TYPE_TO_CATEGORY = {
  bourbon: "bourbon",
  tennessee: "bourbon", "tennessee whiskey": "bourbon", "tennessee whisky": "bourbon",
  rye: "rye", "rye whiskey": "rye", "rye whisky": "rye",
  irish: "irish", "irish whiskey": "irish", "irish whisky": "irish",
  japanese: "japanese", "japanese whisky": "japanese", "japanese whiskey": "japanese",
  "scotch (single malt)": "scotch-single", "scotch single malt": "scotch-single",
  "single malt": "scotch-single", "single malt scotch": "scotch-single",
  "scotch (blended)": "scotch-blend", "scotch blended": "scotch-blend",
  "blended scotch": "scotch-blend", blended: "scotch-blend", scotch: "scotch-blend"
};

/* ---------- map a Supabase bottles row to the fields we render ---------- */
function bottleTypeToCategory(row) {
  const wc = String(row.wc_category || "").toLowerCase().trim();
  if (CAT_LABEL[wc]) return wc;
  const t = String(row.type || "").toLowerCase().trim();
  return TYPE_TO_CATEGORY[t] || "bourbon";
}
function mapBottle(r) {
  return {
    slug: pick(r.wc_slug, slugify(r.name)),
    name: r.name,
    category: (r.wc_category || r.type) ? bottleTypeToCategory(r) : "bourbon",
    short: pick(r.wc_short, firstSentence(r.description), firstSentence(r.tasting_notes), "A bottle worth finding."),
    note: pick(r.wc_note, r.description, r.tasting_notes),
    distillery: pick(r.wc_distillery, r.company),
    region: pick(r.wc_region),
    abv: pick(r.abv_proof, r.proof ? r.proof + " proof" : ""),
    age: pick(r.age_statement),
    price: pick(r.price_range, r.price ? "$" + r.price : ""),
    nose: pick(r.wc_nose),
    palate: pick(r.wc_palate, r.tasting_notes),
    finish: pick(r.wc_finish),
    bestFor: pick(r.wc_best_for),
    image: pick(r.image_url)
  };
}

/* ---------- Supabase REST ---------- */
async function sbFetch(query) {
  const url = `${SUPABASE_URL}/rest/v1/${query}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
// Look up a bottle by its URL slug. Tries the stored wc_slug first, then falls
// back to matching a slugified name (covers classics that predate wc_slug).
async function findBottle(slug) {
  try {
    let rows = await sbFetch(`bottles?select=*&wc_slug=eq.${encodeURIComponent(slug)}&limit=1`);
    if (rows.length) return mapBottle(rows[0]);
    rows = await sbFetch(`bottles?select=*`);
    const hit = rows.find(r => r && r.name && slugify(r.name) === slug && r.published !== false);
    return hit ? mapBottle(hit) : null;
  } catch (_) { return null; }
}

/* ---------- route parsing (mirrors the client's parseRoute) ---------- */
function parsePath(path) {
  const clean = String(path || "/").split("?")[0].split("#")[0].replace(/^\/+/, "").replace(/\/+$/, "");
  if (clean === "") return { name: "home", arg: null };
  const seg = clean.split("/");
  const first = seg[0].toLowerCase();
  const arg = seg.slice(1).join("/") || null;
  const known = {
    discover: "discover", bottle: "bottle", cocktails: "cocktails", cocktail: "cocktail",
    guide: "guide", regions: "regions", stores: "stores", store: "store", mybar: "mybar",
    mybar2: "mybar2",
    account: "account", member: "member", login: "login", signup: "signup", reset: "reset",
    legal: "legal", "add-ons": "add-ons", gift: "gift", feedback: "feedback"
  };
  return { name: known[first] || "home", arg: arg };
}

/* ---------- build the meta + on-page content for a route ---------- */
const DEFAULT_META = {
  title: SITE + " \u2014 One drop. Endless discovery.",
  desc: "A whiskey discovery experience for curious beginners and seasoned enthusiasts. Every bottle tagged by how easy it is to find and how far it pushes past the familiar.",
  image: WC_OG_IMAGE, type: "website", index: true, ld: null, status: 200, content: ""
};

function titleCaseSlug(s) {
  return String(s || "").split("-").filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

async function metaFor(r) {
  const D = DEFAULT_META;

  if (r.name === "home") {
    return { ...D, content: `<h1>${escHtml(SITE)}</h1><p>${escHtml(D.desc)}</p>` };
  }

  if (r.name === "discover") {
    const lab = r.arg && r.arg !== "all" ? CAT_LABEL[r.arg] : null;
    const title = (lab ? lab + " \u2014 Bottles Worth Finding" : "Discover Whiskey \u2014 Bottles Worth Finding") + " | " + SITE;
    const desc = lab
      ? "Browse our " + lab + " shelf. Every bottle tagged by how easy it is to find and how far it pushes past the familiar, with tasting notes, price range and what it is best for."
      : "Browse whiskey by style \u2014 bourbon, rye, Scotch, Irish and Japanese. Every bottle tagged by how easy it is to find and how far it pushes past the familiar.";
    return { ...D, title, desc, content: `<h1>${escHtml(lab ? lab : "Discover")}</h1><p>${escHtml(desc)}</p>` };
  }

  if (r.name === "bottle") {
    const b = await findBottle(r.arg);
    if (!b) {
      const guess = titleCaseSlug(r.arg);
      // Unknown slug: return a soft-404 so search engines don't index a blank page.
      return { ...D, title: (guess ? guess + " | " : "Bottle not found | ") + SITE,
        index: false, status: 404, content: `<h1>${escHtml(guess || "Bottle not found")}</h1>` };
    }
    const catLabel = CAT_LABEL[b.category] || "Whiskey";
    const bits = [b.distillery, b.abv, b.price].filter(Boolean).join(" \u00b7 ");
    const desc = clamp((b.short || b.note || "") + (bits ? " " + bits + "." : ""), 300);
    const ld = {
      "@context": "https://schema.org", "@type": "Product",
      name: b.name, url: WC_SITE + "/bottle/" + b.slug,
      description: clamp(b.note || b.short, 300),
      category: catLabel
    };
    if (b.distillery) ld.brand = { "@type": "Brand", name: b.distillery };
    if (b.image) ld.image = b.image;

    const facts = [
      ["Category", catLabel], ["Distillery", b.distillery], ["Region", b.region],
      ["ABV / Proof", b.abv], ["Age", b.age], ["Typical price", b.price]
    ].filter(x => x[1]);
    const notes = [
      ["Nose", b.nose], ["Palate", b.palate], ["Finish", b.finish], ["Best for", b.bestFor]
    ].filter(x => x[1]);
    const content =
      `<article>` +
      `<p>${escHtml(catLabel)}</p>` +
      `<h1>${escHtml(b.name)}</h1>` +
      (b.distillery ? `<p>${escHtml(b.distillery)}${b.region ? " \u00b7 " + escHtml(b.region) : ""}</p>` : "") +
      (b.note ? `<p>${escHtml(b.note)}</p>` : (b.short ? `<p>${escHtml(b.short)}</p>` : "")) +
      (facts.length ? `<h2>Key facts</h2><ul>${facts.map(x => `<li>${escHtml(x[0])}: ${escHtml(x[1])}</li>`).join("")}</ul>` : "") +
      (notes.length ? `<h2>Tasting profile</h2><ul>${notes.map(x => `<li>${escHtml(x[0])}: ${escHtml(x[1])}</li>`).join("")}</ul>` : "") +
      `</article>`;

    return {
      title: b.name + " \u2014 Tasting Notes, Price & Where to Find It | " + SITE,
      desc, image: b.image || WC_OG_IMAGE, type: "product", index: true, ld, status: 200, content
    };
  }

  if (r.name === "cocktails") {
    const title = "Whiskey Cocktails \u2014 Classics Worth Making | " + SITE;
    const desc = "Classic whiskey cocktails with clear ingredients, step-by-step method and bottle pairings \u2014 from the Old Fashioned to the Penicillin.";
    return { ...D, title, desc, content: `<h1>Whiskey Cocktails</h1><p>${escHtml(desc)}</p>` };
  }

  if (r.name === "cocktail") {
    // Cocktail records live in the client bundle; try Supabase for a name/desc,
    // otherwise derive a readable title from the slug.
    let name = titleCaseSlug(r.arg), desc = "", img = "";
    try {
      const rows = await sbFetch(`cocktails?select=*&slug=eq.${encodeURIComponent(r.arg)}&limit=1`);
      if (rows.length) { name = rows[0].name || name; desc = rows[0].tagline || rows[0].description || ""; img = rows[0].image_url || ""; }
    } catch (_) {}
    const title = "How to Make a " + name + " \u2014 Recipe & Best Bottles | " + SITE;
    desc = clamp(desc || ("How to make a " + name + " \u2014 ingredients, method and the whiskey bottles that work best in it."), 300);
    return { ...D, title, desc, type: "article", image: img || WC_OG_IMAGE,
      content: `<h1>${escHtml(name)}</h1><p>${escHtml(desc)}</p>` };
  }

  if (r.name === "guide") {
    const title = "The Whiskey Guide \u2014 Start Here If You're New | " + SITE;
    const desc = "Plain-English whiskey basics: bourbon vs rye vs Scotch, what proof and age really mean, how to taste, and how to pick a first bottle you'll actually enjoy.";
    return { ...D, title, desc, content: `<h1>The Whiskey Guide</h1><p>${escHtml(desc)}</p>` };
  }

  if (r.name === "regions") {
    const title = "Whiskey Regions of the World | " + SITE;
    const desc = "Kentucky, Speyside, Islay, Ireland, Japan and beyond \u2014 how place shapes the whiskey in the glass, and which bottles show it best.";
    return { ...D, title, desc, content: `<h1>Whiskey Regions of the World</h1><p>${escHtml(desc)}</p>` };
  }

  if (r.name === "gift") {
    return { ...D, title: "Whiskey Gift Finder \u2014 Three Questions, Real Suggestions | " + SITE,
      desc: "Not sure what whiskey to buy as a gift? Answer three quick questions \u2014 occasion, budget, taste \u2014 and get bottle suggestions with tasting notes. No account needed." };
  }
  if (r.name === "add-ons") {
    return { ...D, title: "Whiskey Glasses, Decanters & Gear | " + SITE,
      desc: "Hand-picked whiskey glassware, decanters, ice tools and gift-worthy extras to go alongside the bottle." };
  }
  if (r.name === "stores") {
    return { ...D, title: "Find Whiskey Near You | " + SITE,
      desc: "Find liquor stores and grocers near you that are likely to stock the bottle you're after." };
  }

  // Private / account pages — kept out of Google.
  const priv = {
    mybar: "My Bar", mybar2: "My Bar 2", account: "My Account", member: "Member Profile", login: "Log In",
    signup: "Sign Up", reset: "Reset Password", store: "Store Details",
    feedback: "Beta Feedback", legal: "Legal Stuff"
  };
  if (priv[r.name]) return { ...D, title: priv[r.name] + " | " + SITE, index: false };

  return D;
}

/* ---------- inject meta + content into the shell ---------- */
function replaceContentAttr(html, id, value) {
  const re = new RegExp('(id="' + id + '"[^>]*?content=")[^"]*(")');
  return html.replace(re, (m, a, b) => a + escAttr(value) + b);
}
function applyMeta(html, m, url) {
  const robots = m.index ? "index,follow,max-image-preview:large" : "noindex,nofollow";

  html = html.replace(/<title>[\s\S]*?<\/title>/, "<title>" + escHtml(m.title) + "</title>");
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, (x, a, b) => a + escAttr(m.desc) + b);
  html = html.replace(/(<link[^>]*id="wc-canonical"[^>]*href=")[^"]*(")/, (x, a, b) => a + escAttr(url) + b);

  html = replaceContentAttr(html, "wc-robots", robots);
  html = replaceContentAttr(html, "wc-og-type", m.type || "website");
  html = replaceContentAttr(html, "wc-og-url", url);
  html = replaceContentAttr(html, "wc-og-title", m.title);
  html = replaceContentAttr(html, "wc-og-desc", m.desc);
  html = replaceContentAttr(html, "wc-og-image", m.image || "");
  html = replaceContentAttr(html, "wc-tw-title", m.title);
  html = replaceContentAttr(html, "wc-tw-desc", m.desc);
  html = replaceContentAttr(html, "wc-tw-image", m.image || "");

  if (m.ld) {
    const json = JSON.stringify(m.ld).replace(/</g, "\\u003c");
    html = html.replace(
      /(<script[^>]*id="wc-ld-page"[^>]*>)[\s\S]*?(<\/script>)/,
      (x, a, b) => a + json + b
    );
  }
  if (m.content) {
    html = html.replace('<main id="page"></main>', '<main id="page">' + m.content + "</main>");
  }
  return html;
}

/* ---------- the handler ---------- */
module.exports = async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "wanderingcasks.com";
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];

  // Original path, forwarded by vercel.json as ?path=...
  let path = "/";
  try {
    const q = req.query && req.query.path;
    path = "/" + String(Array.isArray(q) ? q[0] : (q || "")).replace(/^\/+/, "");
  } catch (_) { path = "/"; }

  const canonicalPath = path === "/" ? "/" : path.replace(/\/+$/, "");
  const url = WC_SITE + canonicalPath;

  // 1) Load the static shell (non-bot UA so it is served as a plain file).
  let shell = "";
  try {
    const r = await fetch(proto + "://" + host + "/index.html", {
      headers: { "user-agent": "wc-prerender" }
    });
    if (r.ok) shell = await r.text();
  } catch (_) {}

  // 2) Work out the meta for this route.
  let m = DEFAULT_META;
  try { m = await metaFor(parsePath(path)); } catch (_) {}

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("X-WC-Prerender", "1");

  // 3) If we could not load the shell, still return valid HTML with good meta.
  if (!shell) {
    res.status(m.status || 200).send(
      `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<title>${escHtml(m.title)}</title>` +
      `<meta name="description" content="${escAttr(m.desc)}">` +
      `<link rel="canonical" href="${escAttr(url)}">` +
      `<meta name="robots" content="${m.index ? "index,follow" : "noindex,nofollow"}">` +
      `<meta property="og:title" content="${escAttr(m.title)}">` +
      `<meta property="og:description" content="${escAttr(m.desc)}">` +
      `<meta property="og:url" content="${escAttr(url)}">` +
      (m.image ? `<meta property="og:image" content="${escAttr(m.image)}">` : "") +
      `</head><body>${m.content || ""}<p><a href="${escAttr(url)}">Continue to ${escHtml(SITE)}</a></p></body></html>`
    );
    return;
  }

  // 4) Inject and return.
  let out = shell;
  try { out = applyMeta(shell, m, url); } catch (_) { out = shell; }
  res.status(m.status || 200).send(out);
};
