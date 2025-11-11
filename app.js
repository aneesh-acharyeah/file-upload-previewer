// ===== Config =====
const MAX_FILES = 20;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/", "video/", "application/pdf"];

// ===== State =====
const state = {
  files: /** @type {File[]} */ ([]),
  objectUrls: new Map(), // File -> objectURL
};

// ===== Elements =====
const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const browseBtn = document.getElementById("browseBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const mockUploadBtn = document.getElementById("mockUploadBtn");
const previewGrid = document.getElementById("previewGrid");
const messages = document.getElementById("messages");
const fileCount = document.getElementById("fileCount");

// ===== Utilities =====
const fmtBytes = (b) => {
  if (b === 0) return "0 B";
  const k = 1024, sizes = ["B","KB","MB","GB"];
  const i = Math.floor(Math.log(b)/Math.log(k));
  return `${(b/Math.pow(k,i)).toFixed(i===0?0:1)} ${sizes[i]}`;
};

function pushMsg(text, type="ok"){
  const li = document.createElement("li");
  li.className = type === "error" ? "error" : "ok";
  li.textContent = text;
  messages.prepend(li);
}

function isAllowed(file){
  return ALLOWED.some(prefix => file.type.startsWith(prefix));
}

function revokeUrl(file){
  const url = state.objectUrls.get(file);
  if (url) {
    URL.revokeObjectURL(url);
    state.objectUrls.delete(file);
  }
}

function setButtons(){
  const hasFiles = state.files.length > 0;
  clearAllBtn.disabled = !hasFiles;
  mockUploadBtn.disabled = !hasFiles;
  fileCount.textContent = String(state.files.length);
}

// ===== Rendering =====
function renderPreviews(){
  previewGrid.innerHTML = "";
  state.files.forEach((file, idx) => {
    const card = document.createElement("div");
    card.className = "card";

    const preview = document.createElement("div");
    preview.className = "preview";

    // create or reuse objectURL
    let url = state.objectUrls.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      state.objectUrls.set(file, url);
    }

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = file.type.split("/")[0].toUpperCase();
    preview.appendChild(badge);

    if (file.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.alt = file.name;
      img.loading = "lazy";
      img.src = url;
      preview.appendChild(img);
    } else if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.src = url;
      video.controls = true;
      preview.appendChild(video);
    } else {
      // PDF or other allowed
      const pdfIcon = document.createElementNS("http://www.w3.org/2000/svg","svg");
      pdfIcon.setAttribute("viewBox","0 0 24 24");
      pdfIcon.setAttribute("width","48");
      pdfIcon.setAttribute("height","48");
      pdfIcon.innerHTML = `<path d="M14 2H6a2 2 0 0 0-2 2v16
      a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M14 2v6h6" fill="none" stroke="currentColor" stroke-width="2"/>`;
      pdfIcon.style.opacity = .8;
      preview.appendChild(pdfIcon);
    }

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `
      <div class="name" title="${file.name}">${file.name}</div>
      <div class="row">
        <span class="pill">${fmtBytes(file.size)}</span>
        <div class="actions">
          <button class="iconbtn" title="Move up" ${idx===0?"disabled":""} data-act="up" data-idx="${idx}">↑</button>
          <button class="iconbtn" title="Move down" ${idx===state.files.length-1?"disabled":""} data-act="down" data-idx="${idx}">↓</button>
          <button class="iconbtn danger" title="Remove" data-act="remove" data-idx="${idx}">✕</button>
        </div>
      </div>
    `;

    card.appendChild(preview);
    card.appendChild(meta);
    previewGrid.appendChild(card);
  });
  setButtons();
}

// ===== Core logic =====
function addFiles(list){
  const arr = Array.from(list);
  if (arr.length === 0) return;

  const startCount = state.files.length;

  for (const file of arr) {
    if (state.files.length >= MAX_FILES) {
      pushMsg(`Limit reached (${MAX_FILES}). Skipping "${file.name}".`, "error");
      continue;
    }
    if (!isAllowed(file)) {
      pushMsg(`Unsupported type: ${file.type || "unknown"} for "${file.name}".`, "error");
      continue;
    }
    if (file.size > MAX_BYTES) {
      pushMsg(`"${file.name}" is too large (${fmtBytes(file.size)}). Max ${fmtBytes(MAX_BYTES)}.`, "error");
      continue;
    }
    state.files.push(file);
  }

  if (state.files.length > startCount) {
    pushMsg(`Added ${state.files.length - startCount} file(s).`, "ok");
  }
  renderPreviews();
}

function removeAt(idx){
  const [file] = state.files.splice(idx,1);
  revokeUrl(file);
  renderPreviews();
}

function move(idx, dir){
  const target = idx + dir;
  if (target < 0 || target >= state.files.length) return;
  const tmp = state.files[idx];
  state.files[idx] = state.files[target];
  state.files[target] = tmp;
  renderPreviews();
}

function clearAll(){
  state.files.forEach(revokeUrl);
  state.files = [];
  renderPreviews();
  pushMsg("Cleared all files.", "ok");
}

// ===== Events =====
browseBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => addFiles(e.target.files));

["dragenter","dragover"].forEach(evt =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation();
    dropzone.classList.add("dragover");
  })
);
["dragleave","drop"].forEach(evt =>
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault(); e.stopPropagation();
    if (evt === "drop") addFiles(e.dataTransfer.files);
    dropzone.classList.remove("dragover");
  })
);

// Keyboard support: Enter triggers browse
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

// Clipboard paste support for images
window.addEventListener("paste", (e) => {
  if (!e.clipboardData) return;
  const items = Array.from(e.clipboardData.files || []);
  if (items.length) addFiles(items);
});

// Preview actions (event delegation)
previewGrid.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  const act = btn.dataset.act;
  if (act === "remove") removeAt(idx);
  if (act === "up") move(idx, -1);
  if (act === "down") move(idx, +1);
});

clearAllBtn.addEventListener("click", clearAll);

// Mock upload (example: show payload you would send to server)
mockUploadBtn.addEventListener("click", async () => {
  if (!state.files.length) return;
  // Build FormData
  const fd = new FormData();
  state.files.forEach((f, i) => fd.append("files[]", f, f.name));

  // Simulate delay & success
  pushMsg("Uploading…", "ok");
  await new Promise(r => setTimeout(r, 800));
  pushMsg(`Uploaded ${state.files.length} file(s). (mock)`, "ok");

  // Example: To send to backend
  // fetch('/upload', { method: 'POST', body: fd });
});

// Initialize
renderPreviews();
