// PDF.js setup
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const pdfUpload = document.getElementById('pdf-upload');
const pdfCanvas = document.getElementById('pdf-canvas');
const annotationCanvas = document.getElementById('annotation-canvas');
const exportBtn = document.getElementById('export-btn');
const pdfContainer = document.getElementById('pdf-container');

let pdfDoc = null;
let currentPage = 1;
let scale = 1.5;
let pdfData = null;

// Drawing state
let drawing = false;
let lastX = 0, lastY = 0;
const annotationCtx = annotationCanvas.getContext('2d');

// Load PDF and render first page
pdfUpload.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(event) {
    pdfData = new Uint8Array(event.target.result);
    pdfDoc = await pdfjsLib.getDocument({data: pdfData}).promise;
    renderPage(currentPage);
  };
  reader.readAsArrayBuffer(file);
});

async function renderPage(num) {
  const page = await pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale });
  pdfCanvas.width = viewport.width;
  pdfCanvas.height = viewport.height;
  annotationCanvas.width = viewport.width;
  annotationCanvas.height = viewport.height;
  annotationCanvas.style.width = pdfCanvas.style.width = viewport.width + 'px';
  annotationCanvas.style.height = pdfCanvas.style.height = viewport.height + 'px';

  // Clear annotation canvas
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);

  // Render PDF page
  const renderContext = {
    canvasContext: pdfCanvas.getContext('2d'),
    viewport: viewport
  };
  await page.render(renderContext).promise;
}

// Drawing on annotation canvas
annotationCanvas.addEventListener('mousedown', (e) => {
  drawing = true;
  [lastX, lastY] = getCanvasCoords(e);
});
annotationCanvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  const [x, y] = getCanvasCoords(e);
  annotationCtx.strokeStyle = '#FF0000';
  annotationCtx.lineWidth = 2;
  annotationCtx.lineCap = 'round';
  annotationCtx.beginPath();
  annotationCtx.moveTo(lastX, lastY);
  annotationCtx.lineTo(x, y);
  annotationCtx.stroke();
  [lastX, lastY] = [x, y];
});
annotationCanvas.addEventListener('mouseup', () => drawing = false);
annotationCanvas.addEventListener('mouseleave', () => drawing = false);

function getCanvasCoords(e) {
  const rect = annotationCanvas.getBoundingClientRect();
  return [
    (e.clientX - rect.left) * (annotationCanvas.width / rect.width),
    (e.clientY - rect.top) * (annotationCanvas.height / rect.height)
  ];
}

// Export annotated PDF
exportBtn.addEventListener('click', async () => {
  if (!pdfDoc) return alert('Please upload a PDF first.');
  // Get annotation as image
  const annotationImg = annotationCanvas.toDataURL('image/png');
  // Load original PDF with pdf-lib
  const { PDFDocument, rgb } = window.pdfLib;
  const pdfDocLib = await PDFDocument.load(pdfData);
  const page = pdfDocLib.getPage(0); // Only first page for demo
  const pngImage = await pdfDocLib.embedPng(annotationImg);
  const { width, height } = page.getSize();
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width,
    height,
  });
  const pdfBytes = await pdfDocLib.save();
  download(pdfBytes, 'annotated.pdf', 'application/pdf');
});

function download(data, filename, type) {
  const blob = new Blob([data], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
} 