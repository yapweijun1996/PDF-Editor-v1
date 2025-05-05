// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Globals
let pdfDoc = null;
let pdfBytes = null;
const scale = 1;      // 1 PDF pt = 1 canvas px
let textOverlays = [];

// DOM Elements
const fileInput     = document.getElementById('file-input');
const pdfCanvas     = document.getElementById('pdf-canvas');
const overlayCanvas = document.getElementById('overlay-canvas');
const addTextBtn    = document.getElementById('add-text-btn');
const saveBtn       = document.getElementById('save-btn');
const pdfControls   = document.getElementById('pdf-controls');

// Event listeners
fileInput.addEventListener('change', handleFile);
addTextBtn.addEventListener('click', () => overlayCanvas.style.pointerEvents = 'auto');
saveBtn.addEventListener('click', savePDF);
overlayCanvas.addEventListener('click', placeText);

// Handle PDF file input
async function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  pdfBytes = await file.arrayBuffer();
  pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  pdfControls.classList.remove('hidden');
  await renderPage(1);
}

// Render page # to canvas
async function renderPage(pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  // Enable high DPI support
  const dpr = window.devicePixelRatio || 1;

  // Set canvas buffer size and CSS dimensions
  pdfCanvas.width = viewport.width * dpr;
  pdfCanvas.height = viewport.height * dpr;
  pdfCanvas.style.width = `${viewport.width}px`;
  pdfCanvas.style.height = `${viewport.height}px`;
  overlayCanvas.width = viewport.width * dpr;
  overlayCanvas.height = viewport.height * dpr;
  overlayCanvas.style.width = `${viewport.width}px`;
  overlayCanvas.style.height = `${viewport.height}px`;

  // Scale drawing contexts to account for DPR
  const pdfCtx = pdfCanvas.getContext('2d');
  pdfCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const overlayCtx = overlayCanvas.getContext('2d');
  overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  await page.render({ canvasContext: pdfCtx, viewport }).promise;
  textOverlays = [];
  drawOverlays();
}

// Draw overlays on overlayCanvas
function drawOverlays() {
  const ctx = overlayCanvas.getContext('2d');
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  ctx.fillStyle = 'red';
  // Use alphabetic baseline to match PDF-lib baseline
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  textOverlays.forEach(o => {
    ctx.font = `${o.fontSize}px Helvetica`;
    ctx.fillText(o.text, o.x, o.y);
  });
  overlayCanvas.style.pointerEvents = 'none';
}

// Place text overlay on click
function placeText(e) {
  const rect = overlayCanvas.getBoundingClientRect();
  // Get click position in CSS pixels
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const text = prompt('Enter text:');
  if (text) {
    const fontSize = 20;
    const ctx = overlayCanvas.getContext('2d');
    // Set font to measure ascent
    ctx.font = `${fontSize}px Helvetica`;
    const metrics = ctx.measureText(text);
    // Use actualBoundingBoxAscent for precise baseline alignment (fallback to 0.8*fontSize)
    const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
    // Calculate baseline Y so text top matches click Y
    const baselineY = y + ascent;
    // Store CSS-space coords for preview (will be scaled by DPR in drawOverlays)
    textOverlays.push({ text, x, y: baselineY, fontSize });
    drawOverlays();
  }
}

// Save edited PDF
async function savePDF() {
  if (!pdfBytes) return;
  const pdfDocLib = await PDFLib.PDFDocument.load(pdfBytes);
  const helv = await pdfDocLib.embedFont(PDFLib.StandardFonts.Helvetica);
  const page = pdfDocLib.getPages()[0];
  const ph = page.getHeight();
  textOverlays.forEach(o => {
    const size = o.fontSize / scale;
    // o.y is baseline (alphabetic), so map directly to PDF baseline
    const pdfY = ph - (o.y / scale);
    page.drawText(o.text, {
      x: o.x / scale,
      y: pdfY,
      size,
      font: helv,
      color: PDFLib.rgb(1, 0, 0)
    });
  });
  const newBytes = await pdfDocLib.save();
  const blob = new Blob([newBytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'edited.pdf';
  link.click();
} 