/* 기존 인쇄 스타일을 재사용해 출력 전 확인 창을 보여줍니다.
 * 미리보기에는 현재 견적과 첨부 이미지만 복사하며 원본 입력값은 변경하지 않습니다. */
(function () {
  'use strict';
  const dialog = document.getElementById('print-preview');
  if (!dialog) return;
  const frame = document.getElementById('preview-frame');
  const printButton = document.getElementById('confirm-print');
  const status = document.getElementById('preview-status');
  let loading = false;

  function buildDocument() {
    const preview = document.implementation.createHTMLDocument('견적서 출력');
    preview.documentElement.lang = 'ko';
    preview.body.dataset.page = 'result';
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('css/style.css', window.location.href).href;
    preview.head.append(stylesheet);

    // 인쇄용 규칙을 미리보기 화면에도 적용해 스타일이 따로 달라지지 않게 합니다.
    const printRules = [];
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (rule.type === CSSRule.MEDIA_RULE && rule.conditionText === 'print') {
          printRules.push(...Array.from(rule.cssRules, (item) => item.cssText));
        }
      }
    }
    const style = document.createElement('style');
    style.textContent = printRules.join('\n') + '\n' +
      '@media screen { body[data-page="result"] { padding: 12mm; } }';
    preview.head.append(style);

    const main = document.createElement('main');
    main.append(document.querySelector('.page-heading').cloneNode(true));
    const content = document.getElementById('result-content').cloneNode(true);
    content.querySelectorAll('.result-actions, .storage-status').forEach((element) => element.remove());
    main.append(content);
    preview.body.append(main);
    return '<!doctype html>\n' + preview.documentElement.outerHTML;
  }

  async function open() {
    if (loading || dialog.open) return;
    loading = true;
    printButton.disabled = true;
    frame.hidden = true;
    status.textContent = '견적서와 첨부 도면을 준비하고 있습니다.';
    dialog.showModal();
    document.body.classList.add('preview-open');
    try {
      const source = buildDocument();
      await new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          frame.onload = null;
          reject(new Error('미리보기 시간 초과'));
        }, 15000);
        frame.onload = () => { window.clearTimeout(timer); frame.onload = null; resolve(); };
        frame.srcdoc = source;
      });
      await Promise.all(Array.from(frame.contentDocument.images, (image) => image.decode()));
      // 첨부 도면까지 세로로 확인할 수 있게 프레임 높이를 맞춥니다.
      frame.hidden = false;
      frame.style.height = Math.max(frame.contentDocument.documentElement.scrollHeight, 1123) + 'px';
      printButton.disabled = false;
      status.textContent = '내용을 확인한 후 출력하기를 눌러 주세요. 작은 화면에서는 좌우로 이동해 볼 수 있습니다.';
    } catch (error) {
      status.textContent = '미리보기를 준비하지 못했습니다. 견적서로 돌아간 뒤 다시 시도해 주세요.';
    } finally {
      loading = false;
    }
  }

  document.getElementById('close-preview').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    document.body.classList.remove('preview-open');
    document.getElementById('print-estimate').focus();
  });
  printButton.addEventListener('click', () => {
    if (printButton.disabled) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  });
  window.estimatePrintPreview = { open };
})();
