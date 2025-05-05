const {
  PDFDocument,
  StandardFonts
} = PDFLib;

let pdfDoc;

const fileInput = document.getElementById('fileInput');
const pdfViewer = document.getElementById('pdfViewer');
const textInput = document.getElementById('textInput');
const xInput = document.getElementById('xInput');
const yInput = document.getElementById('yInput');
const sizeInput = document.getElementById('sizeInput');
const addTextBtn = document.getElementById('addTextBtn');
const downloadBtn = document.getElementById('downloadBtn');

// Load selected PDF
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;

  const arrayBuffer = await file.arrayBuffer();
  pdfDoc = await PDFDocument.load(arrayBuffer);

  // Display initial PDF
  const dataUri = await pdfDoc.saveAsBase64({ dataUri: true });
  pdfViewer.src = dataUri;
});

// Add text to first page
addTextBtn.addEventListener('click', async () => {
  if (!pdfDoc) {
    alert('Please load a PDF first.');
    return;
  }

  const text = textInput.value;
  const x = parseFloat(xInput.value) || 0;
  const y = parseFloat(yInput.value) || 0;
  const size = parseFloat(sizeInput.value) || 12;

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  firstPage.drawText(text, {
    x,
    y,
    size,
    font: helveticaFont
  });

  const dataUri = await pdfDoc.saveAsBase64({ dataUri: true });
  pdfViewer.src = dataUri;
});

// Download edited PDF
downloadBtn.addEventListener('click', async () => {
  if (!pdfDoc) {
    alert('Please load a PDF first.');
    return;
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'edited.pdf';
  a.click();
  URL.revokeObjectURL(url);
}); 