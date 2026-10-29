/* 도면은 현재 견적 탭의 식별자로 구분해 IndexedDB에 보관합니다. */
(function () {
  'use strict';
  const groups = Array.from(document.querySelectorAll('[data-attachment]'));
  const resultSection = document.getElementById('result-attachments');
  if (!groups.length && !resultSection) return;
  const titles = { installation: '설치도면', address: '관공서 주소 지도면' };
  const urls = new Set();
  let database;
  let pending = 0;
  const form = document.getElementById('construction-form');
  const submit = form && form.querySelector('[type="submit"]');
  const print = document.getElementById('print-estimate');

  function setBusy(change) {
    pending += change;
    if (submit) submit.disabled = pending > 0;
  }
  if (form) form.addEventListener('submit', (event) => {
    if (pending) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('irrigation-estimate-attachments-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('files');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('저장소를 열 수 없습니다.'));
    });
  }
  function stored(key, method, value) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('files', method === 'get' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('files');
      const request = method === 'put' ? store.put(value, key) : store[method](key);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('저장이 취소되었습니다.'));
    });
  }
  async function imageFor(file, title) {
    const url = URL.createObjectURL(file);
    urls.add(url);
    const image = new Image();
    image.alt = title;
    image.src = url;
    try { await image.decode(); }
    catch (error) { URL.revokeObjectURL(url); urls.delete(url); throw error; }
    return image;
  }
  function clearPreview(preview) {
    preview.querySelectorAll('img').forEach((image) => {
      URL.revokeObjectURL(image.src);
      urls.delete(image.src);
    });
    preview.replaceChildren();
  }
  window.addEventListener('pagehide', () => {
    urls.forEach((url) => URL.revokeObjectURL(url));
    if (database) database.close();
  });

  window.estimateAttachmentsReady = (async () => {
    setBusy(1);
    if (print) print.disabled = true;
    groups.forEach((group) => { group.querySelector('input').disabled = true; });
    try {
      const sessionKey = 'irrigation-attachment-session-v1';
      let session = sessionStorage.getItem(sessionKey);
      if (!session && !groups.length) return true;
      if (!session) {
        session = crypto.randomUUID();
        sessionStorage.setItem(sessionKey, session);
      }
      database = await openDatabase();
      database.onversionchange = () => database.close();
      if (resultSection) {
        for (const [kind, title] of Object.entries(titles)) {
          const file = await stored(session + ':' + kind, 'get');
          if (!file) continue;
          const figure = document.createElement('figure');
          figure.className = 'attachment-figure';
          const caption = document.createElement('figcaption');
          caption.textContent = title + ' · ' + file.name;
          figure.append(caption, await imageFor(file, title));
          document.getElementById('attachment-images').append(figure);
          resultSection.hidden = false;
        }
      }
      for (const group of groups) {
        const kind = group.dataset.attachment;
        const input = group.querySelector('input');
        const status = group.querySelector('[role="status"]');
        const preview = group.querySelector('.attachment-preview');
        const remove = group.querySelector('button');
        const key = session + ':' + kind;
        const file = await stored(key, 'get');
        if (file) {
          preview.append(await imageFor(file, titles[kind]));
          status.textContent = file.name;
          remove.hidden = false;
        }
        input.addEventListener('change', async () => {
          const selected = input.files[0];
          if (!selected) return;
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(selected.type) || selected.size > 10 * 1024 * 1024) {
            status.textContent = '10MB 이하의 PNG, JPG, WEBP 이미지를 선택해 주세요.';
            input.value = '';
            return;
          }
          setBusy(1);
          input.disabled = remove.disabled = true;
          status.textContent = '도면 저장 중…';
          let image;
          try {
            image = await imageFor(selected, titles[kind]);
            await stored(key, 'put', selected);
            clearPreview(preview);
            preview.append(image);
            remove.hidden = false;
            status.textContent = selected.name + ' · 저장 완료';
          } catch (error) {
            if (image) { URL.revokeObjectURL(image.src); urls.delete(image.src); }
            status.textContent = '이미지를 저장하지 못했습니다. 파일과 브라우저 저장 공간을 확인해 주세요. 기존 첨부는 유지됩니다.';
          } finally {
            input.value = '';
            input.disabled = remove.disabled = false;
            setBusy(-1);
          }
        });
        remove.addEventListener('click', async () => {
          setBusy(1);
          input.disabled = remove.disabled = true;
          try {
            await stored(key, 'delete');
            clearPreview(preview);
            remove.hidden = true;
            status.textContent = '첨부 도면을 삭제했습니다.';
          } catch (error) { status.textContent = '삭제하지 못했습니다. 다시 시도해 주세요.'; }
          finally { input.disabled = remove.disabled = false; setBusy(-1); }
        });
      }
      groups.forEach((group) => { group.querySelector('input').disabled = false; });
      return true;
    } catch (error) {
      groups.forEach((group) => {
        group.querySelector('[role="status"]').textContent = '첨부 도면을 불러오지 못했습니다. 브라우저 저장소 사용을 허용하고 새로고침해 주세요.';
      });
      if (resultSection) {
        resultSection.hidden = false;
        document.getElementById('attachment-status').textContent = '도면을 불러오지 못해 출력을 준비할 수 없습니다. 브라우저 저장소를 확인하고 새로고침해 주세요.';
      }
      return false;
    } finally {
      setBusy(-1);
      if (print) print.disabled = false;
    }
  })();
})();
