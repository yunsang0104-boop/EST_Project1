/* 기존 인쇄 스타일을 재사용해 출력 전 확인 창을 보여줍니다.
 * 미리보기에는 현재 견적과 첨부 이미지만 복사하며 원본 입력값은 변경하지 않습니다. */
(function () {
  'use strict';
  const dialog = document.getElementById('print-preview');
  if (!dialog) return;
  const frame = document.getElementById('preview-frame');
  const printButton = document.getElementById('confirm-print');
  const status = document.getElementById('preview-status');
  const selection = document.getElementById('preview-type');
  const titles = { all: '견적 조건 및 견적서', conditions: '견적 조건', estimate: '견적서' };
  let loading = false;

  function buildDocument() {
    const type = selection.value;
    const preview = document.implementation.createHTMLDocument(titles[type] + ' 출력');
    preview.documentElement.lang = 'ko';
    preview.body.dataset.page = 'result';
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('css/style.css', document.baseURI).href;
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
    const heading = document.querySelector('.page-heading').cloneNode(true);
    heading.querySelector('h1').textContent = titles[type];
    if (type === 'conditions') heading.querySelector('p:last-child').textContent = '사업 정보, 시공 면적, 사업비, 상담내용 및 첨부 도면입니다.';
    main.append(heading);
    const content = document.getElementById('result-content').cloneNode(true);
    content.querySelectorAll('.result-actions, .storage-status').forEach((element) => element.remove());
    if (type === 'conditions') {
      Array.from(content.children).forEach((element) => {
        if (!element.matches('.condition-strip, #result-attachments')) element.remove();
      });
    } else if (type === 'estimate') {
      content.querySelectorAll('.condition-strip, #result-attachments').forEach((element) => element.remove());
      // 견적을 구분할 사업명은 견적서에도 표시합니다.
      const name = document.querySelector('#construction-summary .estimate-name-summary');
      if (name) heading.append(name.cloneNode(true));
    }
    main.append(content);
    preview.body.append(main);
    return '<!doctype html>\n' + preview.documentElement.outerHTML;
  }

  async function renderPreview() {
    if (loading) return;
    loading = true;
    selection.disabled = true;
    printButton.disabled = true;
    frame.hidden = true;
    status.textContent = titles[selection.value] + ' 미리보기를 준비하고 있습니다.';
    printButton.textContent = titles[selection.value] + ' 출력';
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
      frame.style.height = Math.max(frame.contentDocument.body.scrollHeight, frame.contentDocument.documentElement.scrollHeight, 1123) + 'px';
      printButton.disabled = false;
      status.textContent = '내용을 확인한 후 출력하기를 눌러 주세요. 작은 화면에서는 좌우로 이동해 볼 수 있습니다.';
    } catch (error) {
      status.textContent = '미리보기를 준비하지 못했습니다. 견적서로 돌아간 뒤 다시 시도해 주세요.';
    } finally {
      loading = false;
      selection.disabled = false;
    }
  }

  function open() {
    if (loading || dialog.open) return;
    dialog.showModal();
    document.body.classList.add('preview-open');
    renderPreview();
  }

  selection.addEventListener('change', renderPreview);

  function restorePage() {
    document.body.classList.remove('preview-open');
    document.getElementById('print-estimate').focus();
  }
  document.getElementById('close-preview').addEventListener('click', () => {
    dialog.close();
    restorePage();
  });
  dialog.addEventListener('close', restorePage);
  printButton.addEventListener('click', () => {
    if (printButton.disabled) return;
    frame.contentWindow.focus();
    frame.contentWindow.print();
  });
  window.estimatePrintPreview = { open };
})();
