# Funko Lister

A small local web app that turns a pile of photos into a ready-to-post listing.

Drop in the 7–10 photos you took of a Funko Pop, and it will:

1. **Identify the figure** from the photos using Claude's vision — character, line,
   collector number, and (the tricky part) the **specific variant**: glow-in-the-dark,
   metallic, flocked, Chase, retailer exclusives, etc. When two look-alike variants are
   easy to confuse, it tells you how to tell them apart so you can confirm the right one.
2. **Let you confirm or correct** the identification and enter the condition.
3. **Write two platform-tailored listings** — a keyword-rich **eBay** version and a
   casual **Facebook Marketplace** version — and **find the market value** by searching
   recent sold prices, with eBay sold-listings links to verify.
4. **Batch & bulk-export.** Save each finished item to a batch, then download:
   - an **eBay File Exchange CSV** you can bulk-upload via Seller Hub, and
   - a **Facebook Marketplace spreadsheet** (CSV) to paste from quickly while listing.

Everything runs on your own machine. Your Anthropic API key stays on the local server
and is never exposed to the browser.

> **New to this / no coding experience?** Follow **[SETUP-WINDOWS.md](SETUP-WINDOWS.md)** —
> a plain-English, click-by-click guide. On Windows you can just double-click
> **`Start Funko Lister.bat`**, which installs everything and asks for your key once.

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
5. Review the two tabs — **eBay** and **Facebook** — set your asking price, then click
   **Save to batch & do next**. Repeat for your whole pile.
6. In the **Batch** panel, download the two CSVs and bulk-upload them.

## Bulk upload

- **eBay:** the downloaded file is an eBay **File Exchange** "Add" CSV. Go to Seller Hub →
  **Reports → File Exchange → Upload**. Set your category ID and item location once in
  **eBay export settings** (the default `149372` is eBay's "Pop! Vinyl" — confirm it
  matches your account).
- **Facebook Marketplace:** personal Marketplace has no CSV importer, so the Facebook
  download is a tidy spreadsheet (Title, Price, Category, Condition, Description, Photos)
  to paste from row-by-row while creating listings — much faster than composing each one.
- **Photos:** a CSV can't carry image files. If your photos are hosted online, paste their
  URLs into the **Image URLs** box before saving and they'll fill the eBay `PicURL` column;
  otherwise attach photos in each platform's uploader after importing the text.

Your batch and export settings are saved in the browser, so you can close the tab and
come back to finish later.

## Notes

- The price is an estimate based on recent sold comps the model finds. Funko values move
  fast and vary by variant/exclusive — always sanity-check against the eBay sold link.
- Photos are downscaled in your browser before upload, so large phone photos are fine.
- Powered by Claude (`claude-opus-4-8`) for vision, listing copy, and web-search pricing.
```
