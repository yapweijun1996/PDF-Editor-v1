// Initialize the PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Global variables
let pdfDoc = null;
let pdfBytes = null;
let currentPage = 1;
let totalPages = 0;
let scale = 1.5;
let textOverlays = {}; // Object to store text overlays for each page
let addingText = false;

// DOM Elements
const fileInput = document.getElementById('file-input');
const pdfCanvas = document.getElementById('pdf-canvas');
const overlayCanvas = document.getElementById('overlay-canvas');
const addTextBtn = document.getElementById('add-text-btn');
const saveBtn = document.getElementById('save-btn');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageNumDisplay = document.getElementById('page-num');
const pdfControls = document.getElementById('pdf-controls');

// Event Listeners
fileInput.addEventListener('change', loadPDF);
addTextBtn.addEventListener('click', startAddText);
saveBtn.addEventListener('click', savePDF);
prevPageBtn.addEventListener('click', showPrevPage);
nextPageBtn.addEventListener('click', showNextPage);

// Load PDF from file input
async function loadPDF(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    // Read the file as ArrayBuffer
    pdfBytes = await file.arrayBuffer();
    
    // Load the PDF with pdf.js
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    pdfDoc = await loadingTask.promise;
    
    // Initialize variables
    totalPages = pdfDoc.numPages;
    currentPage = 1;
    textOverlays = {}; // Reset text overlays
    
    // Display controls
    pdfControls.classList.remove('hidden');
    
    // Update page display
    updatePageDisplay();
    
    // Render the first page
    renderPage(currentPage);
  } catch (error) {
    console.error('Error loading PDF:', error);
    alert('Error loading PDF. Please try another file.');
  }
}

// Render a specific page of the PDF
async function renderPage(pageNum) {
  try {
    // Get the page
    const page = await pdfDoc.getPage(pageNum);
    
    // Get the viewport at the desired scale
    const viewport = page.getViewport({ scale });
    
    // Set canvas dimensions to match the viewport
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    overlayCanvas.width = viewport.width;
    overlayCanvas.height = viewport.height;
    
    // Render the PDF page on the canvas
    const renderContext = {
      canvasContext: pdfCanvas.getContext('2d'),
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
    
    // Draw any existing text overlays for this page
    drawTextOverlays();
  } catch (error) {
    console.error('Error rendering page:', error);
  }
}

// Show previous page
function showPrevPage() {
  if (currentPage <= 1) return;
  currentPage--;
  updatePageDisplay();
  renderPage(currentPage);
}

// Show next page
function showNextPage() {
  if (currentPage >= totalPages) return;
  currentPage++;
  updatePageDisplay();
  renderPage(currentPage);
}

// Update the page number display
function updatePageDisplay() {
  pageNumDisplay.textContent = `Page: ${currentPage} / ${totalPages}`;
  
  // Enable/disable navigation buttons
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

// Start adding text process
function startAddText() {
  addingText = true;
  overlayCanvas.style.pointerEvents = 'auto'; // Make overlay clickable
  overlayCanvas.addEventListener('click', handleCanvasClick);
}

// Handle click on canvas for text placement
function handleCanvasClick(e) {
  if (!addingText) return;
  
  // Get click coordinates relative to the canvas
  const rect = overlayCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Prompt for text
  const text = prompt("Enter text to add:");
  
  if (text) {
    // Initialize the page's overlay array if it doesn't exist
    if (!textOverlays[currentPage]) {
      textOverlays[currentPage] = [];
    }
    
    // Add the text to overlays
    textOverlays[currentPage].push({
      text: text,
      x: x,
      y: y,
      fontSize: 20,
      color: '#FF0000'
    });
    
    // Redraw overlays
    drawTextOverlays();
  }
  
  // Reset state
  addingText = false;
  overlayCanvas.style.pointerEvents = 'none';
  overlayCanvas.removeEventListener('click', handleCanvasClick);
}

// Draw text overlays for the current page
function drawTextOverlays() {
  const ctx = overlayCanvas.getContext('2d');
  
  // Clear the overlay canvas
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  
  // If no overlays for this page, return
  if (!textOverlays[currentPage]) return;
  
  // Draw each text overlay
  textOverlays[currentPage].forEach(overlay => {
    ctx.font = `${overlay.fontSize}px Arial`;
    ctx.fillStyle = overlay.color;
    ctx.fillText(overlay.text, overlay.x, overlay.y);
  });
}

// Save the PDF with text overlays
async function savePDF() {
  if (!pdfBytes) {
    alert('No PDF loaded');
    return;
  }
  
  try {
    // Load the PDF with pdf-lib
    const pdfDocLib = await PDFLib.PDFDocument.load(pdfBytes);
    const pages = pdfDocLib.getPages();
    
    // Process each page that has overlays
    for (const pageNum in textOverlays) {
      if (textOverlays.hasOwnProperty(pageNum)) {
        const pageIdx = parseInt(pageNum) - 1; // Convert to 0-based index
        const page = pages[pageIdx];
        
        // Apply each text overlay to the page
        textOverlays[pageNum].forEach(overlay => {
          // Note: pdf-lib uses bottom-left as origin, so we need to flip y-coordinate
          page.drawText(overlay.text, {
            x: overlay.x,
            y: page.getHeight() - overlay.y, // Flip y-coordinate
            size: overlay.fontSize,
            color: PDFLib.rgb(1, 0, 0) // Red color
          });
        });
      }
    }
    
    // Save the modified PDF
    const modifiedPdfBytes = await pdfDocLib.save();
    
    // Create a Blob from the PDF bytes
    const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
    
    // Create a download link and trigger download
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'edited-pdf.pdf';
    link.click();
  } catch (error) {
    console.error('Error saving PDF:', error);
    alert('Error saving PDF. Please try again.');
  }
} 