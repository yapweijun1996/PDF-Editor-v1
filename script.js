// Entire contents replaced with SVG-based PDF editor logic
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let pdfDoc = null;
let pdfBytes = null;
let originalPdfBytes = null;
let pageWidth = 0, pageHeight = 0;
let textElements = [];
let addingText = false;
let selectedText = null;
let offsetX = 0, offsetY = 0;

const fileInput = document.getElementById('file-input');
const pdfImage = document.getElementById('pdf-image');
const svgOverlay = document.getElementById('svg-overlay');
const addTextBtn = document.getElementById('add-text-btn');
const saveBtn = document.getElementById('save-btn');
const pdfControls = document.getElementById('pdf-controls');
const editorContainer = document.getElementById('editor-container');

fileInput.addEventListener('change', loadPDF);
addTextBtn.addEventListener('click', () => {
  addingText = true;
  svgOverlay.style.cursor = 'crosshair';
});
saveBtn.addEventListener('click', savePDF);

async function loadPDF(e) {
  const file = e.target.files[0];
  if (!file) return;
  const arrayBuffer = await file.arrayBuffer();
  originalPdfBytes = new Uint8Array(arrayBuffer.slice(0));
  pdfBytes = arrayBuffer;
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  pageWidth = viewport.width;
  pageHeight = viewport.height;

  // Render PDF page to image
  const canvas = document.createElement('canvas');
  canvas.width = pageWidth;
  canvas.height = pageHeight;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  pdfImage.src = canvas.toDataURL();
  pdfImage.width = pageWidth;
  pdfImage.height = pageHeight;

  // Set SVG overlay size
  svgOverlay.setAttribute('width', pageWidth);
  svgOverlay.setAttribute('height', pageHeight);
  svgOverlay.style.width = pageWidth + 'px';
  svgOverlay.style.height = pageHeight + 'px';
  svgOverlay.innerHTML = '';
  textElements = [];
  pdfControls.classList.remove('hidden');
}

svgOverlay.addEventListener('mousedown', svgMouseDown);
svgOverlay.addEventListener('mousemove', svgMouseMove);
svgOverlay.addEventListener('mouseup', svgMouseUp);
svgOverlay.addEventListener('dblclick', svgDoubleClick);
svgOverlay.addEventListener('click', svgClick);

function svgClick(e) {
  if (!addingText) return;
  const pt = getSVGPoint(e);
  createTextElement('New Text', pt.x, pt.y, 24, '#d32f2f');
  addingText = false;
  svgOverlay.style.cursor = 'default';
}

function createTextElement(text, x, y, fontSize, color) {
  const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  textEl.setAttribute('x', x);
  textEl.setAttribute('y', y);
  textEl.setAttribute('font-size', fontSize);
  textEl.setAttribute('font-family', 'Helvetica, Arial, sans-serif');
  textEl.setAttribute('fill', color);
  textEl.setAttribute('class', 'text-element');
  textEl.textContent = text;
  svgOverlay.appendChild(textEl);
  textElements.push({ textEl, x, y, fontSize, color, text });
  textEl.addEventListener('mousedown', textMouseDown);
  textEl.addEventListener('click', (ev) => {
    ev.stopPropagation();
    selectTextElement(textEl);
  });
}

function selectTextElement(textEl) {
  svgOverlay.querySelectorAll('.text-element').forEach(el => el.classList.remove('selected'));
  textEl.classList.add('selected');
  selectedText = textElements.find(t => t.textEl === textEl);
}

function textMouseDown(e) {
  e.stopPropagation();
  selectTextElement(e.target);
  const pt = getSVGPoint(e);
  offsetX = pt.x - parseFloat(selectedText.textEl.getAttribute('x'));
  offsetY = pt.y - parseFloat(selectedText.textEl.getAttribute('y'));
  svgOverlay.setAttribute('data-dragging', 'true');
}

function svgMouseDown(e) {
  if (e.target.classList.contains('text-element')) return;
  selectedText = null;
  svgOverlay.querySelectorAll('.text-element').forEach(el => el.classList.remove('selected'));
}

function svgMouseMove(e) {
  if (svgOverlay.getAttribute('data-dragging') === 'true' && selectedText) {
    const pt = getSVGPoint(e);
    selectedText.x = pt.x - offsetX;
    selectedText.y = pt.y - offsetY;
    selectedText.textEl.setAttribute('x', selectedText.x);
    selectedText.textEl.setAttribute('y', selectedText.y);
  }
}

function svgMouseUp(e) {
  svgOverlay.removeAttribute('data-dragging');
}

function svgDoubleClick(e) {
  if (!e.target.classList.contains('text-element')) return;
  const textObj = textElements.find(t => t.textEl === e.target);
  const input = document.createElement('input');
  input.type = 'text';
  input.value = textObj.text;
  input.className = 'text-edit';
  input.style.left = (parseFloat(e.target.getAttribute('x')) - 2) + 'px';
  input.style.top = (parseFloat(e.target.getAttribute('y')) - 24) + 'px';
  input.style.fontSize = e.target.getAttribute('font-size') + 'px';
  editorContainer.appendChild(input);
  input.focus();
  input.addEventListener('blur', () => {
    textObj.text = input.value;
    textObj.textEl.textContent = input.value;
    editorContainer.removeChild(input);
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') input.blur();
    if (ev.key === 'Escape') {
      editorContainer.removeChild(input);
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' && selectedText) {
    svgOverlay.removeChild(selectedText.textEl);
    textElements = textElements.filter(t => t !== selectedText);
    selectedText = null;
  }
});

function getSVGPoint(evt) {
  const rect = svgOverlay.getBoundingClientRect();
  return {
    x: (evt.clientX - rect.left) * (svgOverlay.width.baseVal.value / rect.width),
    y: (evt.clientY - rect.top) * (svgOverlay.height.baseVal.value / rect.height)
  };
}

async function savePDF() {
  // Capture the editor container as an image
  const canvasSnap = await html2canvas(editorContainer, {
    backgroundColor: '#fff',
    useCORS: true,
    scale: 1
  });
  const imgData = canvasSnap.toDataURL('image/png');
  // Create PDF with jsPDF (unit in px matches canvas pixels)
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'px', format: [canvasSnap.width, canvasSnap.height] });
  pdf.addImage(imgData, 'PNG', 0, 0, canvasSnap.width, canvasSnap.height);
  pdf.save('edited.pdf');
} 