# Funko Lister

A small local web app that turns a pile of photos into a ready-to-post listing.

Drop in the 7–10 photos you took of a Funko Pop, and it will:

1. **Identify the figure** from the photos using Claude's vision — character, line,
   collector number, and (the tricky part) the **specific variant**: glow-in-the-dark,
   metallic, flocked, Chase, retailer exclusives, etc. When two look-alike variants are
   easy to confuse, it tells you how to tell them apart so you can confirm the right one.
2. **Let you confirm or correct** the identification and enter the condition.
3. **Write a polished listing** (title + description) and **find the market value** by
   searching recent sold prices, plus direct **eBay sold-listings links** so you can
   verify the real numbers yourself.

Everything runs on your own machine. Your Anthropic API key stays on the local server
and is never exposed to the browser.

## Setup

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
# 1. Install dependencies
npm install

# 2. Add your Anthropic API key
cp .env.example .env
# then open .env and paste your key (from https://console.anthropic.com)

# 3. Start it
npm start
```

Then open **http://localhost:3000** in your browser.

## How to use it

1. Drag your photos of **one figure** onto the drop zone (front, back, the box number,
   any stickers, and the figure itself all help accuracy).
2. Click **Identify this Funko**.
3. Check the result. If it flags look-alike variants, use your close-up photos to pick
   the right one, then fix any field that's off.
4. Set the condition, then click **Write listing & find value**.
5. Copy the title and description, glance at the suggested price, and click the
   **eBay sold listings** link to confirm the going rate before you post.

## Notes

- The price is an estimate based on recent sold comps the model finds. Funko values move
  fast and vary by variant/exclusive — always sanity-check against the eBay sold link.
- Photos are downscaled in your browser before upload, so large phone photos are fine.
- Powered by Claude (`claude-opus-4-8`) for vision, listing copy, and web-search pricing.
```
