document.addEventListener("DOMContentLoaded", async function() {
  const visor = document.getElementById("pdf-visor");
  if (!visor) return;
  const pdfUrl = visor.dataset.url;
  if (!pdfUrl) return;

  const url = pdfUrl;
  const pdfjsLib = window['pdfjs-dist/build/pdf'];
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

  let pdfDoc = null,
      pageNum = 1,
      pageIsRendering = false,
      pageNumIsPending = null;

  const scale = 1.5,
        canvas = document.getElementById('pdf-render'),
        ctx = canvas.getContext('2d');

  const renderPage = num => {
    pageIsRendering = true;
    pdfDoc.getPage(num).then(page => {
      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderCtx = { canvasContext: ctx, viewport: viewport };
      page.render(renderCtx).promise.then(() => {
        pageIsRendering = false;
        if (pageNumIsPending !== null) {
          renderPage(pageNumIsPending);
          pageNumIsPending = null;
        }
      });

      document.getElementById('pdf-page-info').textContent = \P�gina \ de \\;
    });
  };

  const queueRenderPage = num => {
    if (pageIsRendering) {
      pageNumIsPending = num;
    } else {
      renderPage(num);
    }
  };

  const showPrevPage = () => {
    if (pageNum <= 1) return;
    pageNum--;
    queueRenderPage(pageNum);
  };

  const showNextPage = () => {
    if (pageNum >= pdfDoc.numPages) return;
    pageNum++;
    queueRenderPage(pageNum);
  };

  pdfjsLib.getDocument(url).promise.then(pdfDoc_ => {
    pdfDoc = pdfDoc_;
    document.getElementById('pdf-page-info').textContent = \P�gina \ de \\;
    renderPage(pageNum);
  }).catch(err => {
    visor.innerHTML = '<p style="color:red;padding:2rem;">Error cargando PDF: ' + err.message + '</p>';
  });

  document.getElementById('pdf-prev').addEventListener('click', showPrevPage);
  document.getElementById('pdf-next').addEventListener('click', showNextPage);
});
