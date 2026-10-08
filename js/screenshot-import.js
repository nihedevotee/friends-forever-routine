/**
 * FRIENDS FOREVER — Universal Schedule Screenshot Importer
 *
 * Directly extracts Course Code and Section Number:
 *   - "CSE470-08", "CSE470 08", "CSE470 - 08", "CSE470\n08", "CSE470-\n08"
 *   - "CSE420-21", "CHE101-11", "HUM102-01", "MAT216-01", "STA301-02", "CSE330 11"
 *
 * No teacher codes or room codes required.
 */

const OCR_LIB_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const PDF_LIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDF_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const MAX_PDF_PAGES = 10;

class ScreenshotImporter {
    constructor() {
        this.libPromise = null;
        this.pdfPromise = null;
    }

    /** Load Tesseract.js only when it is first needed */
    loadLibrary() {
        if (window.Tesseract) return Promise.resolve();
        if (!this.libPromise) {
            this.libPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = OCR_LIB_URL;
                script.onload = () => resolve();
                script.onerror = () => {
                    this.libPromise = null;
                    reject(new Error('Could not load the screenshot reader. Please check your internet connection.'));
                };
                document.head.appendChild(script);
            });
        }
        return this.libPromise;
    }

    /** Upscale, grayscale and (for dark screenshots) invert so the text is dark-on-light */
    preprocess(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                try {
                    const scale = Math.min(3, Math.max(1, 2400 / img.width));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(this.enhanceCanvas(canvas));
                } catch (err) {
                    reject(err);
                } finally {
                    URL.revokeObjectURL(url);
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('That file could not be opened as an image.'));
            };
            img.src = url;
        });
    }

    /** Grayscale and (for dark pages) invert a canvas in place */
    enhanceCanvas(canvas) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = imageData.data;
        let sum = 0;
        for (let i = 0; i < px.length; i += 4) {
            const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
            px[i] = px[i + 1] = px[i + 2] = g;
            sum += g;
        }
        if ((sum / (px.length / 4)) < 128) {
            for (let i = 0; i < px.length; i += 4) {
                px[i] = px[i + 1] = px[i + 2] = 255 - px[i];
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    isPdf(file) {
        return file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
    }

    /** Load PDF.js only when a PDF is first imported */
    loadPdfLibrary() {
        if (window.pdfjsLib) return Promise.resolve();
        if (!this.pdfPromise) {
            this.pdfPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = PDF_LIB_URL;
                script.onload = () => {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
                    resolve();
                };
                script.onerror = () => {
                    this.pdfPromise = null;
                    reject(new Error('Could not load the PDF reader. Please check your internet connection.'));
                };
                document.head.appendChild(script);
            });
        }
        return this.pdfPromise;
    }

    /** Read a PDF: use its text layer first, fall back to OCR on rendered pages */
    async readPdf(file, onProgress) {
        await this.loadPdfLibrary();
        onProgress && onProgress('Opening PDF…', 0.02);
        const data = await file.arrayBuffer();
        let pdf;
        try {
            pdf = await window.pdfjsLib.getDocument({ data }).promise;
        } catch (err) {
            throw new Error('That PDF could not be opened (it may be damaged or password-protected).');
        }

        const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);

        let text = '';
        for (let p = 1; p <= pageCount; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            text += content.items.map(it => it.str).join(' ') + '\n';
            onProgress && onProgress('Reading PDF text…', 0.05 + 0.2 * (p / pageCount));
        }
        const direct = this.parseText(text);
        if (direct.length > 0) return direct;

        const canvases = [];
        for (let p = 1; p <= pageCount; p++) {
            const page = await pdf.getPage(p);
            const base = page.getViewport({ scale: 1 });
            const scale = Math.min(3, Math.max(1, 2400 / base.width));
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport }).promise;
            canvases.push(this.enhanceCanvas(canvas));
            onProgress && onProgress('Preparing PDF pages…', 0.25 + 0.1 * (p / pageCount));
        }
        return this.ocrCanvases(canvases, onProgress);
    }

    /** Read an image or PDF and return the course entries found in it */
    async readEntries(file, onProgress) {
        if (this.isPdf(file)) return this.readPdf(file, onProgress);
        onProgress && onProgress('Preparing image…', 0.02);
        const canvas = await this.preprocess(file);
        return this.ocrCanvases([canvas], onProgress);
    }

    /** Run OCR across layout modes and merge candidate detections */
    async ocrCanvases(canvases, onProgress) {
        await this.loadLibrary();

        const votes = new Map();
        const suffixMap = new Map();

        const addVotes = (entries) => {
            entries.forEach(e => {
                const fullCode = e.code + (e.suffix || '');
                if (!votes.has(fullCode)) votes.set(fullCode, new Map());
                const secMap = votes.get(fullCode);
                secMap.set(e.section, (secMap.get(e.section) || 0) + 1);
                if (e.suffix) suffixMap.set(fullCode, e.suffix);
            });
        };

        const MODES = ['6', '11', '3'];

        let worker = null;
        try {
            worker = await window.Tesseract.createWorker('eng', 1, {
                logger: (m) => {
                    if (!onProgress || !m) return;
                    if (m.status === 'recognizing text') {
                        onProgress('Reading text…', 0.35 + 0.65 * (m.progress || 0));
                    } else if (m.status) {
                        onProgress('Loading reader (first time takes a few seconds)…', 0.05);
                    }
                }
            });

            for (const canvas of canvases) {
                for (const mode of MODES) {
                    await worker.setParameters({ tessedit_pageseg_mode: mode });
                    const { data } = await worker.recognize(canvas);
                    addVotes(this.parseText(data.text || ''));
                }
            }
        } finally {
            if (worker) {
                try { await worker.terminate(); } catch (e) { /* ignore */ }
            }
        }

        const results = [];
        for (const [fullCode, secMap] of votes.entries()) {
            const sortedSections = Array.from(secMap.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([sec]) => sec);

            const bestSec = sortedSections[0];
            const match = fullCode.match(/^([A-Z]{2,4}\d{3})([A-Z])?$/);

            if (match) {
                results.push({
                    code: match[1],
                    suffix: match[2] || '',
                    section: bestSec,
                    candidateSections: sortedSections
                });
            } else {
                results.push({
                    code: fullCode,
                    suffix: suffixMap.get(fullCode) || '',
                    section: bestSec,
                    candidateSections: sortedSections
                });
            }
        }

        return results;
    }

    /**
     * Universal Parser: Directly matches Course Code and Section Number.
     *
     * Patterns matched:
     *   - "CSE470-08", "CSE470 08", "CSE470 - 08", "CSE470\n08", "CSE470-\n08"
     *   - "CSE420-21", "CHE101-11", "HUM102-01", "MAT216-01", "STA301-02", "CSE330 11"
     */
    parseText(text) {
        const raw = String(text || '').toUpperCase();

        const fixDigits = (s) => String(s || '')
            .replace(/O/g, '0')
            .replace(/[IL|!\]]/g, '1')
            .replace(/L/g, '1')
            .replace(/B/g, '8');

        // Normalize dashes and collapse OCR spaces in department codes
        let clean = raw
            .replace(/[\u2010-\u2015\u2212_~]/g, '-')
            .replace(/\b([A-Z]{1,3})\s+([A-Z]{1,2})\s*([0-9OIlL|]{3})\b/g, '$1$2$3')
            .replace(/\b([A-Z]{2,4})\s+([0-9OIlL|]{3})\b/g, '$1$2');

        // Universal Course & Section Regex:
        // DEPT (2-4 letters)
        // optional separator (dash, spaces, or newline)
        // NUMBER (3 digits, with OCR substitutions)
        // optional suffix (e.g. L)
        // separator (dash, spaces, or newline)
        // SECTION (1-2 digits, with OCR substitutions)
        // Negative lookahead: section cannot be followed by alphanumeric room code or time colon
        const PATTERN = /\b([A-Z]{2,4})[- \t\r\n]*([0-9OIlL|]{3})([A-Z])?[- \t\r\n]+([0-9OIlLB|]{1,2})(?![0-9A-Za-z]|:[0-9])/g;

        const votes = new Map();
        let m;
        while ((m = PATTERN.exec(clean)) !== null) {
            const dept = m[1];
            const num = fixDigits(m[2]);
            const suffix = m[3] || '';
            const rawSec = fixDigits(m[4]);
            const sec = parseInt(rawSec, 10);

            if (Number.isNaN(sec) || sec <= 0 || sec > 99) continue;

            const fullCode = dept + num + suffix;
            if (!votes.has(fullCode)) votes.set(fullCode, new Map());
            const secMap = votes.get(fullCode);
            secMap.set(sec, (secMap.get(sec) || 0) + 1);
        }

        const results = [];
        for (const [fullCode, secMap] of votes.entries()) {
            const sorted = Array.from(secMap.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([sec]) => sec);

            const match = fullCode.match(/^([A-Z]{2,4}\d{3})([A-Z])?$/);
            results.push({
                code: match ? match[1] : fullCode,
                suffix: match && match[2] ? match[2] : '',
                section: sorted[0],
                candidateSections: sorted
            });
        }

        return results;
    }

    /**
     * Match parsed entries against the live catalog.
     * Verifies course code and section name against catalog.
     * Checks primary section and candidate sections found during OCR.
     */
    matchCatalog(entries, catalog) {
        const matched = [];
        const unmatched = [];
        const usedIds = new Set();

        const cleanCode = (code) => String(code || '').replace(/\s+/g, '').toUpperCase();

        entries.forEach(entry => {
            const sectionsToTry = [entry.section, ...(entry.candidateSections || [])]
                .filter((v, idx, arr) => arr.indexOf(v) === idx && v !== undefined && v !== null);

            const candidates = entry.suffix
                ? [entry.code + entry.suffix, entry.code]
                : [entry.code];

            let foundCourse = null;
            let matchedSection = null;

            for (const sec of sectionsToTry) {
                const sameSection = (c) => parseInt(c.sectionName, 10) === sec;
                for (const codeCandidate of candidates) {
                    const normCandidate = cleanCode(codeCandidate);
                    foundCourse = catalog.find(c => cleanCode(c.courseCode) === normCandidate && sameSection(c));
                    if (foundCourse) {
                        matchedSection = sec;
                        break;
                    }
                }
                if (foundCourse) break;
            }

            if (foundCourse && !usedIds.has(foundCourse.id)) {
                usedIds.add(foundCourse.id);
                entry.section = matchedSection;
                matched.push({ entry, course: foundCourse });
            } else if (!foundCourse) {
                unmatched.push(entry);
            }
        });

        return { matched, unmatched };
    }
}

// Attach to window for standard browser script usage
if (typeof window !== 'undefined') {
    window.ScreenshotImporter = ScreenshotImporter;
    window.screenshotImporter = new ScreenshotImporter();
}

// Support ES/CJS module imports
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ScreenshotImporter };
}