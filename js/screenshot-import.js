/**
 * FRIENDS FOREVER — Import courses from a schedule screenshot
 * Reads the image with OCR (Tesseract.js, runs inside the browser — the image is never uploaded),
 * finds "COURSE -SECTION" entries (e.g. "CSE470 -01 -NZU-09D-18C") and matches them to the live catalog.
 */

const OCR_LIB_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

class ScreenshotImporter {
    constructor() {
        this.libPromise = null;
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

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const px = imageData.data;
                    let sum = 0;
                    for (let i = 0; i < px.length; i += 4) {
                        const g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
                        px[i] = px[i + 1] = px[i + 2] = g;
                        sum += g;
                    }
                    const dark = (sum / (px.length / 4)) < 128;
                    if (dark) {
                        for (let i = 0; i < px.length; i += 4) {
                            px[i] = px[i + 1] = px[i + 2] = 255 - px[i];
                        }
                    }
                    ctx.putImageData(imageData, 0, 0);
                    resolve(canvas);
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

    /** Run OCR and return the recognised text (tries two layout modes if the first finds nothing) */
    async readEntries(file, onProgress) {
        await this.loadLibrary();
        onProgress && onProgress('Preparing image…', 0.02);
        const canvas = await this.preprocess(file);

        let lastText = '';
        let worker = null;
        try {
            worker = await window.Tesseract.createWorker('eng', 1, {
                logger: (m) => {
                    if (!onProgress || !m) return;
                    if (m.status === 'recognizing text') {
                        onProgress('Reading text…', 0.15 + 0.85 * (m.progress || 0));
                    } else if (m.status) {
                        onProgress('Loading reader (first time takes a few seconds)…', 0.05);
                    }
                }
            });

            for (const mode of ['11', '6']) {
                await worker.setParameters({ tessedit_pageseg_mode: mode });
                const { data } = await worker.recognize(canvas);
                lastText = data.text || '';
                const entries = this.parseText(lastText);
                if (entries.length > 0) return entries;
            }
        } finally {
            if (worker) {
                try { await worker.terminate(); } catch (e) { /* ignore */ }
            }
        }
        return this.parseText(lastText);
    }

    /**
     * Find "CSE470 -01", "CSE423L -09" style entries in OCR text.
     * Returns unique { code, suffix, section } objects.
     */
    parseText(text) {
        const t = String(text || '').toUpperCase();
        const re = /\b([A-Z]{2,4})\s?([0-9OI]{3})\s?([A-Z])?\s*[-–—~_.]\s*([0-9OI]{1,2})(?![0-9])/g;
        const fixDigits = (s) => s.replace(/O/g, '0').replace(/I/g, '1');

        const seen = new Map();
        let m;
        while ((m = re.exec(t)) !== null) {
            const code = m[1] + fixDigits(m[2]);
            const suffix = m[3] || '';
            const section = parseInt(fixDigits(m[4]), 10);
            if (Number.isNaN(section)) continue;
            const key = `${code}|${section}`;
            if (!seen.has(key)) {
                seen.set(key, { code, suffix, section });
            } else if (suffix && !seen.get(key).suffix) {
                seen.get(key).suffix = suffix;
            }
        }
        return Array.from(seen.values());
    }

    /**
     * Match parsed entries against the live catalog.
     * "CSE423L" is the lab part of CSE423, so the plain code is tried first.
     */
    matchCatalog(entries, catalog) {
        const matched = [];
        const unmatched = [];
        const usedIds = new Set();

        entries.forEach(entry => {
            const sameSection = (c) => parseInt(c.sectionName, 10) === entry.section;
            let course = catalog.find(c => c.courseCode === entry.code && sameSection(c));
            if (!course && entry.suffix) {
                course = catalog.find(c => c.courseCode === entry.code + entry.suffix && sameSection(c));
            }
            if (course) {
                if (!usedIds.has(course.id)) {
                    usedIds.add(course.id);
                    matched.push({ entry, course });
                }
            } else {
                unmatched.push(entry);
            }
        });

        return { matched, unmatched };
    }
}

window.screenshotImporter = new ScreenshotImporter();