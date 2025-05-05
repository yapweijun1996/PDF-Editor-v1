// script.js

// PDF.js worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const { PDFDocument, StandardFonts, rgb } = PDFLib;

// State variables
let pdfDoc = null;           // pdf-lib document
let pdfBytes = null;         // Uint8Array of current PDF
let pdfjsDoc = null;         // PDF.js document
let history = [];            // history stack (Uint8Array snapshots)
let redoStack = [];          // redo stack
let currentPage = 1;
let totalPages = 0;
let zoomLevel = 1;
let currentViewport = null;  // PDF.js viewport for current page
const overlayContainer = document.getElementById('overlayContainer');
let annotations = []; // annotation list
let selectedAnno = null;
let dragOffset = { x: 0, y: 0 };

// Map fontSelect value to CSS font-family
const fontMap = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  TimesRoman: 'Times New Roman, Times, serif',
  Courier: 'Courier New, Courier, monospace',
};

// DOM elements
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const fileNameEl = document.getElementById('fileName');
const canvas = document.getElementById('pdfCanvas');
const ctx = canvas.getContext('2d');
const firstPageBtn = document.getElementById('firstPageBtn');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const lastPageBtn = document.getElementById('lastPageBtn');
const pageNumberInput = document.getElementById('pageNumberInput');
const totalPagesEl = document.getElementById('totalPages');
const zoomSelect = document.getElementById('zoomSelect');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const downloadBtn = document.getElementById('downloadBtn');
const textInput = document.getElementById('textInput');
const fontSelect = document.getElementById('fontSelect');
const sizeInput = document.getElementById('sizeInput');
const colorInput = document.getElementById('colorInput');
const alignSelect = document.getElementById('alignSelect');

// Update undo/redo button states
function updateUndoRedoButtons() {
  undoBtn.disabled = history.length < 2;
  redoBtn.disabled = redoStack.length === 0;
}

// Save current PDF state to history
async function pushHistory() {
  const bytes = await pdfDoc.save();
  pdfBytes = bytes;
  history.push(bytes);
  redoStack = [];
  updateUndoRedoButtons();
}

// Load a new PDF from ArrayBuffer
async function loadArrayBuffer(buffer, file) {
  // Load into pdf-lib
  pdfDoc = await PDFDocument.load(buffer);
  pdfBytes = new Uint8Array(buffer);

  // Load into PDF.js
  pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  totalPages = pdfjsDoc.numPages;
  currentPage = 1;
  zoomLevel = parseFloat(zoomSelect.value) || 1;

  // UI updates
  fileNameEl.textContent = file.name;
  pageNumberInput.min = 1;
  pageNumberInput.max = totalPages;
  totalPagesEl.textContent = totalPages;
  pageNumberInput.value = currentPage;

  // Initialize history
  history = [];
  redoStack = [];
  await pushHistory();

  // Render
  await renderPage();
}

// Render current page on canvas
async function renderPage() {
  if (!pdfjsDoc) return;
  const page = await pdfjsDoc.getPage(currentPage);
  const viewport = page.getViewport({ scale: zoomLevel });
  currentViewport = viewport;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const renderContext = { canvasContext: ctx, viewport };
  await page.render(renderContext).promise;
  pageNumberInput.value = currentPage;
  // Render overlay annotations
  renderAnnotations();
}

// Render annotations for current page
function renderAnnotations() {
  overlayContainer.innerHTML = '';
  overlayContainer.style.width = canvas.width + 'px';
  overlayContainer.style.height = canvas.height + 'px';
  annotations
    .filter(a => a.page === currentPage)
    .forEach(a => {
      const el = document.createElement('div');
      el.className = 'annotation';
      el.dataset.id = a.id;
      el.innerText = a.text;
      // Style
      el.style.position = 'absolute';
      const left = a.x * zoomLevel;
      const top = (currentViewport.height - a.y) * zoomLevel;
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.fontFamily = fontMap[a.fontName] || fontMap.Helvetica;
      el.style.fontSize = `${a.size}pt`;
      el.style.color = a.color;
      el.style.cursor = 'move';
      el.style.pointerEvents = 'auto';
      // Drag events
      el.addEventListener('mousedown', annotationMouseDown);
      overlayContainer.appendChild(el);
    });
}

// Handle file input change
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const buffer = await file.arrayBuffer();
  await loadArrayBuffer(buffer, file);
});

// Drag & drop handling
['dragenter','dragover','dragleave','drop'].forEach(evt => {
  dropZone.addEventListener(evt, e => {
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.toggle('drop-zone--active', evt==='dragenter'||evt==='dragover');
  });
});

dropZone.addEventListener('drop', async (e) => {
  const file = e.dataTransfer.files[0];
  if (file && file.type==='application/pdf') {
    const buffer = await file.arrayBuffer();
    await loadArrayBuffer(buffer, file);
  }
});

// Navigation buttons
firstPageBtn.addEventListener('click', async () => { currentPage=1; await renderPage(); });
prevPageBtn.addEventListener('click', async () => { currentPage--; if(currentPage<1) currentPage=1; await renderPage(); });
nextPageBtn.addEventListener('click', async () => { currentPage++; if(currentPage>totalPages) currentPage=totalPages; await renderPage(); });
lastPageBtn.addEventListener('click', async () => { currentPage=totalPages; await renderPage(); });
pageNumberInput.addEventListener('change', async () => { let v=parseInt(pageNumberInput.value)||1; currentPage=Math.min(Math.max(v,1),totalPages); await renderPage(); });

// Zoom controls
zoomSelect.addEventListener('change', async () => { zoomLevel=parseFloat(zoomSelect.value)||1; await renderPage(); });
zoomInBtn.addEventListener('click', async () => { zoomLevel*=1.25; zoomSelect.value=zoomLevel; await renderPage(); });
zoomOutBtn.addEventListener('click', async () => { zoomLevel/=1.25; zoomSelect.value=zoomLevel; await renderPage(); });

// Rotate current page
rotateLeftBtn.addEventListener('click', async () => { await rotatePage(-90); });
rotateRightBtn.addEventListener('click', async () => { await rotatePage(90); });
async function rotatePage(angle) {
  if (!pdfDoc) return;
  const page = pdfDoc.getPages()[currentPage-1];
  const curr = page.getRotation().angle || 0;
  page.setRotation({ type: 'degrees', angle: curr+angle });
  await pushHistory();
  pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  await renderPage();
}

// Click-to-place text
canvas.addEventListener('click', async (e) => {
  if (!pdfDoc) return alert('Load a PDF first.');
  const text = textInput.value.trim();
  if (!text) return alert('Enter text to add.');
  // styling
  const fontName = fontSelect.value;
  const size = parseFloat(sizeInput.value);
  if (isNaN(size) || size <= 0) return alert('Invalid font size');
  const hex = colorInput.value;
  const color = hex;
  // coords
  const rect = canvas.getBoundingClientRect();
  const xPx = e.clientX - rect.left;
  const yPx = e.clientY - rect.top;
  const x = xPx / zoomLevel;
  const y = (currentViewport.height - yPx) / zoomLevel;
  // create annotation object
  const anno = {
    id: Date.now() + '_' + Math.random(),
    page: currentPage,
    text,
    fontName,
    size,
    color,
    align: alignSelect.value,
    x,
    y,
  };
  annotations.push(anno);
  // update coord inputs
  document.getElementById('xCoordInput').value = x.toFixed(2);
  document.getElementById('yCoordInput').value = y.toFixed(2);
  // render overlay
  renderAnnotations();
});

// Drag handlers
function annotationMouseDown(e) {
  const id = e.currentTarget.dataset.id;
  selectedAnno = annotations.find(a => a.id === id);
  dragOffset.x = e.clientX - e.currentTarget.offsetLeft;
  dragOffset.y = e.clientY - e.currentTarget.offsetTop;
  e.currentTarget.classList.add('selected');
  document.addEventListener('mousemove', annotationMouseMove);
  document.addEventListener('mouseup', annotationMouseUp);
}
function annotationMouseMove(e) {
  if (!selectedAnno) return;
  const el = overlayContainer.querySelector(`[data-id="${selectedAnno.id}"]`);
  let left = e.clientX - dragOffset.x;
  let top = e.clientY - dragOffset.y;
  // clamp bounds
  left = Math.max(0, Math.min(left, canvas.width - el.offsetWidth));
  top = Math.max(0, Math.min(top, canvas.height - el.offsetHeight));
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  // update PDF coords
  const x = left / zoomLevel;
  const y = (currentViewport.height - top / zoomLevel);
  selectedAnno.x = x;
  selectedAnno.y = y;
  document.getElementById('xCoordInput').value = x.toFixed(2);
  document.getElementById('yCoordInput').value = y.toFixed(2);
}
function annotationMouseUp(e) {
  const el = overlayContainer.querySelector(`[data-id="${selectedAnno.id}"]`);
  el.classList.remove('selected');
  selectedAnno = null;
  document.removeEventListener('mousemove', annotationMouseMove);
  document.removeEventListener('mouseup', annotationMouseUp);
}

// Undo
undoBtn.addEventListener('click', async () => {
  if (history.length<2) return;
  const last = history.pop();
  redoStack.push(last);
  const prev = history[history.length-1];
  pdfDoc = await PDFDocument.load(prev);
  pdfBytes = prev;
  pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  totalPages = pdfjsDoc.numPages;
  currentPage = Math.min(currentPage,totalPages);
  updateUndoRedoButtons();
  await renderPage();
});

// Redo
redoBtn.addEventListener('click', async () => {
  if (!redoStack.length) return;
  const next = redoStack.pop();
  history.push(next);
  pdfDoc = await PDFDocument.load(next);
  pdfBytes = next;
  pdfjsDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  totalPages = pdfjsDoc.numPages;
  currentPage = Math.min(currentPage,totalPages);
  updateUndoRedoButtons();
  await renderPage();
});

// Save PDF including annotations
downloadBtn.addEventListener('click', async () => {
  if (!pdfBytes) return alert('Load a PDF first.');
  const saveDoc = await PDFDocument.load(pdfBytes);
  for (const a of annotations) {
    const page = saveDoc.getPages()[a.page - 1];
    let fontConst = StandardFonts.Helvetica;
    if (a.fontName === 'TimesRoman') fontConst = StandardFonts.TimesRoman;
    if (a.fontName === 'Courier') fontConst = StandardFonts.Courier;
    const pdfFont = await saveDoc.embedFont(fontConst);
    // parse color
    const hex = a.color;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    page.drawText(a.text, {
      x: a.x,
      y: a.y,
      size: a.size,
      font: pdfFont,
      color: rgb(r, g, b),
    });
  }
  const bytes = await saveDoc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const aLink = document.createElement('a');
  aLink.href = url;
  aLink.download = 'edited.pdf';
  aLink.click();
  URL.revokeObjectURL(url);
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key==='z') { e.preventDefault(); undoBtn.click(); }
  if (e.ctrlKey && (e.key==='y'||(e.shiftKey&&e.key==='Z'))) { e.preventDefault(); redoBtn.click(); }
  if (e.ctrlKey && e.key==='s') { e.preventDefault(); downloadBtn.click(); }
}); 