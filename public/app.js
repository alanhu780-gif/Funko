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

function fillResult(d) {
  const cur = d.currency || "USD";
  $("r-title").textContent = d.title || "";
  $("r-description").textContent = d.description || "";
  const typ = money(d.priceTypical, cur);
  const range =
    d.priceLow != null && d.priceHigh != null
      ? ` (${money(d.priceLow, cur)}–${money(d.priceHigh, cur)})`
      : "";
  $("r-price").textContent = typ + range;
  $("r-pricingNotes").textContent = d.pricingNotes || "";

  const comps = d.comps || [];
  $("comps").innerHTML = comps.length
    ? "<h3>Recent comparable sales</h3>" +
      comps
        .map(
          (c) =>
            `<div class="comp"><span>${esc(c.title)} <em class="muted">${esc(c.source || "")}</em></span><span>${money(c.price, cur)}</span></div>`
        )
        .join("")
    : "";

  if (d.ebay) {
    $("ebaySold").href = d.ebay.sold;
    $("ebayActive").href = d.ebay.active;
  }
}

// ---- copy + restart --------------------------------------------------------

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

$("restartBtn").onclick = () => {
  images = [];
  lastItem = null;
  renderThumbs();
  $("c-notes").value = "";
  $("step-confirm").classList.add("hidden");
  $("step-result").classList.add("hidden");
  clearError();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}
