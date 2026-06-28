# Funko Lister — Setup for Windows (no coding needed)

This walks you through everything from zero. You do most steps **once**; after that
you just double-click one file whenever you want to use the app.

There are four parts:
**A.** Get the app onto your PC · **B.** Install Node.js · **C.** Get your key · **D.** Run it.

---

## A. Download the app onto your computer

1. Open this link in your browser:
   `https://github.com/alanhu780-gif/funko/tree/claude/funko-pop-listing-workflow-w51ixf`
2. Click the green **`<> Code`** button, then **Download ZIP**.
3. Find the downloaded ZIP (usually in your **Downloads** folder).
4. **Right-click it → Extract All… → Extract.** Pick an easy spot like **Documents**.
5. Open the extracted folder. You should see files including **`Start Funko Lister.bat`**.

---

## B. Install Node.js (the free engine that runs the app) — once

1. Go to **https://nodejs.org**
2. Click the big green **LTS** button to download the installer.
3. Open the downloaded file and click **Next / I Agree / Install** until it finishes.
   (The default options are fine — don't change anything.)
4. **Restart your computer.**

---

## C. Get your Anthropic API key — once

The key is what lets the app use Claude to identify figures and find prices. It's
pay-as-you-go and costs a small amount per figure (often a few cents to ~20 cents each).

1. Go to **https://console.anthropic.com** and sign up or log in.
2. Click **Billing** (left side) and add a payment method / buy credits.
   **Loading $5 to start is plenty** to try it out.
3. Click **API Keys** → **Create Key**. Give it any name and click create.
4. **Copy the key now and keep it handy** — it starts with `sk-ant-` and is only shown once.
   (If you lose it, just create another.)

---

## D. Run the app

1. In the app folder, **double-click `Start Funko Lister.bat`**.
   - If a blue box says *"Windows protected your PC"*, click **More info → Run anyway**.
     (This is just because the file came from the internet — it's the launcher above.)
2. A black window opens. The first time, it will:
   - install the app (takes a few minutes — let it finish), then
   - ask you to **paste your API key**. Right-click in the black window to paste, then
     press **Enter**.
3. Your web browser opens to **http://localhost:3000** — that's the app.
   - If you see an error for a few seconds, wait and **refresh** the page; the app is
     still starting.
4. **Leave the black window open** while you use the app. To stop later, just close it.

**Every time after this:** double-click `Start Funko Lister.bat` and the app opens. No
key needed again.

---

## Using the app

1. **Drag your photos** of ONE figure onto the drop box (front, back, the box number,
   any stickers, and the loose figure all help it be accurate).
2. Click **Identify this Funko**.
3. Check what it found. If it warns that the figure could be a look-alike variant, use
   your close-up photos to pick the right one, and fix any field that's wrong.
4. Choose the **condition**, then click **Write listing & find value**.
5. You'll get two tabs — **eBay** and **Facebook** — with ready-to-use titles and
   descriptions, plus a suggested price. Set **your asking price**.
6. Click **Save to batch & do next**, and repeat for your next figure.
7. When you've done a batch, scroll to the **Batch** section and click:
   - **Download eBay File Exchange CSV** — upload it in eBay Seller Hub
     (Reports → File Exchange → Upload).
   - **Download Facebook spreadsheet (CSV)** — open it and copy/paste each row while
     creating your Marketplace listings.

> **Photos in the CSVs:** a spreadsheet can't hold image files. After uploading the CSV,
> add the photos in eBay's / Facebook's normal uploader. (If your photos happen to be
> hosted online with web links, paste those links into the **Image URLs** box before
> saving and eBay will pull them in automatically.)

---

## If something goes wrong

- **The black window flashes and disappears** → Node.js isn't installed yet. Do **Part B**.
- **"npm is not recognized"** → restart your computer after installing Node, then try again.
- **The app page won't load** → make sure the black window is still open, then refresh
  http://localhost:3000.
- **It says the key is invalid / billing error** → check you added credits in the
  Anthropic Console (Part C, step 2). To change the key, delete the file named **`.env`**
  in the app folder and run the launcher again to re-enter it.
