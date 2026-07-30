/**
 * Wandering Casks — sitemap.xml
 * ------------------------------------------------------------------
 * Visitors and Google reach this at:  https://wanderingcasks.com/sitemap.xml
 * (vercel.json quietly points that address at this file.)
 *
 * It builds the list of pages fresh every time: the bottles and cocktails
 * built into the website, PLUS anything you have added through the admin
 * that lives only in Supabase. Add a bottle in the admin and it turns up
 * here automatically — there is nothing for you to edit.
 *
 * THINGS TO EDIT:
 *   1. SITE -> your live site address (no trailing slash)
 * ------------------------------------------------------------------
 */

// EDIT THIS if the domain ever changes (https, no trailing slash)
const SITE = "https://wanderingcasks.com";

// Same public Supabase values already visible in your website code
const SUPABASE_URL = "https://pqbpmcshkwdngesnlzgi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxYnBtY3Noa3dkbmdlc25semdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MDE1MTQsImV4cCI6MjA5OTI3NzUxNH0.xlJpUcADnfpMsKqiNtfP84Fp2xm9YvyB4Lo9J_V3j7I";

/* ---- the catalog built into index.html (the safety net if Supabase is slow) ---- */
const BUILT_IN_BOTTLES = ["buffalo-trace","makers-mark","wild-turkey-101","four-roses-small-batch","elijah-craig-small-batch","woodford-reserve","bulleit-bourbon","knob-creek-9yr","weller-special-reserve","blantons-original","rittenhouse-rye","sazerac-rye","whistlepig-piggyback-6yr","whistlepig-10yr","eh-taylor-straight-rye","whistlepig-12yr-double-malt","jameson","bushmills-original","tullamore-dew","proper-no-twelve","teeling-small-batch","powers-gold-label","green-spot","redbreast-12yr","glenfiddich-12yr","glenlivet-12yr","highland-park-12yr","ardbeg-10yr","talisker-10yr","balvenie-doublewood-12yr","macallan-12yr-double-cask","dalmore-12yr","lagavulin-16yr","johnnie-walker-black","dewars-white-label","monkey-shoulder","famous-grouse","chivas-regal-12yr","johnnie-walker-green-label-15yr","johnnie-walker-blue","suntory-toki","mars-iwai-tradition","nikka-from-the-barrel","suntory-hibiki-harmony","nikka-coffey-grain","suntory-yamazaki-12yr"];

const BUILT_IN_COCKTAILS = ["old-fashioned","whiskey-sour","kentucky-mule","manhattan","sazerac","irish-whiskey-highball","whiskey-ginger","rob-roy","penicillin","blood-and-sand","rusty-nail","highball"];

/* Discover / Cocktails category filters — these are real, indexable pages */
const BOTTLE_CATS   = ["bourbon", "rye", "scotch-single", "scotch-blend", "irish", "japanese"];
const COCKTAIL_CATS = ["flexible", "bourbon", "rye", "irish", "scotch-single", "scotch-blend", "japanese"];

/* Same slug rule the website uses */
function slugify(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function xmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

async function sbFetch(path) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY },
  });
  if (!res.ok) throw new Error("supabase " + res.status);
  return res.json();
}

function url(loc, changefreq, priority, lastmod) {
  return (
    "  <url>\n" +
    "    <loc>" + xmlEscape(SITE + loc) + "</loc>\n" +
    (lastmod ? "    <lastmod>" + xmlEscape(lastmod) + "</lastmod>\n" : "") +
    "    <changefreq>" + changefreq + "</changefreq>\n" +
    "    <priority>" + priority + "</priority>\n" +
    "  </url>\n"
  );
}

export default async function handler(req, res) {
  const today = new Date().toISOString().slice(0, 10);

  // Start with everything built into the site so the sitemap is never empty
  const bottles = new Set(BUILT_IN_BOTTLES);
  const cocktails = new Set(BUILT_IN_COCKTAILS);

  // Then top up with anything added through the admin (published rows only)
  try {
    const [bRows, cRows] = await Promise.all([
      sbFetch("bottles?select=name,wc_slug,published").catch(() => []),
      sbFetch("cocktails?select=name,slug,published").catch(() => []),
    ]);
    (Array.isArray(bRows) ? bRows : []).forEach((r) => {
      if (!r || !r.name) return;
      if (r.published === false) return;
      const s = r.wc_slug || slugify(r.name);
      if (s) bottles.add(s);
    });
    (Array.isArray(cRows) ? cRows : []).forEach((r) => {
      if (!r || !r.name) return;
      if (r.published === false) return;
      const s = r.slug || slugify(r.name);
      if (s) cocktails.add(s);
    });
  } catch (_) {
    /* Supabase unreachable — the built-in catalog above still produces a valid sitemap */
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Main pages
  xml += url("/", "weekly", "1.0", today);
  xml += url("/discover", "weekly", "0.9", today);
  xml += url("/cocktails", "weekly", "0.9", today);
  xml += url("/guide", "monthly", "0.8", today);
  xml += url("/regions", "monthly", "0.7", today);
  xml += url("/gift", "monthly", "0.8", today);
  xml += url("/add-ons", "monthly", "0.6", today);
  xml += url("/stores", "monthly", "0.5", today);

  // Category filters
  BOTTLE_CATS.forEach((c) => { xml += url("/discover/" + c, "weekly", "0.7", today); });
  COCKTAIL_CATS.forEach((c) => { xml += url("/cocktails/" + c, "weekly", "0.6", today); });

  // Every bottle and every cocktail — the reason this whole phase exists
  Array.from(bottles).sort().forEach((s) => { xml += url("/bottle/" + s, "weekly", "0.8", today); });
  Array.from(cocktails).sort().forEach((s) => { xml += url("/cocktail/" + s, "monthly", "0.7", today); });

  xml += "</urlset>\n";

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(xml);
}
