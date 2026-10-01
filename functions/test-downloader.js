/**
 * Test Downloader Engine
 * Generates and downloads Question Paper and Solutions PDFs in the browser
 * using pdf-lib, HTML5 Canvas, and NTSC APIs.
 */

(function (window) {
  'use strict';

  const CLOUDFLARE_PROXY = 'https://frosty-frog-31f9.evodev.workers.dev/';

  function getAuthHeaders(token) {
    return {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Origin: 'https://ntsc.narayanatalent.com',
      Referer: 'https://ntsc.narayanatalent.com/dashboard'
    };
  }

  async function proxyFetch(url, options = {}) {
    const proxyUrl = CLOUDFLARE_PROXY + '?url=' + encodeURIComponent(url);
    return fetch(proxyUrl, {
      ...options,
      headers: {
        ...(options.headers || {}),
        'x-key': 'ntsc-123'
      }
    });
  }

  function getSafeFilename(name, suffix = '') {
    const clean = String(name || 'Test')
      .replace(/[^a-zA-Z0-9_\-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
    return `${clean || 'Test'}${suffix}.pdf`;
  }

  function triggerDownload(blobOrBytes, filename) {
    const blob = blobOrBytes instanceof Blob
      ? blobOrBytes
      : new Blob([blobOrBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /**
   * Load image into canvas to decode GIF/PNG/JPG, handle CORS, and return PNG bytes
   */
  function loadImageToCanvas(url) {
    return new Promise((resolve) => {
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';

      // 20s timeout in case of hanging images
      const timer = setTimeout(() => {
        console.warn('Image load timed out:', url);
        resolve(null);
      }, 20000);

      img.onload = () => {
        clearTimeout(timer);
        try {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (!w || !h) return resolve(null);

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0);

          canvas.toBlob((blob) => {
            if (!blob) return resolve(null);
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                bytes: new Uint8Array(reader.result),
                width: w,
                height: h,
                canvas: canvas
              });
            };
            reader.onerror = () => resolve(null);
            reader.readAsArrayBuffer(blob);
          }, 'image/png');
        } catch (err) {
          console.warn('Canvas rendering error:', err);
          resolve(null);
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        console.warn('Image failed to load:', url);
        resolve(null);
      };

      img.src = url;
    });
  }

  /**
   * Slice a region of a canvas into PNG bytes
   */
  function sliceCanvasRegion(sourceCanvas, topOffset, sliceH, width) {
    return new Promise((resolve) => {
      try {
        const slice = document.createElement('canvas');
        slice.width = width;
        slice.height = sliceH;
        const ctx = slice.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, sliceH);
        ctx.drawImage(sourceCanvas, 0, topOffset, width, sliceH, 0, 0, width, sliceH);

        slice.toBlob((blob) => {
          if (!blob) return resolve(null);
          const reader = new FileReader();
          reader.onload = () => resolve(new Uint8Array(reader.result));
          reader.onerror = () => resolve(null);
          reader.readAsArrayBuffer(blob);
        }, 'image/png');
      } catch (_) {
        resolve(null);
      }
    });
  }

  /**
   * 1. Fetch Question Paper Data from NTSC
   */
  async function fetchTestPaperData(token, testId) {
    const payload = {
      id: String(testId),
      isMobile: false,
      take: 0,
      skip: 0,
      studentExamId: 0
    };

    const res = await proxyFetch('https://ntsc.narayanatalent.com/attemptexam-service/api/ExaminationHall/GetTestPaper', {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`GetTestPaper request failed (HTTP ${res.status})`);
    }

    const json = await res.json();
    const paper = json?.data;
    if (!paper || !Array.isArray(paper.subjectPapers) || paper.subjectPapers.length === 0) {
      throw new Error('No question paper data returned from NTSC. The test may not be accessible or session expired.');
    }
    return paper;
  }

  /**
   * 2. Fetch Result Analysis & Solutions from NTSC
   */
  async function fetchSolutionsData(token, testId, academicYear) {
    const year = Number(academicYear) || new Date().getFullYear();

    // Step A: Resolve examId from GetAppearedResult
    let examId = null;
    try {
      const appRes = await proxyFetch('https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetAppearedResult', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ id: Number(testId), academicYear: year })
      });

      if (appRes.ok) {
        const appJson = await appRes.json();
        const list = appJson?.data?.result;
        if (Array.isArray(list) && list.length > 0) {
          examId = list[list.length - 1]?.examId ?? null;
        }
      }
    } catch (_) {}

    // Fallback: try without academicYear filter
    if (!examId) {
      try {
        const appRes2 = await proxyFetch('https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetAppearedResult', {
          method: 'POST',
          headers: getAuthHeaders(token),
          body: JSON.stringify({ id: Number(testId) })
        });
        if (appRes2.ok) {
          const appJson2 = await appRes2.json();
          const list2 = appJson2?.data?.result;
          if (Array.isArray(list2) && list2.length > 0) {
            examId = list2[list2.length - 1]?.examId ?? null;
          }
        }
      } catch (_) {}
    }

    if (!examId) {
      throw new Error(`No appeared result found for Test #${testId}. You may need to attempt or submit the test first to access official solutions.`);
    }

    // Step B: Fetch full result analysis
    const analysisRes = await proxyFetch(`https://ntsc.narayanatalent.com/exam-service/api/ExaminationHall/GetResultAnalysis/${examId}`, {
      method: 'GET',
      headers: getAuthHeaders(token)
    });

    if (!analysisRes.ok) {
      throw new Error(`GetResultAnalysis failed (HTTP ${analysisRes.status})`);
    }

    const analysisJson = await analysisRes.json();
    const data = analysisJson?.data;
    if (!data || !data.result || !Array.isArray(data.result.questionData) || data.result.questionData.length === 0) {
      throw new Error('No solution data returned from NTSC for this test.');
    }

    return {
      testName: data.testName || `Test_${testId}`,
      examId: examId,
      totalMarks: data.result.totalMarks,
      totalCorrect: data.result.totalCorrect,
      totalInCorrect: data.result.totalInCorrect,
      questionData: data.result.questionData
    };
  }

  /**
   * 3. Build Questions PDF using pdf-lib
   */
  async function generateQuestionsPdf(paper, onProgress) {
    if (!window.PDFLib) {
      throw new Error('pdf-lib library not loaded in browser.');
    }
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const subFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Standard A4 portrait (points: 595 x 842)
    const PAGE_W = 595;
    const PAGE_H = 842;
    const MARGIN_X = 40;
    const MARGIN_TOP = 56;
    const MARGIN_BOTTOM = 44;
    const contentW = PAGE_W - 2 * MARGIN_X;
    const topY = PAGE_H - MARGIN_TOP;
    const bottomY = MARGIN_BOTTOM;
    const usableH = topY - bottomY;
    const Q_HEADER_H = 14;
    const Q_GAP = 10;

    const testTitle = paper.testName || 'Test Paper';

    // Count total questions for progress tracking
    let totalQuestionsCount = 0;
    for (const sp of paper.subjectPapers) {
      totalQuestionsCount += (sp.questions || []).length;
    }

    let processedCount = 0;
    let totalImages = 0;
    let failedImages = 0;

    let currentPage = null;
    let cursorY = topY;

    const newContentPage = (subjectName) => {
      const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      // Test name (top-left)
      page.drawText(testTitle, {
        x: MARGIN_X,
        y: PAGE_H - 32,
        size: 10,
        font: subFont,
        color: rgb(0.25, 0.25, 0.25)
      });
      // Subject (top-right)
      const subjText = subjectName || 'General';
      const sw = subFont.widthOfTextAtSize(subjText, 10);
      page.drawText(subjText, {
        x: PAGE_W - MARGIN_X - sw,
        y: PAGE_H - 32,
        size: 10,
        font: font,
        color: rgb(0.1, 0.1, 0.4)
      });
      // Thin header divider rule
      page.drawLine({
        start: { x: MARGIN_X, y: PAGE_H - 40 },
        end: { x: PAGE_W - MARGIN_X, y: PAGE_H - 40 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8)
      });
      return page;
    };

    const drawQHeader = (page, q, y) => {
      const qNumText = `Q${q.questionNo}`;
      page.drawText(qNumText, {
        x: MARGIN_X,
        y: y - 11,
        size: 10,
        font: font,
        color: rgb(0.1, 0.1, 0.4)
      });
      if (q.questionType) {
        const lblW = font.widthOfTextAtSize(qNumText, 10);
        page.drawText(`(${q.questionType})`, {
          x: MARGIN_X + lblW + 5,
          y: y - 11,
          size: 8,
          font: subFont,
          color: rgb(0.5, 0.5, 0.5)
        });
      }
    };

    for (const sp of paper.subjectPapers) {
      currentPage = newContentPage(sp.subjectName);
      cursorY = topY;

      for (const q of (sp.questions || [])) {
        processedCount++;
        if (typeof onProgress === 'function') {
          onProgress({
            phase: 'questions',
            current: processedCount,
            total: totalQuestionsCount,
            subject: sp.subjectName
          });
        }

        const imgData = await loadImageToCanvas(q.questionImage);
        if (!imgData) {
          failedImages++;
          const needed = Q_HEADER_H + 18 + Q_GAP;
          if (cursorY - needed < bottomY) {
            currentPage = newContentPage(sp.subjectName);
            cursorY = topY;
          }
          drawQHeader(currentPage, q, cursorY);
          cursorY -= needed;
          continue;
        }

        totalImages++;
        const imgW = imgData.width;
        const imgH = imgData.height;
        const scale = Math.min(1, contentW / imgW);
        const renderW = imgW * scale;
        const renderH = imgH * scale;
        const imgX = MARGIN_X + (contentW - renderW) / 2;

        if (renderH + Q_HEADER_H <= usableH) {
          // Fits within usable height
          const needed = Q_HEADER_H + renderH + Q_GAP;
          if (cursorY - needed < bottomY) {
            currentPage = newContentPage(sp.subjectName);
            cursorY = topY;
          }
          drawQHeader(currentPage, q, cursorY);
          const embedded = await pdfDoc.embedPng(imgData.bytes);
          currentPage.drawImage(embedded, {
            x: imgX,
            y: cursorY - Q_HEADER_H - renderH,
            width: renderW,
            height: renderH
          });
          cursorY -= needed;
        } else {
          // Tall image: slice across multiple pages
          if (cursorY < topY - 1) {
            currentPage = newContentPage(sp.subjectName);
            cursorY = topY;
          }

          let pixelTopOffset = 0;
          let isFirstSlice = true;
          while (pixelTopOffset < imgH) {
            const availRenderH = isFirstSlice ? usableH - Q_HEADER_H : usableH;
            const remainingRenderH = (imgH - pixelTopOffset) * scale;
            const sliceRenderH = Math.min(availRenderH, remainingRenderH);
            const pixelSliceH = Math.max(1, Math.min(Math.round(sliceRenderH / scale), imgH - pixelTopOffset));
            const actualSliceRenderH = pixelSliceH * scale;

            try {
              const sliceBytes = await sliceCanvasRegion(imgData.canvas, pixelTopOffset, pixelSliceH, imgW);
              if (!sliceBytes) break;
              const sliceEmb = await pdfDoc.embedPng(sliceBytes);

              if (!isFirstSlice) {
                currentPage = newContentPage(sp.subjectName);
                cursorY = topY;
              }

              const headerOffset = isFirstSlice ? Q_HEADER_H : 0;
              if (isFirstSlice) {
                drawQHeader(currentPage, q, cursorY);
              }
              currentPage.drawImage(sliceEmb, {
                x: imgX,
                y: cursorY - headerOffset - actualSliceRenderH,
                width: renderW,
                height: actualSliceRenderH
              });
              cursorY -= headerOffset + actualSliceRenderH;
            } catch (err) {
              console.warn('Image slicing error:', err);
              break;
            }
            pixelTopOffset += pixelSliceH;
            isFirstSlice = false;
          }
          cursorY -= Q_GAP;
        }
      }
    }

    // Page numbering on all pages
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    for (let i = 0; i < totalPages; i++) {
      const p = pages[i];
      const label = `${i + 1} / ${totalPages}`;
      const lw = subFont.widthOfTextAtSize(label, 8);
      p.drawText(label, {
        x: (PAGE_W - lw) / 2,
        y: 24,
        size: 8,
        font: subFont,
        color: rgb(0.55, 0.55, 0.55)
      });
    }

    if (typeof onProgress === 'function') {
      onProgress({ phase: 'saving', current: totalPages, total: totalPages });
    }

    const bytes = await pdfDoc.save();
    return {
      bytes,
      totalQuestions: totalQuestionsCount,
      totalImages,
      failedImages,
      totalPages
    };
  }

  /**
   * 4. Build Solutions PDF using pdf-lib (one image per page, arbitrary size)
   */
  async function generateSolutionsPdf(analysis, onProgress) {
    if (!window.PDFLib) {
      throw new Error('pdf-lib library not loaded in browser.');
    }
    const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const subFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const MARGIN_X = 40;
    const MARGIN_TOP = 56;
    const MARGIN_BOTTOM = 36;
    const HEADER_H = 16;
    const MAX_PAGE_W = 1400;

    const testTitle = analysis.testName || 'Solutions';
    const questions = analysis.questionData || [];
    const totalQuestions = questions.length;

    let processedCount = 0;
    let totalImages = 0;
    let failedImages = 0;

    // Group by subject preserving order
    const subjectOrder = [];
    const subjectMap = new Map();
    for (const q of questions) {
      const s = q.subjectName || 'General';
      if (!subjectMap.has(s)) {
        subjectMap.set(s, []);
        subjectOrder.push(s);
      }
      subjectMap.get(s).push(q);
    }

    const drawPageHeader = (page, pageW, pageH, subjectName) => {
      page.drawText(testTitle, {
        x: MARGIN_X,
        y: pageH - 28,
        size: 10,
        font: subFont,
        color: rgb(0.25, 0.25, 0.25)
      });
      const subjText = `${subjectName}  -  Solutions`;
      const sw = subFont.widthOfTextAtSize(subjText, 10);
      page.drawText(subjText, {
        x: pageW - MARGIN_X - sw,
        y: pageH - 28,
        size: 10,
        font: font,
        color: rgb(0.1, 0.1, 0.4)
      });
      page.drawLine({
        start: { x: MARGIN_X, y: pageH - 36 },
        end: { x: pageW - MARGIN_X, y: pageH - 36 },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8)
      });
    };

    const drawQHeader = (page, q, y) => {
      const qLabel = `Q${q.questionNo}`;
      page.drawText(qLabel, {
        x: MARGIN_X,
        y: y - 11,
        size: 10,
        font: font,
        color: rgb(0.1, 0.1, 0.4)
      });
      const lblW = font.widthOfTextAtSize(qLabel, 10);
      const xCursor = MARGIN_X + lblW + 8;
      const rightAns = String(q.rightAns != null ? q.rightAns : '-').trim();
      page.drawText(`Correct: ${rightAns}`, {
        x: xCursor,
        y: y - 11,
        size: 9,
        font: subFont,
        color: rgb(0.1, 0.5, 0.2)
      });
    };

    for (const subj of subjectOrder) {
      const qList = subjectMap.get(subj) || [];
      for (const q of qList) {
        processedCount++;
        if (typeof onProgress === 'function') {
          onProgress({
            phase: 'solutions',
            current: processedCount,
            total: totalQuestions,
            subject: subj
          });
        }

        const imgData = await loadImageToCanvas(q.solutionImage);
        if (!imgData) {
          failedImages++;
          const pageW = 500;
          const pageH = MARGIN_TOP + HEADER_H + 20 + MARGIN_BOTTOM;
          const p = pdfDoc.addPage([pageW, pageH]);
          drawPageHeader(p, pageW, pageH, subj);
          drawQHeader(p, q, pageH - MARGIN_TOP);
          continue;
        }

        totalImages++;
        const imgW = imgData.width;
        const imgH = imgData.height;
        const maxContentW = MAX_PAGE_W - 2 * MARGIN_X;
        const scale = imgW > maxContentW ? maxContentW / imgW : 1;
        const renderW = imgW * scale;
        const renderH = imgH * scale;

        const pageW = Math.max(renderW + 2 * MARGIN_X, 360);
        const pageH = MARGIN_TOP + HEADER_H + renderH + MARGIN_BOTTOM;

        const p = pdfDoc.addPage([pageW, pageH]);
        drawPageHeader(p, pageW, pageH, subj);

        const qHeaderY = pageH - MARGIN_TOP;
        drawQHeader(p, q, qHeaderY);

        const embedded = await pdfDoc.embedPng(imgData.bytes);
        const imgX = (pageW - renderW) / 2;
        const imgY = qHeaderY - HEADER_H - renderH;
        p.drawImage(embedded, {
          x: imgX,
          y: imgY,
          width: renderW,
          height: renderH
        });
      }
    }

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    for (let i = 0; i < totalPages; i++) {
      const p = pages[i];
      const pw = p.getWidth();
      const label = `${i + 1} / ${totalPages}`;
      const lw = subFont.widthOfTextAtSize(label, 8);
      p.drawText(label, {
        x: (pw - lw) / 2,
        y: 18,
        size: 8,
        font: subFont,
        color: rgb(0.55, 0.55, 0.55)
      });
    }

    if (typeof onProgress === 'function') {
      onProgress({ phase: 'saving', current: totalPages, total: totalPages });
    }

    const bytes = await pdfDoc.save();
    return {
      bytes,
      totalQuestions,
      totalImages,
      failedImages,
      totalPages
    };
  }

  /**
   * Top-level Download API
   */
  async function downloadTestPaperPdf(testId, testName, token, onProgress) {
    if (!testId) throw new Error('Test ID is required.');
    if (!token) throw new Error('Session token not found. Please log into the portal first.');

    if (typeof onProgress === 'function') {
      onProgress({ phase: 'fetching', message: `Fetching question paper for Test #${testId}...` });
    }

    const paper = await fetchTestPaperData(token, testId);
    const resolvedName = paper.testName || testName || `Test_${testId}`;

    if (typeof onProgress === 'function') {
      onProgress({ phase: 'generating', message: 'Generating Question Paper PDF...' });
    }

    const result = await generateQuestionsPdf(paper, onProgress);
    const filename = getSafeFilename(resolvedName, '');
    triggerDownload(result.bytes, filename);
    return { ...result, filename, testName: resolvedName };
  }

  async function downloadSolutionsPdf(testId, testName, token, academicYear, onProgress) {
    if (!testId) throw new Error('Test ID is required.');
    if (!token) throw new Error('Session token not found. Please log into the portal first.');

    if (typeof onProgress === 'function') {
      onProgress({ phase: 'fetching', message: `Fetching solutions for Test #${testId}...` });
    }

    const analysis = await fetchSolutionsData(token, testId, academicYear);
    const resolvedName = analysis.testName || testName || `Test_${testId}`;

    if (typeof onProgress === 'function') {
      onProgress({ phase: 'generating', message: 'Generating Solutions PDF...' });
    }

    const result = await generateSolutionsPdf(analysis, onProgress);
    const filename = getSafeFilename(resolvedName, '_Solutions');
    triggerDownload(result.bytes, filename);
    return { ...result, filename, testName: resolvedName };
  }

  // Export to window
  window.TestDownloader = {
    fetchTestPaperData,
    fetchSolutionsData,
    generateQuestionsPdf,
    generateSolutionsPdf,
    downloadTestPaperPdf,
    downloadSolutionsPdf,
    triggerDownload
  };
})(window);
