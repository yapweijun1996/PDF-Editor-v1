// PDF.js setup
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const pdfUpload = document.getElementById('pdf-upload');
const pdfCanvas = document.getElementById('pdf-canvas');
const annotationCanvas = document.getElementById('annotation-canvas');
const exportBtn = document.getElementById('export-btn');
const pdfContainer = document.getElementById('pdf-container');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');
const toolbarBtns = document.querySelectorAll('.toolbar button');
const signatureModal = document.getElementById('signature-modal');
const signatureCanvas = document.getElementById('signature-canvas');
const clearSignatureBtn = document.getElementById('clear-signature');
const saveSignatureBtn = document.getElementById('save-signature');
const closeSignatureBtn = document.getElementById('close-signature');

let pdfDoc = null;
let currentPage = 1;
let scale = 1.5;
let pdfData = null;
let numPages = 1;
let activeTool = 'draw';
let signatureImage = null;

// Store annotation image data per page
const annotationData = {};

// Drawing state
let drawing = false;
let lastX = 0, lastY = 0;
const annotationCtx = annotationCanvas.getContext('2d');

// Toolbar logic
function setActiveTool(tool) {
  activeTool = tool;
  toolbarBtns.forEach(btn => {
    btn.classList.toggle('active', btn.id === 'tool-' + tool);
  });
}
toolbarBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.id.replace('tool-', '');
    setActiveTool(tool);
    if (tool === 'signature') {
      openSignatureModal();
    }
  });
});
setActiveTool('draw');

// Load PDF and render first page
pdfUpload.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf') {
    alert('Please upload a valid PDF file.');
    pdfUpload.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = async function(event) {
    pdfData = new Uint8Array(event.target.result);
    try {
      pdfDoc = await pdfjsLib.getDocument({data: pdfData}).promise;
    } catch (err) {
      alert('Failed to load PDF. The file may be corrupted or not a valid PDF.');
      pdfUpload.value = '';
      return;
    }
    numPages = pdfDoc.numPages;
    currentPage = 1;
    setActiveTool('draw');
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

  // Render PDF page
  const renderContext = {
    canvasContext: pdfCanvas.getContext('2d'),
    viewport: viewport
  };
  await page.render(renderContext).promise;

  // Restore annotation for this page if exists
  annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
  if (annotationData[num]) {
    const img = new window.Image();
    img.onload = () => annotationCtx.drawImage(img, 0, 0);
    img.src = annotationData[num];
  }
  updatePageInfo();
}

function updatePageInfo() {
  pageInfo.textContent = `Page ${currentPage} / ${numPages}`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === numPages;
}

prevPageBtn.addEventListener('click', () => {
  saveCurrentAnnotation();
  if (currentPage > 1) {
    currentPage--;
    renderPage(currentPage);
  }
});
nextPageBtn.addEventListener('click', () => {
  saveCurrentAnnotation();
  if (currentPage < numPages) {
    currentPage++;
    renderPage(currentPage);
  }
});

function saveCurrentAnnotation() {
  annotationData[currentPage] = annotationCanvas.toDataURL('image/png');
}

// Drawing on annotation canvas (only if draw tool is active)
annotationCanvas.addEventListener('mousedown', (e) => {
  if (!pdfDoc) {
    alert('Please upload and load a PDF before drawing.');
    return;
  }
  if (activeTool !== 'draw') return;
  drawing = true;
  [lastX, lastY] = getCanvasCoords(e);
});
annotationCanvas.addEventListener('mousemove', (e) => {
  if (!drawing || activeTool !== 'draw') return;
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

// Signature modal logic
function openSignatureModal() {
  signatureModal.classList.add('active');
  clearSignatureCanvas();
}
function closeSignatureModal() {
  signatureModal.classList.remove('active');
}
closeSignatureBtn.addEventListener('click', closeSignatureModal);

// Signature drawing logic
const sigCtx = signatureCanvas.getContext('2d');
let sigDrawing = false, sigLastX = 0, sigLastY = 0;
signatureCanvas.addEventListener('mousedown', (e) => {
  sigDrawing = true;
  [sigLastX, sigLastY] = getSigCanvasCoords(e);
});
signatureCanvas.addEventListener('mousemove', (e) => {
  if (!sigDrawing) return;
  const [x, y] = getSigCanvasCoords(e);
  sigCtx.strokeStyle = '#222';
  sigCtx.lineWidth = 2;
  sigCtx.lineCap = 'round';
  sigCtx.beginPath();
  sigCtx.moveTo(sigLastX, sigLastY);
  sigCtx.lineTo(x, y);
  sigCtx.stroke();
  [sigLastX, sigLastY] = [x, y];
});
signatureCanvas.addEventListener('mouseup', () => sigDrawing = false);
signatureCanvas.addEventListener('mouseleave', () => sigDrawing = false);
function getSigCanvasCoords(e) {
  const rect = signatureCanvas.getBoundingClientRect();
  return [
    (e.clientX - rect.left) * (signatureCanvas.width / rect.width),
    (e.clientY - rect.top) * (signatureCanvas.height / rect.height)
  ];
}
function clearSignatureCanvas() {
  sigCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
}
clearSignatureBtn.addEventListener('click', clearSignatureCanvas);

saveSignatureBtn.addEventListener('click', () => {
  signatureImage = signatureCanvas.toDataURL('image/png');
  closeSignatureModal();
  // TODO: Allow user to place signature on PDF
});

// Export annotated PDF (all pages)
exportBtn.addEventListener('click', async () => {
  if (!pdfDoc) return alert('Please upload a PDF first.');
  saveCurrentAnnotation();
  const { PDFDocument } = window.PDFLib;
  let pdfDocLib;
  try {
    pdfDocLib = await PDFDocument.load(pdfData);
  } catch (err) {
    alert('Failed to parse PDF for export. The file may be corrupted or not a valid PDF.');
    return;
  }
  for (let i = 0; i < pdfDocLib.getPageCount(); i++) {
    const page = pdfDocLib.getPage(i);
    const pageNum = i + 1;
    if (annotationData[pageNum]) {
      const pngImage = await pdfDocLib.embedPng(annotationData[pageNum]);
      const { width, height } = page.getSize();
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width,
        height,
      });
    }
  }
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