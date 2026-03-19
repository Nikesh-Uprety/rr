# Export the architecture report to PDF

## Option A (recommended): Use the HTML report and “Print to PDF”
1. Open `md/rr-architecture-report-2026-03-19.html` in a browser.
2. Use **Print** → **Save as PDF**.
3. Save it as `md/rr-architecture-report-2026-03-19.pdf`.

This keeps the diagrams rendered (Mermaid) and usually produces the cleanest PDF.

## Option B: Generate PDF from Markdown (requires a headless browser)
If your environment supports Chromium downloads/runs (Puppeteer), you can generate a PDF from Markdown:

```bash
npm install
npx md-to-pdf md/rr-architecture-report-2026-03-19.md --output md/rr-architecture-report-2026-03-19.pdf
```

