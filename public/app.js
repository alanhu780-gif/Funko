// Frontend: collect photos, resize them, identify, confirm, generate listing.

const MAX_EDGE = 1600; // downscale long edge before upload — keeps requests fast
const JPEG_QUALITY = 0.85;

let images = []; // { id, media_type, data(base64), preview(dataURL) }
let lastItem = null;

const $ = (id) => document.getElementById(id);

// ---- photo intake ----------------------------------------------------------

const dropzone = $("dropzone");
const fileInput = $("fileInput");

["dragenter", "dragover"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag");
  })
);
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag");
  })
);
dropzone.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));
fileInput.addEventListener("change", () => addFiles(fileInput.files));

async function addFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith("image/"));
  for (const file of files) {
    try {
      const img = await resizeImage(file);
      images.push(img);
    } catch (e) {
      console.error("could not read", file.name, e);
    }
  }
  renderThumbs();
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => {
        let { width, height } = im;
        const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(im, 0, 0, width, height);
        const dataURL = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        resolve({
          id: crypto.randomUUID(),
          media_type: "image/jpeg",
          data: dataURL.split(",")[1],
          preview: dataURL,
        });
      };
      im.onerror = reject;
      im.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderThumbs() {
  const wrap = $("thumbs");
  wrap.innerHTML = "";
  images.forEach((img) => {
    const div = document.createElement("div");
    div.className = "thumb";
    div.innerHTML = `<img src="${img.preview}" /><button title="remove">&times;</button>`;
    div.querySelector("button").onclick = () => {
      images = images.filter((i) => i.id !== img.id);
      renderThumbs();
    };
    wrap.appendChild(div);
  });
  $("identifyBtn").disabled = images.length === 0;
}

// ---- API plumbing ----------------------------------------------------------

function showSpinner(msg) {
  $("spinnerMsg").textContent = msg;
  $("spinner").classList.remove("hidden");
}
function hideSpinner() {
  $("spinner").classList.add("hidden");
}
function showError(msg) {
  const el = $("error");
  el.textContent = msg;
  el.classList.remove("hidden");
}
function clearError() {
  $("error").classList.add("hidden");
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ---- step 1 -> 2: identify -------------------------------------------------

$("identifyBtn").onclick = async () => {
  clearError();
  showSpinner("Identifying the figure and checking for look-alike variants…");
  try {
    const data = await postJSON("/api/identify", {
      images: images.map(({ media_type, data }) => ({ media_type, data })),
    });
    fillConfirm(data);
    $("step-confirm").classList.remove("hidden");
    $("step-confirm").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    showError(e.message);
  } finally {
    hideSpinner();
  }
};

function fillConfirm(d) {
  const badge = $("confidence");
  badge.className = "badge " + (d.confidence || "medium");
  badge.textContent = (d.confidence || "medium").toUpperCase() + " CONFIDENCE";
  $("identifyingDetails").textContent = d.identifyingDetails || "";

  $("f-character").value = d.character || "";
  $("f-line").value = d.line || "";
  $("f-itemNumber").value = d.itemNumber || "";
  $("f-variant").value = d.variant || "Standard";
  $("f-exclusivity").value = d.exclusivity || "Common";
  $("f-estimatedYear").value = d.estimatedYear || "";
  $("f-isChase").checked = !!d.isChase;

  if (d.boxConditionNotes) $("c-notes").value = d.boxConditionNotes;

  const alts = d.possibleAlternatives || [];
  const altBox = $("alternatives");
  if (alts.length) {
    $("altList").innerHTML = alts
      .map((a) => `<li><b>${esc(a.variant)}</b> — ${esc(a.howToDistinguish)}</li>`)
      .join("");
    altBox.classList.remove("hidden");
  } else {
    altBox.classList.add("hidden");
  }
}

// ---- step 2 -> 3: generate listing -----------------------------------------

$("generateBtn").onclick = async () => {
  clearError();
  lastItem = {
    character: $("f-character").value,
    line: $("f-line").value,
    itemNumber: $("f-itemNumber").value,
    variant: $("f-variant").value,
    isChase: $("f-isChase").checked,
    exclusivity: $("f-exclusivity").value,
    estimatedYear: $("f-estimatedYear").value,
  };
  const condition = {
    boxIncluded: $("c-boxIncluded").checked,
    boxCondition: $("c-boxCondition").value,
    figureCondition: $("c-figureCondition").value,
    notes: $("c-notes").value,
  };
  showSpinner("Writing the listing and searching recent sold prices…");
  try {
    const data = await postJSON("/api/generate-listing", { item: lastItem, condition });
    fillResult(data);
    $("step-result").classList.remove("hidden");
    $("step-result").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    showError(e.message);
  } finally {
    hideSpinner();
  }
};

function money(n, cur) {
  if (typeof n !== "number" || isNaN(n)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: cur || "USD" }).format(n);
}

let lastResult = null;

function fillResult(d) {
  lastResult = d;
  const p = d.pricing || {};
  const cur = p.currency || "USD";

  const typ = money(p.priceTypical, cur);
  const range =
    p.priceLow != null && p.priceHigh != null
      ? ` (${money(p.priceLow, cur)}–${money(p.priceHigh, cur)})`
      : "";
  $("r-price").textContent = typ + range;
  $("r-pricingNotes").textContent = p.pricingNotes || "";
  $("r-askPrice").value =
    p.priceTypical != null ? Number(p.priceTypical).toFixed(2) : "";
  $("r-imageUrls").value = "";

  const comps = p.comps || [];
  $("comps").innerHTML = comps.length
    ? "<h3>Recent comparable sales</h3>" +
      comps
        .map(
          (c) =>
            `<div class="comp"><span>${esc(c.title)} <em class="muted">${esc(c.source || "")}</em></span><span>${money(c.price, cur)}</span></div>`
        )
        .join("")
    : "";

  // eBay panel
  const e = d.ebay || {};
  $("eb-title").textContent = e.title || "";
  $("eb-title-len").textContent = `(${(e.title || "").length}/80)`;
  $("eb-description").textContent = e.description || "";
  const spec = e.itemSpecifics || {};
  $("eb-specifics").innerHTML =
    `<div class="row"><span>Condition</span><span>${esc(e.conditionText)} (${esc(e.conditionId)})</span></div>` +
    Object.entries(spec)
      .map(([k, v]) => `<div class="row"><span>${esc(k)}</span><span>${esc(v) || "—"}</span></div>`)
      .join("");

  // Facebook panel
  const f = d.facebook || {};
  $("fb-title").textContent = f.title || "";
  $("fb-description").textContent = f.description || "";
  $("fb-meta").innerHTML =
    `<div class="row"><span>Category</span><span>${esc(f.category)}</span></div>` +
    `<div class="row"><span>Condition</span><span>${esc(f.condition)}</span></div>`;

  const links = d.ebayLinks || {};
  $("ebaySold").href = links.sold || "#";
  $("ebayActive").href = links.active || "#";

  setTab("ebay");
}

// ---- tabs ------------------------------------------------------------------

function setTab(name) {
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.tab === name)
  );
  $("panel-ebay").classList.toggle("hidden", name !== "ebay");
  $("panel-facebook").classList.toggle("hidden", name !== "facebook");
}
document.querySelectorAll(".tab").forEach((t) => {
  t.onclick = () => setTab(t.dataset.tab);
});

// ---- copy ------------------------------------------------------------------

document.querySelectorAll(".copy").forEach((btn) => {
  btn.onclick = async () => {
    const text = $(btn.dataset.copy).textContent;
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = "Copied!";
    btn.classList.add("done");
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("done");
    }, 1200);
  };
});

// ---- batch -----------------------------------------------------------------

let batch = JSON.parse(localStorage.getItem("funkoBatch") || "[]");

function saveBatch() {
  localStorage.setItem("funkoBatch", JSON.stringify(batch));
  renderBatch();
}

function imageUrlList(raw) {
  return (raw || "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

$("saveBatchBtn").onclick = () => {
  if (!lastResult) return;
  const e = lastResult.ebay || {};
  const f = lastResult.facebook || {};
  const spec = e.itemSpecifics || {};
  const price = parseFloat($("r-askPrice").value) || lastResult.pricing?.priceTypical || 0;
  batch.push({
    id: crypto.randomUUID(),
    sku: spec.Character
      ? `${(spec.Character || "FUNKO").replace(/\s+/g, "-")}-${lastItem?.itemNumber || ""}`.toUpperCase()
      : "FUNKO",
    price,
    currency: lastResult.pricing?.currency || "USD",
    imageUrls: imageUrlList($("r-imageUrls").value),
    ebayTitle: e.title || "",
    ebayDescription: e.description || "",
    ebayConditionId: e.conditionId || 3000,
    specifics: spec,
    fbTitle: f.title || "",
    fbDescription: f.description || "",
    fbCondition: f.condition || "Used - Good",
    fbCategory: f.category || "Toys & Games",
  });
  saveBatch();
  startAnother();
};

function renderBatch() {
  const sec = $("batch");
  if (batch.length === 0) {
    sec.classList.add("hidden");
    return;
  }
  sec.classList.remove("hidden");
  $("batchCount").textContent = batch.length;
  $("batchList").innerHTML = batch
    .map(
      (b) =>
        `<li><span>${esc(b.ebayTitle || b.fbTitle || "Untitled")}</span>` +
        `<span><span class="bi-price">${money(b.price, b.currency)}</span> ` +
        `<button data-id="${b.id}" title="remove">&times;</button></span></li>`
    )
    .join("");
  $("batchList")
    .querySelectorAll("button[data-id]")
    .forEach((btn) => {
      btn.onclick = () => {
        batch = batch.filter((b) => b.id !== btn.dataset.id);
        saveBatch();
      };
    });
}

$("clearBatch").onclick = () => {
  if (confirm("Clear all saved items from the batch?")) {
    batch = [];
    saveBatch();
  }
};

// ---- CSV export ------------------------------------------------------------

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csvRows(rows) {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}
function download(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function settings() {
  return {
    category: $("set-category").value.trim() || "149372",
    location: $("set-location").value.trim() || "",
  };
}

$("dlEbay").onclick = () => {
  if (batch.length === 0) return;
  const s = settings();
  // eBay File Exchange "Add" template. First header cell carries the action metadata.
  const header = [
    "Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)",
    "CustomLabel",
    "Category",
    "Title",
    "ConditionID",
    "C:Brand",
    "C:Type",
    "C:Character",
    "C:Franchise",
    "C:Features",
    "C:Release Year",
    "PicURL",
    "Description",
    "Format",
    "Duration",
    "StartPrice",
    "Quantity",
    "Location",
  ];
  const rows = [header];
  batch.forEach((b) => {
    const sp = b.specifics || {};
    rows.push([
      "Add",
      b.sku,
      s.category,
      b.ebayTitle,
      b.ebayConditionId,
      sp.Brand || "Funko",
      sp.Type || "Pop! Vinyl",
      sp.Character || "",
      sp.Franchise || "",
      sp.Features || "",
      sp.ReleaseYear || "",
      (b.imageUrls || []).join("|"),
      b.ebayDescription,
      "FixedPrice",
      "GTC",
      Number(b.price).toFixed(2),
      "1",
      s.location,
    ]);
  });
  download(`ebay-listings-${stamp()}.csv`, csvRows(rows));
};

$("dlFacebook").onclick = () => {
  if (batch.length === 0) return;
  const header = ["Title", "Price", "Category", "Condition", "Description", "Photos", "Notes"];
  const rows = [header];
  batch.forEach((b) => {
    rows.push([
      b.fbTitle,
      Number(b.price).toFixed(2),
      b.fbCategory,
      b.fbCondition,
      b.fbDescription,
      (b.imageUrls || []).length ? b.imageUrls.join(" | ") : "Attach manually",
      "",
    ]);
  });
  download(`facebook-marketplace-${stamp()}.csv`, csvRows(rows));
};

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

// ---- restart / nav ---------------------------------------------------------

function startAnother() {
  images = [];
  lastItem = null;
  lastResult = null;
  renderThumbs();
  $("c-notes").value = "";
  $("step-confirm").classList.add("hidden");
  $("step-result").classList.add("hidden");
  clearError();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$("restartBtn").onclick = startAnother;

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

// restore eBay export settings + any saved batch on load
(function init() {
  const saved = JSON.parse(localStorage.getItem("funkoSettings") || "{}");
  if (saved.category) $("set-category").value = saved.category;
  if (saved.location) $("set-location").value = saved.location;
  ["set-category", "set-location"].forEach((id) =>
    $(id).addEventListener("change", () =>
      localStorage.setItem(
        "funkoSettings",
        JSON.stringify({ category: $("set-category").value, location: $("set-location").value })
      )
    )
  );
  renderBatch();
})();
