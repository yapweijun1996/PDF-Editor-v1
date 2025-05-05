# Simple PDF Editor

A browser-based PDF editor built with HTML, CSS, and JavaScript only. This editor allows you to upload a PDF, add text to any page, and save the edited PDF.

## Features

- Upload any PDF file
- Navigate between PDF pages
- Add text at any position on any page
- Save the edited PDF with added text

## How to Use

1. Open `index.html` in a web browser
2. Click "Choose PDF File" and select a PDF
3. Use the navigation buttons to move between pages
4. Click "Add Text" then click where you want to add text
5. Enter your text in the prompt
6. Click "Save PDF" to download the edited PDF

## Technical Implementation

This project uses:
- **PDF.js**: To render PDF files in the browser
- **pdf-lib**: To edit and save the PDF
- Pure HTML, CSS, and JavaScript (no backend required)

## Limitations

- Text styling is limited (fixed font and color)
- Cannot resize, move, or delete text once placed
- Only supports adding text (no drawings, shapes, or images)

## Future Improvements

- Text styling options (font, size, color)
- Delete/edit existing text
- Drawing tools (lines, shapes)
- Image insertion
- Better mobile support

## License

MIT 