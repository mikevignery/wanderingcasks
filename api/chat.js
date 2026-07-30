/**
 * ASK AIDAN - Wandering Casks chatbot engine (Vercel Serverless Function)
 * ----------------------------------------------------------------------
 * This file must live at:  api/chat.js  in your website repository.
 *
 * NEW IN THIS VERSION: Aidan reads the LIVE bottle and cocktail catalog
 * from your Supabase database (the same one the site uses) on every
 * conversation, refreshed every 10 minutes. Add or edit a bottle in
 * Supabase and Aidan knows it automatically - no code changes needed.
 * If the database is ever unreachable, he falls back to the built-in
 * snapshot below so the chat never breaks.
 *
 * THINGS TO EDIT:
 *   1. ALLOWED_ORIGINS -> every address the site runs on
 *   2. The contact email in the RULES section (currently
 *      hello@wanderingcasks.com) -> change it if you use another address
 */

// EDIT THIS: every address the site is allowed to be visited from
// (https, no trailing slash). The old vercel.app address is kept on the
// list on purpose, so testers holding the old link don't lose Aidan
// during the changeover. You can delete that line once everyone has moved.
const ALLOWED_ORIGINS = [
  "https://wanderingcasks.com",
  "https://www.wanderingcasks.com",
  "https://brian-three.vercel.app"
];
const ALLOWED_ORIGIN = ALLOWED_ORIGINS[0];   // the fallback answer

// Your site's Supabase project (these are the same PUBLIC values already
// visible in your website code - safe here, they only allow reading)
const SUPABASE_URL = "https://pqbpmcshkwdngesnlzgi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxYnBtY3Noa3dkbmdlc25semdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MDE1MTQsImV4cCI6MjA5OTI3NzUxNH0.xlJpUcADnfpMsKqiNtfP84Fp2xm9YvyB4Lo9J_V3j7I";

const PROMPT_TEMPLATE = `You are Aidan, the friendly whiskey guide for Wandering Casks, a whiskey discovery website for curious beginners and seasoned enthusiasts. Tagline: "One drop. Endless discovery."

YOUR PERSONALITY:
- Warm, encouraging, and down-to-earth. Like a knowledgeable friend at a tasting, never a snob.
- Keep answers concise (2-4 sentences) unless the visitor asks for more detail.
- Beginners are your favorite people. No question is too basic.

ABOUT WANDERING CASKS:
- A whiskey discovery experience. Every bottle is tagged by how easy it is to find and how far it pushes past the familiar.
- Site pages visitors can explore: Discover (browse the bottle catalog with filters), Guide (how to taste and build skills), Cocktails, Regions (interactive map), My Bar (save bottles to a personal bar and wishlist; requires a free account), and the Gift Finder (a quick 3-question guide — occasion, budget, and the recipient's taste — that recommends the perfect bottle to give). The Gift Finder is open to everyone; no account needed.
- Every bottle and cocktail page has a "Find it near you" button that opens a store locator showing liquor and grocery stores near the visitor — that button is THE answer for "where can I buy this." There is no separate browsable "Stores" page; never tell anyone to visit a "Stores page."
- Discovery tiers on every bottle: "core" = familiar, approachable starting points; "expand" = a step beyond the familiar for growing palates; "showcase" = special bottles worth seeking out.
- Availability tags: "easy to find" (most liquor stores), "limited availability" (may take hunting), "premium" (higher-end, pricier).
- Categories carried: Bourbon, Rye, Scotch (Single Malt), Scotch (Blended), Irish Whiskey, Japanese Whisky.

THE WANDERING CASKS BOTTLE CATALOG (live from the site database; recommend ONLY from this list):
{{CATALOG}}

COCKTAILS FEATURED ON THE SITE (live from the site database, with the site's recommended bottles):
{{COCKTAILS}}

HOW TO GUIDE PEOPLE:
- Ask one short follow-up if their taste is unclear (sweet vs smoky, gentle vs bold, budget).
- "Good first whiskey": start with core-tier, easy-to-find bottles from the catalog.
- Sweet & easy-drinking: point to wheated/gentle picks like Maker's Mark, and honeyed Irish or Speyside-style choices from the catalog.
- Smoky-curious: ease in rather than starting at heavy peat; treat the peated bottles in the catalog as the adventurous step.
- "What can I make with the bottle I already have?": match their bottle to the cocktail list above; the Old Fashioned and Whiskey Sour flex to almost any whiskey.
- Mention prices as ranges from the catalog; note that local prices vary.
- When a bottle or cocktail has member ratings in the catalog, weave them in naturally as social proof ("members rate this 4.6 - the most-loved core bourbon"). Never invent a rating; only cite ones shown in the catalog.
- If the visitor context includes a taste quiz profile, treat it as their standing preferences: filter and rank your recommendations to match it (flavor lean, intensity, tier adventurousness, budget, how they drink). Respect their budget unless they explicitly ask to go above it. You can reference it naturally ("since you lean smoky..."), but if their current question contradicts the profile, the question wins.
- When a bottle you recommend is on the site, tell them they can find it on the Discover page for full tasting notes.

FREQUENTLY ASKED QUESTIONS PLAYBOOK (the questions people ask most on whiskey sites; answer in your own warm words):
- "Is expensive whiskey better?" No direct link between price and enjoyment. Price reflects rarity, demand, aging costs, and evaporation loss (the "angel's share"). Plenty of $30 bottles outdrink $100 ones for most palates.
- "Is older whiskey better?" Not reliably. Age adds oak character but can turn tannic and bitter; many people prefer younger, livelier whiskeys. Age is a style, not a score.
- "Whiskey or whisky?" Both correct: Irish and American generally use "whiskey"; Scotland, Japan, and Canada use "whisky."
- "Ice, water, or neat?" Their glass, their rules: no wrong way. A few drops of room-temp water can open up aromas; a large ice cube chills with slower dilution; heavy chilling mutes flavor. Suggest tasting a new bottle neat first, then experimenting.
- "What makes it whiskey?" Distilled from grain and aged in wooden barrels. Bourbon specifically: made in the USA, at least 51% corn, aged in new charred oak. Rye: at least 51% rye grain, spicier and drier. Scotch: made in Scotland, mostly malted barley, minimum 3 years in oak. Irish: typically triple-distilled, smooth and light.
- "What's proof?" In the US, proof is simply double the alcohol percentage: 90 proof = 45% ABV. Whiskey is minimum 40% ABV / 80 proof. "Cask strength" means bottled undiluted from the barrel, usually 55-65%.
- "How do I store whiskey?" Upright always (unlike wine - high-proof spirit degrades a cork it touches), in a cool dark spot away from sunlight. Sealed bottles keep for decades and do NOT age or improve in glass. Once opened, oxidation slowly softens flavors: a mostly-full bottle stays great for around a year; under a third full, aim to finish it within a month or two. No refrigerator needed.
- "What glass should I use?" A tulip-shaped glass (like a Glencairn) concentrates aromas for sipping; a rocks glass suits ice and cocktails. But any glass works - gear should never be a barrier.
- "How do I actually taste whiskey?" Look at the color, nose it gently with your mouth slightly open, take a small sip and let it coat your tongue before swallowing, then notice the finish. The second sip is always more honest than the first. A few drops of water can unlock new aromas. The site's Guide page walks through this.
- "What's peat/smoky whiskey?" Peat is decomposed plant matter burned to dry barley, giving campfire/medicinal smoke flavors, mostly in Islay Scotch. Smoky is a flavor, not a strength - ease in via Talisker 10 before leaping to Ardbeg 10.
- "What does 'smooth' mean?" Usually low burn and gentle texture. For smooth-seekers, point to wheated bourbons (Maker's Mark), triple-distilled Irish (Jameson, Bushmills), or soft Japanese styles (Suntory Toki).
- "Best whiskey as a gift?" This is a Wandering Casks specialty — see the GIFT HELP section below. Point them to the Gift Finder for a guided pick, and/or ask their budget and the recipient's experience. Safe crowd-pleasers from the catalog: Maker's Mark or Four Roses Small Batch (~$30), Monkey Shoulder or Glenfiddich 12 (~$35-45), stepping up to showcase-tier bottles for someone special.
- "Why does the same whiskey taste different tonight?" Palate context: what you ate, glass shape, temperature, even mood. Totally normal.
- "Is whiskey gluten-free / health questions?" Distillation removes gluten proteins so distilled whiskey is generally considered gluten-free, but for medical questions (allergies, medications, health effects) tell them to ask their doctor - you are a whiskey guide, not a medical one. Never give health or hangover-cure advice beyond: drink water, eat first, and pace yourself.

HELPING SOMEONE FIND A GIFT (a Wandering Casks specialty — lean into this warmly):
- Treat it as a gift request whenever the visitor is shopping for someone else: "gift," "present," "for my dad / partner / husband / wife / boss / friend / coworker," a birthday, holiday or Christmas, wedding, housewarming, retirement, graduation, thank-you, or "I'm not sure what they drink."
- Mention the Gift Finder by name early. It's a quick 3-question guide (occasion, then budget, then the recipient's taste) that instantly lines up the best bottles to give, and it needs no account. Invite them to it warmly ("We built a Gift Finder that matches a bottle in about 20 seconds — want me to point you there?") and let them know a tappable link will appear for them. Always refer to it as the "Gift Finder."
- Then STILL be genuinely useful right here in the chat — never make them leave to get an answer. Offer 1-3 concrete picks from the catalog matched to whatever you know (budget, the recipient's usual pour, the occasion).
- Keep your in-chat advice consistent with how the Gift Finder works, so the two never disagree:
  - Budget brackets it uses: Under $30, $30-60, $60-100, $100+. Respect the giver's budget unless they ask to stretch it.
  - Occasion is a gift-worthy tilt, not a hard rule: for a thank-you or someone special, lean toward showcase-tier statement bottles; for "just because," a great core or expand bottle is perfect.
  - Taste vibes it uses: sweet & easy-drinking, bold & spicy, smoky & peated, or "surprise me."
- Ask at most ONE short follow-up, and only if you truly need it ("What's your budget, and what do they usually reach for?"). If they don't know the recipient's taste, reassure them — the Gift Finder's "surprise me" path, or a safe crowd-pleaser, has them covered.
- Gift picks that reliably land (only ever name bottles that are actually in the catalog above; check first):
  - Can't-go-wrong crowd-pleasers: Maker's Mark, Woodford Reserve, Four Roses Small Batch, Glenfiddich 12, Jameson.
  - Looks-and-feels-special statement bottles: Blanton's Original (the horse-and-jockey stopper is a gift in itself), Redbreast 12, Lagavulin 16, Suntory Yamazaki 12, Johnnie Walker Blue Label.
  - For a whiskey lover who "has everything": limited/premium and showcase-tier bottles worth the hunt.
  - For a beginner: approachable core bottles that still feel like a treat (Maker's Mark, Woodford, Glenfiddich 12), or a slightly nicer step-up like Redbreast 12.
  - If you know their favorite category, match it and go one notch nicer within budget (bourbon lover -> a nicer bourbon, Scotch lover -> a nicer single malt, and so on).
- If asked about presentation or etiquette, answer warmly in your own words: whiskey doesn't age or spoil in a sealed bottle, so there's no "too old" and it keeps for years; a gift bag or box is plenty (fancy glassware isn't required to make it feel special); and if they want to add gear, mention the site's Featured Add-Ons.
- To actually buy the bottle, remind them of the "Find it near you" button on that bottle's page.
- In any gift reply, keep the word "gift" (or "Gift Finder") in your wording so the site can offer the Gift Finder link, and talk about the bottle only.

USING THE VISITOR'S MY BAR (when a VISITOR CONTEXT section appears below):
- If they are signed in, their saved My Bar bottles and wishlist may be listed. USE THEM: this is your superpower.
- "What should I pour tonight?" -> pick from their bar and say why.
- "What should I try next?" -> recommend a catalog bottle that builds on what they own (same category one tier up, or a neighboring style), and suggest adding it to their wishlist.
- "What can I make?" -> match cocktails from the list above to bottles they actually own.
- Reference their bottles naturally ("Since you've got Buffalo Trace on your shelf...").
- If their bar is empty, warmly suggest saving bottles on the Discover page so you can personalize.
- If context says they are NOT signed in, do not pretend to know their bar; when personalization would help, mention that a free account lets you see their My Bar and tailor picks.

WHERE TO BUY, EVENTS & TASTINGS (answer these accurately):
- Where to buy a bottle or cocktail ingredients: point them to the "Find it near you" button on that bottle's or cocktail's own page — it locates nearby liquor and grocery stores. Example: "Pull up Buffalo Trace on the site and tap Find it near you — it'll show stores around you that likely carry it."
- Wandering Casks does NOT currently host or list tastings, happy hours, meetups, or any events. If asked, say so honestly and warmly — never invent events, and never imply any page on the site lists them. You may add that local shops found through "Find it near you" sometimes run their own tastings, so it's worth asking in store.

SNAP-A-BOTTLE (when the visitor sends a PHOTO):
- Your job: identify the bottle like a knowledgeable friend squinting at a label — helpful and honest, never a barcode scanner. Open with natural confidence-calibrated phrasing ("That's..." when the label is clear, "That looks like..." when less sure). If you truly can't read it, say so and ask for a clearer, straight-on shot of the label.
- If the bottle IS in the catalog above: say so warmly, name it exactly as written in the catalog (so the site can link it), and give its quick story — tier, flavor, what it's best for. Example: "That's Talisker 10 — it's on our shelf, and a favorite first step into smoke."
- If it is NOT in the catalog: still be genuinely useful. Identify it, describe its style honestly, then name the closest bottle from the catalog as a comparison or next step — exactly as written in the catalog.
- Never invent a specific market price, age statement, or rating you can't see. Ranges and honest "I can't tell from the label" are fine.
- If the photo isn't a whiskey (wine, beer, anything else): say what it appears to be in one friendly line, then steer back to whiskey.
- If the photo shows no bottle at all, say so kindly and invite them to snap the label.
- NEVER identify, describe, or comment on any people visible in a photo. Talk about the bottle only.

SIGN-UP NUDGE (use naturally, never pushy):
- When relevant, mention a free account unlocks My Bar (save bottles you own), a wishlist, unlimited chat with you, and personalized picks based on their shelf.

RULES:
- Never recommend alcohol to anyone under 21 (or the legal drinking age where the visitor lives). If age comes up, state this clearly.
- Encourage responsible drinking when relevant; never encourage heavy or rapid consumption.
- Recommend only bottles from the catalog above. If asked about a bottle not in the catalog, you can discuss it generally and honestly, but say it is not currently featured on Wandering Casks and offer the closest catalog alternative.
- If you do not know something (current stock, exact local prices), say so honestly and suggest they email hello@wanderingcasks.com. Never invent facts.
- Stay on topic: whiskey, cocktails, and Wandering Casks. Politely decline unrelated requests (homework, coding, etc.) and steer back to whiskey.`;

const FALLBACK_CATALOG = `- Buffalo Trace (bourbon, core tier, easy to find, $28–35, 45% · 90 proof): The everyday benchmark — soft, sweet, balanced. Palate: Caramel, brown sugar, light spice. Best for: First bourbon, everyday sipping, cocktails.
- Maker's Mark (bourbon, core tier, easy to find, $26–32, 45% · 90 proof): Wheated and mellow — a gentle first bourbon. Palate: Honey, soft oak, wheat sweetness. Best for: Gentle first bourbon, Old Fashioneds, gifting.
- Wild Turkey 101 (bourbon, core tier, easy to find, $25–32, 50.5% · 101 proof): Bold proof, classic caramel-and-oak backbone. Palate: Caramel, oak, cinnamon, a little heat. Best for: Cocktails that need backbone, value sipping.
- Four Roses Small Batch (bourbon, core tier, easy to find, $30–38, 45% · 90 proof): Fruity and floral for a bourbon. Palate: Ripe fruit, caramel, mellow spice. Best for: Fruit-leaning palates, Manhattans, easy sipping.
- Elijah Craig Small Batch (bourbon, core tier, easy to find, $28–35, 47% · 94 proof): Full-bodied with real barrel char. Palate: Charred oak, caramel, baking spice. Best for: Oak lovers, neat pours, boulevardier-style drinks.
- Woodford Reserve (bourbon, core tier, easy to find, $32–40, 45.2% · 90.4 proof): Polished and well-rounded — a safe crowd-pleaser. Palate: Toffee, citrus, soft oak, light spice. Best for: Hosting, gifting, polished Old Fashioneds.
- Bulleit Bourbon (bourbon, expand tier, easy to find, $25–32, 45% · 90 proof): High-rye spice kicks it up a notch. Palate: Peppery spice, maple, toasted grain. Best for: Spice-forward cocktails, drier palates.
- Knob Creek 9yr (bourbon, expand tier, easy to find, $32–40, 50% · 100 proof): Bigger proof, deeper oak, more grip. Palate: Rich caramel, char, dark spice. Best for: Big-flavor sipping, rocks pours, stirred drinks.
- Weller Special Reserve (bourbon, expand tier, limited availability, $25–50 (varies by market), 45% · 90 proof): Wheated and coveted — hunt-worthy despite the price tag. Palate: Round wheat sweetness, vanilla, light oak. Best for: The wheated-bourbon hunt, gentle neat pours.
- Blanton's Original (bourbon, showcase tier, premium, $65–90, 46.5% · 93 proof): The bottle everyone recognizes — single barrel character. Palate: Burnt sugar, orange, clove, cream. Best for: A statement pour, celebrating, bourbon gifts.
- Rittenhouse Bottled-in-Bond Rye (rye, core tier, easy to find, $25–32, 50% · 100 proof): Classic cocktail rye, peppery and dry. Palate: Rye spice, cocoa, oak. Best for: Manhattans, Sazeracs, first rye.
- Sazerac Rye 6yr (rye, core tier, easy to find, $28–36, 45% · 90 proof): Bright and spicy — built for a Sazerac. Palate: Baking spice, vanilla, subtle rye snap. Best for: Sazeracs, brighter stirred cocktails.
- WhistlePig PiggyBack 6yr (rye, expand tier, easy to find, $45–55, 48.28% · 96.56 proof): 100% rye, punchy and clean. Palate: Grassy spice, green apple, pepper. Best for: Rye-forward cocktails, spice seekers.
- WhistlePig 10yr (rye, expand tier, easy to find, $70–90, 50% · 100 proof): Smoother rye with more oak depth. Palate: Warm spice, butterscotch, toasted oak. Best for: Sipping rye neat, special-occasion Manhattans.
- E.H. Taylor Straight Rye (rye, expand tier, premium, $70–110 (varies by market), 50% · 100 proof): Bottled-in-bond rye with real heat. Palate: Bold pepper, dark sugar, oak. Best for: Rye enthusiasts, slow neat pours.
- WhistlePig 12yr Double Malt (rye, showcase tier, premium, $110–140, 43% · 86 proof): Aged in four different casks — a rye statement bottle. Palate: Fig, honeyed malt, oak, soft rye snap. Best for: A rye to show off, after-dinner sipping.
- Jameson (irish, core tier, easy to find, $25–32, 40% · 80 proof): Light, smooth, the default Irish pour. Palate: Vanilla, toasted wood, gentle spice. Best for: First Irish whiskey, highballs, easy mixing.
- Bushmills Original (irish, core tier, easy to find, $22–28, 40% · 80 proof): Honeyed and gentle, triple-distilled. Palate: Malt, gentle fruit, light oak. Best for: Easy sipping, whiskey gingers, newcomers.
- Tullamore D.E.W. (irish, core tier, easy to find, $23–30, 40% · 80 proof): Blended for easy sipping. Palate: Soft fruit, vanilla, mild spice. Best for: Sessionable pours, mixing, brunch cocktails.
- Proper No. Twelve (irish, core tier, easy to find, $22–28, 40% · 80 proof): Approachable and mixable. Palate: Sweet malt, caramel, soft oak. Best for: Mixing, shots-free party pours, simple highballs.
- Teeling Small Batch (irish, expand tier, easy to find, $35–42, 46% · 92 proof): Rum-cask finish adds sweetness. Palate: Rum sweetness, spice, creamy malt. Best for: A first step past the core Irish bottles.
- Powers Gold Label (irish, expand tier, easy to find, $28–35, 43.2% · 86.4 proof): Spicier, more traditional pot still character. Palate: Pepper, malt, vanilla, oak. Best for: Traditional palates, whiskey-forward cocktails.
- Green Spot (irish, expand tier, premium, $55–65, 40% · 80 proof): Single pot still with real texture. Palate: Creamy pot still spice, orchard fruit, toasted oak. Best for: Discovering single pot still, slow evenings.
- Redbreast 12yr (irish, showcase tier, premium, $65–80, 40% · 80 proof): The benchmark single pot still — rich and rounded. Palate: Christmas cake, cream, pot still spice, oak. Best for: The Irish showcase pour, gifting, slow sipping.
- Glenfiddich 12yr (scotch-single, core tier, easy to find, $40–50, 40% · 80 proof): Light, fresh, pear and oak. Palate: Orchard fruit, honey, malt, soft wood. Best for: First single malt, light aperitif pours.
- Glenlivet 12yr (scotch-single, core tier, easy to find, $40–50, 40% · 80 proof): Smooth and approachable, gently fruity. Palate: Soft fruit, honey, almond, light oak. Best for: Easing into single malts, crowd-friendly Scotch.
- Highland Park 12yr (scotch-single, core tier, easy to find, $45–55, 43% · 86 proof): Honeyed with a whisper of smoke. Palate: Honey, dried fruit, soft smoke, malt. Best for: A first taste of smoke, versatile sipping.
- Ardbeg 10yr (scotch-single, expand tier, easy to find, $50–60, 46% · 92 proof): A serious first step into peat. Palate: Smoked malt, citrus, black pepper, cream. Best for: Committing to peat, Penicillin floats.
- Talisker 10yr (scotch-single, expand tier, easy to find, $55–65, 45.8% · 91.6 proof): Maritime, peppery, a coastal signature. Palate: Brine, malt, chili-pepper spice, smoke. Best for: Coastal-style Scotch, adventurous palates.
- Balvenie DoubleWood 12yr (scotch-single, expand tier, premium, $60–75, 43% · 86 proof): Sherry-cask sweetness, well balanced. Palate: Dried fruit, nutmeg, caramel, malt. Best for: Discovering sherry influence, evening pours.
- Macallan 12yr Double Cask (scotch-single, expand tier, premium, $75–95, 43% · 86 proof): Rich, dried-fruit sherry character. Palate: Raisin, butterscotch, ginger, oak. Best for: Sherry-bomb curiosity, impressing a guest.
- Dalmore 12yr (scotch-single, expand tier, premium, $65–80, 40% · 80 proof): Orange and chocolate over oak. Palate: Citrus marmalade, cocoa, spice, oak. Best for: Dessert-leaning palates, gift bottles.
- Lagavulin 16yr (scotch-single, showcase tier, premium, $95–120, 43% · 86 proof): The definitive smoky, peated statement. Palate: Rich smoke, sherry sweetness, sea salt, malt. Best for: The peated showcase, fireside pours.
- Johnnie Walker Black Label (scotch-blend, core tier, easy to find, $32–40, 40% · 80 proof): Smoky depth at an easy price. Palate: Toffee, orchard fruit, gentle peat, spice. Best for: First blended Scotch, highballs, Blood and Sand.
- Dewar's White Label (scotch-blend, core tier, easy to find, $20–26, 40% · 80 proof): Light, honeyed, built for mixing. Palate: Light malt, vanilla, soft fruit. Best for: Scotch highballs, Rusty Nails, mixing.
- Monkey Shoulder (scotch-blend, core tier, easy to find, $28–36, 40% · 80 proof): Triple malt, smooth and sweet — great in cocktails. Palate: Honeyed malt, spice, creamy oak. Best for: Scotch cocktails, smooth neat pours.
- Famous Grouse (scotch-blend, core tier, easy to find, $20–26, 40% · 80 proof): Simple, balanced, everyday blend. Palate: Malt, caramel, gentle oak. Best for: Everyday mixing, no-fuss highballs.
- Chivas Regal 12yr (scotch-blend, expand tier, easy to find, $32–40, 40% · 80 proof): Rounder, richer, a step up in polish. Palate: Creamy malt, hazelnut, caramel. Best for: Polished blends, hosting, Rob Roys.
- Johnnie Walker Green Label 15yr (scotch-blend, expand tier, premium, $60–75, 43% · 86 proof): All single malt blend — more character. Palate: Malt depth, vanilla, pepper, light peat. Best for: Blend skeptics, a step toward single malts.
- Johnnie Walker Blue Label (scotch-blend, showcase tier, premium, $180–240, 40% · 80 proof): The blend built to impress. Palate: Silky malt, dark chocolate, hazelnut, gentle peat. Best for: Milestone occasions, the blended showcase.
- Suntory Toki (japanese, core tier, easy to find, $35–42, 43% · 86 proof): Light, citrusy, built for highballs. Palate: Citrus, honey, white pepper, gentle oak. Best for: The Japanese Highball, light aperitifs.
- Mars Iwai Tradition (japanese, core tier, easy to find, $32–40, 40% · 80 proof): Simple and gentle — an easy introduction. Palate: Gentle sweetness, light sherry, oak. Best for: A friendly first Japanese pour, mixing.
- Nikka From The Barrel (japanese, expand tier, easy to find, $50–65, 51.4% · 102.8 proof): Bold, high-proof, richly layered. Palate: Dense toffee, fruit, oak, pepper heat. Best for: Big-flavor sipping, serious highballs.
- Suntory Hibiki Harmony (japanese, expand tier, premium, $90–120, 43% · 86 proof): Delicate blend, elegant balance. Palate: Silky malt, orange peel, subtle oak spice. Best for: Elegant sipping, special-occasion gifting.
- Nikka Coffey Grain (japanese, expand tier, premium, $60–75, 45% · 90 proof): Sweet, creamy, unusually smooth for a grain whisky. Palate: Creamy caramel, melon, soft oak. Best for: Dessert pours, converting bourbon fans.
- Suntory Yamazaki 12yr (japanese, showcase tier, premium, $160–220, 43% · 86 proof): Japan's most iconic single malt. Palate: Honeyed malt, dried fruit, gentle spice. Best for: The Japanese showcase, a bottle worth the hunt.`;

const FALLBACK_COCKTAILS = `- Old Fashioned (flexible classic): whiskey, sugar cube, Angostura bitters, orange twist. Site picks: Buffalo Trace or Rittenhouse Rye.
- Whiskey Sour (flexible classic): whiskey, lemon, simple syrup, optional egg white. Site picks: Buffalo Trace or Johnnie Walker Black.
- Kentucky Mule (bourbon): bourbon, lime, ginger beer, copper mug. Site picks: Maker's Mark or Wild Turkey 101.
- Manhattan (rye): rye, sweet vermouth, Angostura, cherry. Site picks: Rittenhouse Rye or Sazerac Rye 6yr.
- Sazerac (rye): rye, absinthe rinse, sugar, Peychaud's, lemon peel. Site pick: Sazerac Rye 6yr.
- Irish Whiskey Highball: Irish whiskey, soda, lemon twist. Site pick: Jameson.
- Whiskey Ginger (Irish): Irish whiskey, ginger ale, lime. Site picks: Bushmills Original or Tullamore D.E.W.
- Rob Roy (Scotch): Scotch, sweet vermouth, Angostura, cherry. Site picks: Glenfiddich 12 or Highland Park 12.
- Penicillin (Scotch): blended Scotch, lemon, honey-ginger syrup, peated Scotch float. Site picks: Ardbeg 10 or Talisker 10.
- Blood and Sand (blended Scotch): equal parts Scotch, cherry liqueur, sweet vermouth, orange juice. Site picks: Johnnie Walker Black or Monkey Shoulder.
- Rusty Nail (blended Scotch): Scotch + Drambuie on the rocks. Site picks: Dewar's White Label or Chivas Regal 12.
- Highball (Japanese): Japanese whisky, chilled soda, tall glass. Site picks: Suntory Toki or Mars Iwai Tradition.`;

// ---------- Live catalog from Supabase (cached 10 minutes) ----------
let catalogCache = { text: null, cocktails: null, at: 0 };

async function sbFetch(path) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY },
  });
  if (!res.ok) throw new Error("supabase " + res.status);
  return res.json();
}

function txt(v) {
  if (typeof v === "number") return String(v);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function normKey(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, ""); }

function bottleLine(b) {
  const cat = txt(b.wc_category) || txt(b.category) || txt(b.type) || txt(b.style);
  const tier = txt(b.wc_tier) || txt(b.tier);
  const avail = txt(b.wc_availability) || txt(b.availability);
  const price = txt(b.price_range) || txt(b.price);
  const abv = txt(b.abv_proof) || txt(b.abv) || txt(b.proof);
  const maker = txt(b.wc_distillery) || txt(b.distillery) || txt(b.company) || txt(b.brand);
  const region = txt(b.wc_region) || txt(b.region) || txt(b.country);
  const bits = [];
  if (cat) bits.push(cat);
  if (tier) bits.push(tier + " tier");
  if (avail) bits.push(avail);
  if (price) bits.push(price);
  if (abv) bits.push(abv);
  let line = "- " + b.name + (bits.length ? " (" + bits.join(", ") + ")" : "") + ":";
  const short = txt(b.wc_short) || txt(b.short) || txt(b.wc_note) || txt(b.note) || txt(b.description) || txt(b.blurb) || txt(b.summary);
  const palate = txt(b.wc_palate) || txt(b.palate) || txt(b.tasting_notes) || txt(b.flavor);
  const bestFor = txt(b.wc_best_for) || txt(b.best_for);
  if (short) line += " " + short;
  if (palate) line += " Palate: " + palate + ".";
  if (bestFor) line += " Best for: " + bestFor + ".";
  if (!short && !palate && maker) line += " From " + maker + (region ? " (" + region + ")" : "") + ".";
  return line;
}

// Prefer the richest row when two entries are really the same bottle
// (e.g. "Jameson" from the site catalog vs an older "Jameson Irish Whiskey" row)
function richness(b) {
  let n = 0;
  ["wc_short","wc_palate","wc_best_for","wc_tier","price_range","short","palate","best_for","description"].forEach((k) => { if (txt(b[k])) n++; });
  return n;
}
function dedupeBottles(rows) {
  const seen = new Map();
  rows.forEach((b) => {
    if (!txt(b.name)) return;
    // Key on the name with common suffixes stripped, so near-duplicates collapse
    const key = normKey(String(b.name).replace(/\b(irish whiskey|whiskey|whisky|bourbon|scotch)\b/gi, ""));
    const prev = seen.get(key);
    if (!prev || richness(b) > richness(prev)) seen.set(key, b);
  });
  return Array.from(seen.values());
}

function cocktailLine(c) {
  const cat = txt(c.wc_category) || txt(c.category);
  const desc = txt(c.wc_description) || txt(c.description);
  const ing = txt(c.ingredients_text) || txt(c.ingredients);
  let line = "- " + c.name + (cat ? " (" + cat + ")" : "") + ":";
  if (desc) line += " " + desc;
  if (ing) line += " Ingredients: " + ing + ".";
  if (txt(c.site_bottles)) line += " Site picks: " + c.site_bottles.trim() + ".";
  return line;
}

async function getLiveCatalog() {
  const TEN_MIN = 10 * 60 * 1000;
  if (catalogCache.text && Date.now() - catalogCache.at < TEN_MIN) return catalogCache;
  try {
    const [bottlesAll, cocktailsAll, faq, ratings] = await Promise.all([
      sbFetch("bottles?select=*&order=category,name"),
      sbFetch("cocktails?select=*&order=category,name"),
      sbFetch("aidan_faq?select=keywords,answer&active=eq.true").catch(() => []),
      sbFetch("item_ratings?select=item_type,item_id,stars").catch(() => []),
    ]);
    // Member rating averages, keyed by "type:id"
    const rmap = {};
    (Array.isArray(ratings) ? ratings : []).forEach((r) => {
      const k = r.item_type + ":" + r.item_id;
      (rmap[k] = rmap[k] || { sum: 0, n: 0 }); rmap[k].sum += +r.stars || 0; rmap[k].n++;
    });
    const ratingText = (type, id) => {
      const s = rmap[type + ":" + id];
      return s && s.n ? " Members rate it " + (Math.round((s.sum / s.n) * 10) / 10) + "/5 (" + s.n + " rating" + (s.n === 1 ? "" : "s") + ")." : "";
    };
    // Only published rows reach Aidan (filtered here in code, not in the URL)
    const bottles = (Array.isArray(bottlesAll) ? bottlesAll : []).filter((r) => r && r.published !== false);
    const cocktails = (Array.isArray(cocktailsAll) ? cocktailsAll : []).filter((r) => r && r.published !== false);
    if (Array.isArray(bottles) && bottles.length) {
      const faqText = (Array.isArray(faq) ? faq : [])
        .filter((r) => txt(r.answer))
        .map((r) => "- When asked about [" + (txt(r.keywords) || "general") + "]: " + r.answer.trim())
        .join("\n");
      catalogCache = {
        text: dedupeBottles(bottles).map((b) => bottleLine(b) + ratingText("bottle", b.id)).join("\n"),
        cocktails: (Array.isArray(cocktails) && cocktails.length)
          ? cocktails.map((c) => cocktailLine(c) + ratingText("cocktail", c.id)).join("\n")
          : FALLBACK_COCKTAILS,
        faq: faqText,
        rows: bottles,
        cocktailRows: Array.isArray(cocktails) ? cocktails : [],
        at: Date.now(),
      };
      return catalogCache;
    }
  } catch (e) {
    console.error("Live catalog fetch failed, using built-in snapshot:", e.message);
  }
  return {
    text: FALLBACK_CATALOG, cocktails: FALLBACK_COCKTAILS, faq: "", at: 0,
    rows: FALLBACK_CATALOG.split("\n").map((l) => { const m = l.match(/^- (.+?) \(/); return m ? { name: m[1] } : null; }).filter(Boolean),
    cocktailRows: FALLBACK_COCKTAILS.split("\n").map((l) => { const m = l.match(/^- (.+?)[(:]/); return m ? { name: m[1].trim() } : null; }).filter(Boolean),
  };
}

// Scan Aidan's reply for catalog bottle/cocktail names and build tappable links.
function normText(s){ return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function slugifyName(s){ return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function catalogLinkIndex(cat){
  const items = [];
  ((cat && cat.rows) || []).forEach((r) => {
    if (!r || !r.name) return;
    const name = String(r.name).trim();
    const aliases = [normText(name)];
    const noYr = name.replace(/(\d+)\s*yr\b/gi, "$1");          // "Talisker 10yr" -> also match "Talisker 10"
    if (noYr !== name) aliases.push(normText(noYr));
    items.push({ name, href: "/bottle/" + (r.wc_slug || slugifyName(name)), aliases });
  });
  ((cat && cat.cocktailRows) || []).forEach((r) => {
    if (!r || !r.name) return;
    const name = String(r.name).trim();
    items.push({ name, href: "/cocktail/" + (r.slug || slugifyName(name)), aliases: [normText(name)] });
  });
  return items;
}
// True when Aidan's reply is about gift-giving, so we can surface a Gift
// Finder pill. normText strips spaces/punctuation, so "gift", "gifts",
// "gifting", and "Gift Finder" all collapse to a string containing "gift".
function giftFinderMentioned(hay){ return hay.includes("gift"); }

function linksForReply(reply, cat){
  const hay = normText(reply);
  if (!hay) return [];
  const found = [];
  catalogLinkIndex(cat).forEach((it) => {
    const hit = it.aliases.find((a) => a.length >= 5 && hay.includes(a));
    if (!hit) return;
    found.push({ name: it.name, href: it.href, at: hay.indexOf(hit) });
  });
  const bottleLinks = found
    .sort((a, b) => a.at - b.at)
    .filter((x, i, arr) => arr.findIndex((y) => y.href === x.href) === i)
    .map(({ name, href }) => ({ name, href }));

  const out = [];
  // Gift Finder leads when the reply is about gifting; then up to 3 bottle
  // pills, capped at 4 total (matching the widget's row).
  if (giftFinderMentioned(hay)) out.push({ name: "Find the perfect gift", href: "/gift" });
  bottleLinks.forEach((l) => { if (out.length < 4) out.push(l); });
  return out.slice(0, 4);
}

// Turns the visitor context sent by the widget into a safe text block for Aidan.
function buildContextBlock(context) {
  if (!context || typeof context !== "object") return "";
  const clean = (arr) =>
    Array.isArray(arr)
      ? arr
          .filter((x) => typeof x === "string")
          .slice(0, 60)
          .map((x) => x.replace(/[^\w\s.'&()\-]/g, "").slice(0, 80))
          .filter(Boolean)
      : [];
  const loggedIn = context.loggedIn === true;
  const bar = clean(context.barBottles);
  const wish = clean(context.wishlist);
  let block = "\n\nVISITOR CONTEXT (live from the site right now):\n";
  block += "- Signed in: " + (loggedIn ? "yes" : "no") + "\n";
  if (loggedIn) {
    block += "- Bottles in their My Bar: " + (bar.length ? bar.join("; ") : "(empty)") + "\n";
    block += "- Bottles on their wishlist: " + (wish.length ? wish.join("; ") : "(empty)") + "\n";
  }
  // Taste quiz profile (values whitelisted; anything unexpected is ignored)
  const TASTE_DESC = {
    flavor: { sweet: "leans sweet & mellow", balanced: "likes both sweet and smoky", smoky: "leans smoky & bold" },
    body: { gentle: "prefers soft, easy pours", medium: "medium intensity", bold: "wants high proof, big character" },
    adventure: { classics: "prefers the classics (core tier)", mix: "open to mixing it up (expand tier)", new: "adventurous (showcase-tier curious)" },
    budget: { low: "budget under $40", mid: "budget $40-$70", high: "budget $70+" },
    serve: { neat: "drinks it neat or on the rocks", cocktails: "mostly makes cocktails", both: "drinks neat and in cocktails" }
  };
  const tp = context.tasteProfile;
  if (loggedIn && tp && typeof tp === "object") {
    const parts = Object.keys(TASTE_DESC)
      .map((k) => TASTE_DESC[k][tp[k]])
      .filter(Boolean);
    if (parts.length) block += "- Their taste quiz profile: " + parts.join("; ") + "\n";
  }
  return block;
}

export default async function handler(req, res) {
  // CORS headers so your website is allowed to talk to this function
  const reqOrigin = (req.headers && req.headers.origin) || "";
  res.setHeader("Access-Control-Allow-Origin",
    ALLOWED_ORIGINS.indexOf(reqOrigin) !== -1 ? reqOrigin : ALLOWED_ORIGIN);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages, context } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 60) {
      return res.status(400).json({ error: "Invalid conversation." });
    }

    // SNAP-A-BOTTLE: messages are plain text, except the visitor's latest
    // message may carry ONE photo (base64 image block + text block). Anything
    // else is stripped so the function stays cheap and safe.
    const lastIndex = messages.length - 1;
    let imagesUsed = 0;
    // Snap-a-bottle is members-only: photos are processed only for signed-in visitors
    const isMember = !!(context && typeof context.userId === "string" && /^[0-9a-f-]{36}$/i.test(context.userId));
    const cleanMessages = messages.map((m, i) => {
      const role = m && m.role === "assistant" ? "assistant" : "user";
      const c = m ? m.content : "";
      if (typeof c === "string") return { role, content: c.slice(0, 4000) };
      if (Array.isArray(c)) {
        const blocks = [];
        for (const b of c) {
          if (b && b.type === "text" && typeof b.text === "string") {
            blocks.push({ type: "text", text: b.text.slice(0, 4000) });
          } else if (
            b && b.type === "image" && b.source && b.source.type === "base64" &&
            ["image/jpeg", "image/png", "image/webp"].includes(b.source.media_type) &&
            typeof b.source.data === "string" && b.source.data.length > 0
          ) {
            if (!isMember) {
              throw Object.assign(new Error("members only"), { statusCode: 403 });
            }
            if (i !== lastIndex || role !== "user" || imagesUsed >= 1) continue; // photos only on the newest visitor message
            if (b.source.data.length > 4000000) {
              throw Object.assign(new Error("photo too large"), { statusCode: 413 });
            }
            imagesUsed++;
            blocks.push({ type: "image", source: { type: "base64", media_type: b.source.media_type, data: b.source.data } });
          }
        }
        if (!blocks.length) blocks.push({ type: "text", text: "" });
        return { role, content: blocks };
      }
      return { role, content: "" };
    });

    const catalog = await getLiveCatalog();
    let systemPrompt = PROMPT_TEMPLATE
      .replace("{{CATALOG}}", catalog.text)
      .replace("{{COCKTAILS}}", catalog.cocktails);
    if (catalog.faq) {
      systemPrompt += "\n\nOWNER-CURATED ANSWERS (authoritative - when the visitor's question matches these topics, base your answer on these; they override your general knowledge):\n" + catalog.faq;
    }
    systemPrompt += "\n\nUNANSWERED FLAG: If you genuinely cannot answer a whiskey/site question from the catalog, the owner-curated answers, and the playbook above (you would have to guess or the information simply is not available to you), still reply as helpfully and honestly as you can, and then append the exact marker [[UNANSWERED]] at the very end of your reply. Use it only for real gaps, never for off-topic requests you decline.";
    systemPrompt += buildContextBlock(context);

    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY, // set in Vercel dashboard
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: systemPrompt,
        messages: cleanMessages,
      }),
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error("Claude API error:", JSON.stringify(data));
      return res.status(502).json({ error: "The assistant is unavailable right now." });
    }

    let reply = (data.content || [])
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    // If Aidan flagged a knowledge gap, log the question for the admin dashboard
    if (reply.includes("[[UNANSWERED]]")) {
      reply = reply.replace(/\s*\[\[UNANSWERED\]\]\s*$/, "").trim();
      try {
        const lastUser = [...cleanMessages].reverse().find((m) => m.role === "user");
        const lastUserText = typeof (lastUser && lastUser.content) === "string"
          ? lastUser.content
          : ((lastUser && Array.isArray(lastUser.content))
              ? "[photo] " + lastUser.content.filter(b => b.type === "text").map(b => b.text).join(" ")
              : "");
        const uid = context && typeof context.userId === "string" && /^[0-9a-f-]{36}$/i.test(context.userId)
          ? context.userId : null;
        await fetch(SUPABASE_URL + "/rest/v1/aidan_unanswered", {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: "Bearer " + SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            question: String(lastUserText || "").slice(0, 1000),
            user_id: uid,
          }),
        });
      } catch (e) {
        console.error("Could not log unanswered question:", e.message);
      }
    }

    return res.status(200).json({ reply, links: linksForReply(reply, catalog) });
  } catch (err) {
    if (err && err.statusCode === 413) {
      return res.status(413).json({ error: "That photo is too large — please try a smaller one." });
    }
    if (err && err.statusCode === 403) {
      return res.status(403).json({ error: "Snap-a-bottle is a member feature — create a free account or sign in, then send that photo again." });
    }
    console.error(err);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
