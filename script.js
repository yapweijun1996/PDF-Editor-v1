// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const scale = 1.5;            // Render scale: PDF pt to canvas px
const defaultFontSize = 20;    // Default font size in PDF points

let pdfDoc = null;
let pdfBytes = null;
let viewport = null;
let textOverlays = [];

// DOM
const fileInput = document.getElementById('file-input');
const pdfCanvas = document.getElementById('pdf-canvas');
const overlayCanvas = document.getElementById('overlay-canvas');
const addTextBtn = document.getElementById('add-text-btn');
const saveBtn = document.getElementById('save-btn');
const pdfControls = document.getElementById('pdf-controls');

// Events
fileInput.addEventListener('change', loadPDF);
addTextBtn.addEventListener('click', () => {
  overlayCanvas.style.pointerEvents = 'auto';
});
saveBtn.addEventListener('click', savePDF);
overlayCanvas.addEventListener('click', addTextOverlay);

// Load PDF and render first page
async function loadPDF(e) {
  const file = e.target.files[0];
  if (!file) return;
  pdfBytes = await file.arrayBuffer();
  pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  pdfControls.classList.remove('hidden');
  await renderPage(1);
}

// Render a PDF page to canvas
async function renderPage(pageNumber) {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  // Resize canvases
  pdfCanvas.width     = viewport.width;
  pdfCanvas.height    = viewport.height;
  overlayCanvas.width = viewport.width;
  overlayCanvas.height= viewport.height;

  // Render PDF page
  await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise;
  drawOverlays();
}

// Redraw text overlays on overlay canvas
function drawOverlays() {
  const ctx = overlayCanvas.getContext('2d');
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  textOverlays.forEach(o => {
    // Set overlay font to match PDF font at scale
    const overlayFontSize = o.pdfFontSize * scale;
    ctx.font = `${overlayFontSize}px Helvetica`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'red';
    // draw at canvas coords
    ctx.fillText(o.text, o.xCanvas, o.yCanvas);
  });
  overlayCanvas.style.pointerEvents = 'none';
}

// Handle click to add text overlay
function addTextOverlay(e) {
  if (overlayCanvas.style.pointerEvents !== 'auto') return;
  const rect = overlayCanvas.getBoundingClientRect();
  const xCanvas = e.clientX - rect.left;
  const yCanvas = e.clientY - rect.top;
  const text = prompt('Enter text:');
  if (!text) return;
  // Convert canvas coords to PDF points
  const [pdfX, pdfY] = viewport.convertToPdfPoint(xCanvas, yCanvas);
  textOverlays.push({ text, xCanvas, yCanvas, pdfX, pdfY, pdfFontSize: defaultFontSize });
  drawOverlays();
}

// Save edited PDF
async function savePDF() {
  if (!pdfBytes) return;
  const pdfDocLib = await PDFLib.PDFDocument.load(pdfBytes);
  const helveticaFont = await pdfDocLib.embedFont(PDFLib.StandardFonts.Helvetica);
  const page = pdfDocLib.getPages()[0];
  const pageHeight = page.getHeight();

  textOverlays.forEach(o => {
    const pdfSize = o.pdfFontSize;
    // Subtract ascent so click Y becomes top-of-text
    const ascent = helveticaFont.ascentAtSize(pdfSize);
    page.drawText(o.text, {
      x: o.pdfX,
      y: o.pdfY - ascent,
      size: pdfSize,
      font: helveticaFont,
      color: PDFLib.rgb(1, 0, 0)
    });
  });

  const newPdfBytes = await pdfDocLib.save();
  const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'edited.pdf';
  link.click();
} 