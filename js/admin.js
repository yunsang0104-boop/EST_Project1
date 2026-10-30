/* 관리자 화면 구성 전용입니다. DB 조회·변경과 관리자 권한 판정은 수행하지 않습니다.
 * 기존 견적 계산·도면·출력 스크립트를 재사용하며 사용자 자료를 수정하지 않습니다. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let draft = null;
  try {
    const stored = JSON.parse(sessionStorage.getItem('irrigation-estimate-draft-v1') || 'null');
    if (stored && typeof stored === 'object' && !Array.isArray(stored) && Object.keys(stored).length) draft = stored;
  } catch (error) {
    $('admin-list-status').textContent = '현재 견적을 불러오지 못했습니다. 브라우저 저장소를 확인해 주세요.';
  }
  const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : '미입력';

  function renderList() {
    const query = $('admin-query').value.trim().toLocaleLowerCase('ko-KR');
    const matches = draft && [draft.estimateName, draft.farmName, draft.businessOperator].some((value) => text(value).toLocaleLowerCase('ko-KR').includes(query));
    $('admin-records').replaceChildren();
    $('admin-count').textContent = matches ? '1' : '0';
    $('admin-list-empty').hidden = Boolean(matches);
    if (!matches) {
      $('admin-list-empty').querySelector('h3').textContent = draft && query ? '검색 결과가 없습니다.' : '확인할 견적이 없습니다.';
      $('admin-list-empty').querySelector('p').textContent = draft && query ? '사업명, 농가명 또는 시행관공서를 다시 확인해 주세요.' : '이 탭에서 사용자 화면으로 이동해 작성한 견적을 확인할 수 있습니다.';
      return;
    }
    const row = document.createElement('tr');
    const total = $('result-content').hidden ? '금액 확인 필요' : $('total-cost').textContent;
    for (const value of [text(draft.estimateName), text(draft.farmName), text(draft.businessOperator), '미연결', total]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    const action = document.createElement('td');
    const link = document.createElement('a');
    link.href = '#detail';
    link.className = 'button secondary';
    link.textContent = '상세 보기';
    action.append(link);
    row.append(action);
    $('admin-records').append(row);
  }

  async function navigate() {
    const requested = window.location.hash.slice(1);
    const menu = ['list', 'detail', 'attachments', 'print'].includes(requested) ? requested : 'list';
    $('admin-list').hidden = menu !== 'list';
    $('admin-detail').hidden = menu === 'list';
    $('admin-drawing-empty').hidden = true;
    document.querySelectorAll('[data-menu]').forEach((link) => {
      if (link.dataset.menu === menu) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (menu === 'list') return;
    if (menu === 'attachments' || menu === 'print') {
      if (window.estimateAttachmentsReady) await window.estimateAttachmentsReady;
      // 도면을 기다리는 사이 다른 메뉴를 선택한 경우에는 이동하지 않습니다.
      if (window.location.hash.slice(1) !== menu) return;
      if (menu === 'attachments') {
        const missing = $('result-attachments').hidden;
        $('admin-drawing-empty').hidden = !missing;
        (missing ? $('admin-drawing-empty') : $('result-attachments')).scrollIntoView({ behavior: 'auto', block: 'start' });
      } else if (!$('result-content').hidden) {
        $('print-estimate').click();
      }
    }
  }

  $('admin-search').addEventListener('submit', (event) => { event.preventDefault(); renderList(); });
  $('admin-query').addEventListener('input', renderList);
  $('admin-reset').addEventListener('click', () => { $('admin-query').value = ''; renderList(); $('admin-query').focus(); });
  $('admin-refresh').addEventListener('click', () => window.location.reload());
  // 같은 출력 메뉴를 다시 눌러도 미리보기를 열 수 있습니다.
  document.querySelector('[data-menu="print"]').addEventListener('click', () => {
    if (window.location.hash === '#print') navigate();
  });
  window.addEventListener('hashchange', navigate);
  renderList();
  navigate();
})();
