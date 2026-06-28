// Funko Lister — local web app.
// Photos -> Claude vision identifies the figure (+ variant) -> you confirm ->
// Claude drafts a listing and pulls market value via web search.
//
// The Anthropic API key stays on this server; the browser never sees it.

const path = require("path");
const express = require("express");
const Anthropic = require("@anthropic-ai/sdk");
require("dotenv").config();

const MODEL = "claude-opus-4-8";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "\n  Missing ANTHROPIC_API_KEY.\n" +
      "  Copy .env.example to .env and paste your key, then restart.\n"
  );
  process.exit(1);
}

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
const app = express();
// 7-10 phone photos, base64-encoded, add up — allow a generous body size.
app.use(express.json({ limit: "60mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---- helpers ---------------------------------------------------------------

// Server tools (web search) run a server-side loop that can return
// stop_reason "pause_turn". Re-send to let it resume until it finishes.
async function createWithResume(params) {
  let response = await client.messages.create(params);
  let guard = 0;
  while (response.stop_reason === "pause_turn" && guard++ < 6) {
    response = await client.messages.create({
      ...params,
      messages: [
        ...params.messages,
        { role: "assistant", content: response.content },
      ],
    });
  }
  return response;
}

function firstJsonObject(text) {
  // Pull the first balanced {...} out of a text blob (tolerates prose around it).
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function imageBlocks(images) {
  return (images || [])
    .filter((img) => img && img.data && img.media_type)
    .slice(0, 12)
    .map((img) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: img.media_type,
        data: img.data,
      },
    }));
}

function ebayUrls(query) {
  const q = encodeURIComponent(query.trim());
  return {
    sold: `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1`,
    active: `https://www.ebay.com/sch/i.html?_nkw=${q}`,
  };
}

// ---- identification --------------------------------------------------------

const IDENTIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    character: { type: "string", description: "Character / subject name." },
    line: {
      type: "string",
      description:
        'Funko line or series printed on the box, e.g. "Pop! Marvel", "Pop! Animation".',
    },
    itemNumber: {
      type: "string",
      description:
        'The collector number on the box (e.g. "1234"). Empty string if not visible.',
    },
    variant: {
      type: "string",
      description:
        'Specific variant if any: "Glow in the Dark", "Metallic", "Flocked", "Chase", "Diamond Collection", etc. Use "Standard" if no special variant.',
    },
    isChase: { type: "boolean", description: "True if this is a Chase variant." },
    exclusivity: {
      type: "string",
      description:
        'Retailer/event exclusive if shown by a sticker, e.g. "Funko Shop", "Hot Topic", "SDCC 2019". Use "Common" if no exclusive sticker.',
    },
    estimatedYear: {
      type: "string",
      description: "Approximate release year if inferable, else empty string.",
    },
    boxConditionNotes: {
      type: "string",
      description: "Visible box condition: creases, dents, sticker residue, sun fading, etc.",
    },
    figureConditionNotes: {
      type: "string",
      description: "Visible figure condition: paint, breakage, dust, yellowing.",
    },
    confidence: {
      type: "string",
      enum: ["high", "medium", "low"],
      description: "Confidence in this identification.",
    },
    identifyingDetails: {
      type: "string",
      description: "What in the photos led to this ID (stickers, number, paint, packaging).",
    },
    possibleAlternatives: {
      type: "array",
      description:
        "Other variants this could be confused with, and how to tell them apart from the photos.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          variant: { type: "string" },
          howToDistinguish: { type: "string" },
        },
        required: ["variant", "howToDistinguish"],
      },
    },
  },
  required: [
    "character",
    "line",
    "itemNumber",
    "variant",
    "isChase",
    "exclusivity",
    "estimatedYear",
    "boxConditionNotes",
    "figureConditionNotes",
    "confidence",
    "identifyingDetails",
    "possibleAlternatives",
  ],
};

app.post("/api/identify", async (req, res) => {
  try {
    const blocks = imageBlocks(req.body.images);
    if (blocks.length === 0) {
      return res.status(400).json({ error: "No images received." });
    }

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: IDENTIFY_SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            ...blocks,
            {
              type: "text",
              text:
                "These are photos of a single Funko Pop figure I want to sell. " +
                "Identify it precisely. Funko Pops often have near-identical variants " +
                "(glow-in-the-dark, metallic, flocked, Chase, Diamond, retailer exclusives) " +
                "that differ in value, so look hard at box stickers, the collector number, " +
                "paint finish, and any 'Chase'/exclusive markings. If you are not certain " +
                "which variant it is, set confidence accordingly and fill possibleAlternatives " +
                "with the variants it could be confused with and exactly how to tell them apart.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      return res.status(502).json({ error: "Model returned no result. Try again." });
    }
    const data = JSON.parse(textBlock.text);
    const queryParts = [data.character, data.line, data.itemNumber, data.variant]
      .filter((s) => s && s !== "Standard" && s !== "Common")
      .join(" ");
    data.ebay = ebayUrls(`Funko Pop ${queryParts}`);
    res.json(data);
  } catch (err) {
    console.error("identify error:", err.message);
    res.status(500).json({ error: err.message || "Identification failed." });
  }
});

// ---- listing + market value -----------------------------------------------

app.post("/api/generate-listing", async (req, res) => {
  try {
    const item = req.body.item || {};
    const condition = req.body.condition || {};

    const query = [
      "Funko Pop",
      item.character,
      item.line,
      item.itemNumber,
      item.variant && item.variant !== "Standard" ? item.variant : "",
      item.exclusivity && item.exclusivity !== "Common" ? item.exclusivity : "",
    ]
      .filter(Boolean)
      .join(" ");
    const ebay = ebayUrls(query);

    const prompt = `You are helping me write a marketplace listing for a Funko Pop I'm selling, and find its current market value.

Confirmed item:
- Character: ${item.character || ""}
- Line/Series: ${item.line || ""}
- Collector number: ${item.itemNumber || ""}
- Variant: ${item.variant || "Standard"}
- Chase: ${item.isChase ? "Yes" : "No"}
- Exclusivity: ${item.exclusivity || "Common"}
- Approx. year: ${item.estimatedYear || "unknown"}

Condition (from me):
- Box included: ${condition.boxIncluded ? "Yes" : "No"}
- Box condition: ${condition.boxCondition || "unspecified"}
- Figure condition: ${condition.figureCondition || "unspecified"}
- Extra notes: ${condition.notes || "none"}

Use web search to find what this exact figure (matching the variant/exclusive) has recently SOLD for — prefer eBay sold/completed listings. Be careful not to quote prices for a different variant.

Then respond with ONLY a JSON object (no prose before or after) of this exact shape:
{
  "title": "an 80-char-max marketplace title (include character, line, number, variant/exclusive)",
  "description": "a polished 2-4 short-paragraph listing description, accurate to the condition above, written to sell honestly",
  "conditionSummary": "one-line condition grade for the listing",
  "priceLow": number,
  "priceHigh": number,
  "priceTypical": number,
  "currency": "USD",
  "pricingNotes": "1-2 sentences on what drives the value and how confident the estimate is",
  "comps": [ { "title": "what sold", "price": number, "source": "where, e.g. eBay sold" } ]
}`;

    const response = await createWithResume({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const jsonStr = firstJsonObject(text);
    if (!jsonStr) {
      return res
        .status(502)
        .json({ error: "Could not parse the listing. Try again." });
    }
    const data = JSON.parse(jsonStr);
    data.ebay = ebay;
    res.json(data);
  } catch (err) {
    console.error("listing error:", err.message);
    res.status(500).json({ error: err.message || "Listing generation failed." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Funko Lister running at http://localhost:${PORT}\n`);
});
