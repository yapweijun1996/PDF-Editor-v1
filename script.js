const {
  PDFDocument,
  StandardFonts,
  degrees
} = PDFLib;

let pdfDoc = null;
let dataUri = '';
let history = [];
let redoStack = [];
let currentPage = 1;
let totalPages = 0;
let zoomLevel = 1;

const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const fileNameEl = document.getElementById('fileName');
const pdfViewer = document.getElementById('pdfViewer');
const firstPageBtn = document.getElementById('firstPageBtn');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const lastPageBtn = document.getElementById('lastPageBtn');
const pageNumberInput = document.getElementById('pageNumberInput');
const totalPagesEl = document.getElementById('totalPages');
const zoomSelect = document.getElementById('zoomSelect');
const rotateLeftBtn = document.getElementById('rotateLeftBtn');
const rotateRightBtn = document.getElementById('rotateRightBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const downloadBtn = document.getElementById('downloadBtn');
const textInput = document.getElementById('textInput');
const xInput = document.getElementById('xInput');
const yInput = document.getElementById('yInput');
const sizeInput = document.getElementById('sizeInput');
const addTextBtn = document.getElementById('addTextBtn');

// Helper: update undo/redo buttons state
function updateUndoRedoButtons() {
  undoBtn.disabled = history.length < 2;
  redoBtn.disabled = redoStack.length === 0;
}

// Helper: push current PDF state to history
async function pushHistory() {
  const bytes = await pdfDoc.save();
  history.push(bytes);
  redoStack = [];
  updateUndoRedoButtons();
}

// Helper: clamp current page
function clampPage() {
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;
}

// Update the iframe viewer with page and zoom
function updateViewer() {
  if (!dataUri) return;
  clampPage();
  pageNumberInput.value = currentPage;
  const fragment = `#page=${currentPage}&zoom=${zoomLevel * 100}`;
  pdfViewer.src = dataUri + fragment;
}

// Load PDF from ArrayBuffer
async function loadArrayBuffer(buffer, file) {
  pdfDoc = await PDFDocument.load(buffer);
  totalPages = pdfDoc.getPages().length;
  currentPage = 1;
  zoomLevel = 1;

  fileNameEl.textContent = file.name;
  pageNumberInput.min = 1;
  pageNumberInput.max = totalPages;
  totalPagesEl.textContent = totalPages;

  dataUri = await pdfDoc.saveAsBase64({ dataUri: true });
  pdfViewer.src = dataUri;

  history = [];
  redoStack = [];
  await pushHistory();
}

// Handle file input
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const buffer = await file.arrayBuffer();
  await loadArrayBuffer(buffer, file);
});

// Drag & drop
['dragenter','dragover','dragleave','drop'].forEach(ev => {
  dropZone.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation();
    if (ev === 'dragenter' || ev === 'dragover') {
      dropZone.classList.add('drop-zone--active');
    } else {
      dropZone.classList.remove('drop-zone--active');
    }
  });
});

dropZone.addEventListener('drop', async (e) => {
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    const buffer = await file.arrayBuffer();
    await loadArrayBuffer(buffer, file);
  }
});

// Navigation
firstPageBtn.addEventListener('click', () => { currentPage = 1; updateViewer(); });
prevPageBtn.addEventListener('click', () => { currentPage--; updateViewer(); });
nextPageBtn.addEventListener('click', () => { currentPage++; updateViewer(); });
lastPageBtn.addEventListener('click', () => { currentPage = totalPages; updateViewer(); });
pageNumberInput.addEventListener('change', () => {
  const val = parseInt(pageNumberInput.value) || 1;
  currentPage = val;
  updateViewer();
});

// Zoom control
zoomSelect.addEventListener('change', () => {
  zoomLevel = parseFloat(zoomSelect.value) || 1;
  updateViewer();
});

// Rotate current page
async function rotatePage(angle) {
  if (!pdfDoc) return;
  const page = pdfDoc.getPages()[currentPage - 1];
  const curr = page.getRotation().angle || 0;
  page.setRotation(degrees(curr + angle));
  await pushHistory();
  dataUri = await pdfDoc.saveAsBase64({ dataUri: true });
  updateViewer();
}
rotateLeftBtn.addEventListener('click', () => rotatePage(-90));
rotateRightBtn.addEventListener('click', () => rotatePage(90));

// Undo/Redo
undoBtn.addEventListener('click', async () => {
  if (history.length < 2) return;
  const last = history.pop();
  redoStack.push(last);
  const prev = history[history.length - 1];
  pdfDoc = await PDFDocument.load(prev);
  totalPages = pdfDoc.getPages().length;
  dataUri = await pdfDoc.saveAsBase64({ dataUri: true });
  updateViewer();
  updateUndoRedoButtons();
});
redoBtn.addEventListener('click', async () => {
  if (redoStack.length === 0) return;
  const next = redoStack.pop();
  history.push(next);
  pdfDoc = await PDFDocument.load(next);
  totalPages = pdfDoc.getPages().length;
  dataUri = await pdfDoc.saveAsBase64({ dataUri: true });
  updateViewer();
  updateUndoRedoButtons();
});

// Add text
addTextBtn.addEventListener('click', async () => {
  if (!pdfDoc) { alert('Load a PDF first.'); return; }
  const text = textInput.value.trim();
  const x = parseFloat(xInput.value);
  const y = parseFloat(yInput.value);
  const size = parseFloat(sizeInput.value);
  if (!text) { alert('Enter some text.'); return; }
  if (isNaN(x) || isNaN(y) || isNaN(size) || size <= 0) {
    alert('Invalid X, Y or size.'); return;
  }
  const page = pdfDoc.getPages()[currentPage - 1];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x, y, size, font });
  await pushHistory();
  dataUri = await pdfDoc.saveAsBase64({ dataUri: true });
  updateViewer();
});

// Download PDF
downloadBtn.addEventListener('click', async () => {
  if (!pdfDoc) { alert('Load a PDF first.'); return; }
  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'edited.pdf'; a.click();
  URL.revokeObjectURL(url);
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault(); undoBtn.click();
  }
  if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
    e.preventDefault(); redoBtn.click();
  }
  if (e.ctrlKey && e.key.toLowerCase() === 's') {
    e.preventDefault(); downloadBtn.click();
  }
}); 