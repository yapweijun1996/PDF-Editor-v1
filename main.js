// PDF.js setup
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const fileInput = document.getElementById('file-input');
const pdfCanvas = document.getElementById('pdf-canvas');
const downloadBtn = document.getElementById('download-btn');
const ctx = pdfCanvas.getContext('2d');

let pdfDoc = null;
let pdfBytes = null;
let annotations = []; // {x, y, text}
let scale = 1;

// Handle PDF upload
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  pdfBytes = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  pdfDoc = await loadingTask.promise;
  renderPage(1);
  downloadBtn.disabled = false;
  annotations = [];
});

// Render the first page
async function renderPage(num) {
  const page = await pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale: 1 });
  scale = Math.min(1, 600 / viewport.width); // fit to 600px width
  const scaledViewport = page.getViewport({ scale });
  pdfCanvas.width = scaledViewport.width;
  pdfCanvas.height = scaledViewport.height;

  // Render PDF page into canvas
  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

  // Draw existing annotations
  drawAnnotations();
}

// Draw all annotations
function drawAnnotations() {
  annotations.forEach(a => {
    ctx.font = '16px Arial';
    ctx.fillStyle = 'red';
    ctx.fillText(a.text, a.x, a.y);
  });
}

// Add annotation on click
pdfCanvas.addEventListener('click', (e) => {
  if (!pdfDoc) return;
  const rect = pdfCanvas.getBoundingClientRect();
  const x = (e.clientX - rect.left);
  const y = (e.clientY - rect.top);
  const text = prompt('Enter annotation text:');
  if (text) {
    annotations.push({ x, y, text });
    renderPage(1);
  }
});

// Download annotated PDF
downloadBtn.addEventListener('click', async () => {
  if (!pdfBytes) return;
  const { PDFDocument, rgb } = window.pdfLib;
  const pdfDocLib = await PDFDocument.load(pdfBytes);
  const page = pdfDocLib.getPage(0);
  const { width, height } = page.getSize();
  // Map canvas coords to PDF coords
  annotations.forEach(a => {
    const pdfX = a.x / pdfCanvas.width * width;
    const pdfY = height - (a.y / pdfCanvas.height * height);
    page.drawText(a.text, {
      x: pdfX,
      y: pdfY,
      size: 16,
      color: rgb(1, 0, 0),
    });
  });
  const newPdfBytes = await pdfDocLib.save();
  const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'annotated.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}); 