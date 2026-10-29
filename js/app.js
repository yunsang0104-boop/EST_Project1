/* 화면 이동과 입력 처리는 이 파일에서 관리합니다.
 * Mock 물량 산정식은 mock-data.js의 calculateQuantity에서 교체할 수 있습니다. */
(function () {
  'use strict';
  const mock = window.ESTIMATE_MOCK;
  const draftKey = 'irrigation-estimate-draft-v1';
  const priceKey = 'irrigation-material-prices-v1';
  const constructionFields = ['area', 'spec', 'spacing'];
  const costFields = ['unitPrice', 'workers', 'days', 'dailyWage'];
  const $ = (id) => document.getElementById(id);
  const format = (value) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value);
  const money = (value) => format(value) + ' 원';
  let storageFailed = false;

  function storageNotice() {
    if ($('storage-status')) $('storage-status').textContent = '브라우저 저장소를 사용할 수 없습니다. 저장소 사용을 허용한 후 다시 진행해 주세요. 입력값을 화면 사이에 유지하려면 브라우저 저장소가 필요합니다.';
  }
  function readStorage(type, key) {
    try {
      const value = JSON.parse(window[type].getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (error) {
      // 손상된 저장값은 사용하지 않고, 접근 제한이면 안내합니다.
      if (!(error instanceof SyntaxError)) { storageFailed = true; storageNotice(); }
      return {};
    }
  }
  function writeStorage(type, key, value) {
    try { window[type].setItem(key, JSON.stringify(value)); return true; }
    catch (error) { storageFailed = true; storageNotice(); return false; }
  }
  let draft = readStorage('sessionStorage', draftKey);
  let prices = readStorage('localStorage', priceKey);
  const materialFor = (spec) => mock.materials.find((item) => item.id === spec);

  function number(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return NaN;
    if (String(value).trim() === '') return NaN;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  function errorsFor(data, fields) {
    const errors = {};
    fields.forEach((key) => {
      if (key === 'spec') {
        if (!materialFor(data.spec)) errors.spec = '배관 규격을 선택해 주세요.';
        return;
      }
      const value = number(data[key]);
      if (!Number.isFinite(value)) errors[key] = '유효한 숫자를 입력해 주세요.';
      else if (key === 'area' || key === 'spacing') {
        if (value <= 0) errors[key] = '0보다 큰 값을 입력해 주세요.';
      } else if (value < 0) errors[key] = '0 이상의 값을 입력해 주세요.';
      else if (key === 'workers' && !Number.isSafeInteger(value)) errors[key] = '작업 인원은 0 이상의 정수로 입력해 주세요.';
    });
    return errors;
  }
  function showErrors(errors, fields) {
    fields.forEach((key) => {
      $(key + '-error').textContent = errors[key] || '';
      $(key).setAttribute('aria-invalid', errors[key] ? 'true' : 'false');
    });
    const first = Object.keys(errors)[0];
    if (first) $(first).focus();
    return !first;
  }
  function collect(fields) {
    fields.forEach((key) => { draft[key] = $(key).value; });
    return writeStorage('sessionStorage', draftKey, draft);
  }
  function populate(fields) {
    fields.forEach((key) => { $(key).value = draft[key] == null ? '' : draft[key]; });
  }
  function summary() {
    const material = materialFor(draft.spec);
    const container = $('construction-summary');
    container.replaceChildren();
    [['시공 면적', format(number(draft.area)) + ' ㎡'], ['배관 규격', material.spec + ' (예시)'], ['배관 간격', format(number(draft.spacing)) + ' m']].forEach(([label, value]) => {
      const item = document.createElement('div');
      const title = document.createElement('span');
      title.textContent = label;
      item.append(title, document.createTextNode(value));
      container.append(item);
    });
  }
  function showContent(id, valid) {
    $('missing-state').hidden = valid;
    $(id).hidden = !valid;
  }

  // 숫자 검증과 계산을 공통 관리하며 표시용 반올림은 계산에 적용하지 않습니다.
  function calculate(data) {
    if (Object.keys(errorsFor(data, constructionFields.concat(costFields))).length) return null;
    const quantity = mock.calculateQuantity(number(data.area), number(data.spacing));
    const materialCost = quantity * number(data.unitPrice);
    const laborCost = number(data.workers) * number(data.days) * number(data.dailyWage);
    const total = materialCost + laborCost;
    // 극단적인 입력으로 발생한 무한대 및 계산 범위 초과를 차단합니다.
    if (![quantity, materialCost, laborCost, total].every((value) => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER) || quantity === 0) return null;
    return { quantity, materialCost, laborCost, total };
  }

  function initConstruction() {
    mock.materials.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.spec + ' · 예시 규격';
      $('spec').append(option);
    });
    populate(constructionFields);
    $('construction-form').addEventListener('input', () => collect(constructionFields));
    $('construction-form').addEventListener('change', () => collect(constructionFields));
    $('construction-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const saved = collect(constructionFields);
      if (showErrors(errorsFor(draft, constructionFields), constructionFields) && saved) window.location.href = 'costs.html';
    });
  }

  function initCosts() {
    const valid = !Object.keys(errorsFor(draft, constructionFields)).length;
    showContent('costs-content', valid);
    if (!valid) return;
    summary();
    const material = materialFor(draft.spec);
    $('material-name').textContent = material.name;
    $('material-spec').textContent = material.spec;
    const savedPrice = number(prices[material.id]);
    const hasSavedPrice = Number.isFinite(savedPrice) && savedPrice >= 0;
    if (draft.priceSpec !== material.id || draft.unitPrice == null) {
      draft.unitPrice = String(hasSavedPrice ? savedPrice : material.price);
      draft.priceSpec = material.id;
    }
    $('price-source').textContent = hasSavedPrice ? '이 브라우저에 저장한 단가입니다. 필요하면 수정하세요.' : '실제 가격이 아닌 시연용 예시 단가입니다. 필요하면 수정하세요.';
    populate(costFields);
    writeStorage('sessionStorage', draftKey, draft);
    function persistCosts() {
      const saved = collect(costFields);
      if (!errorsFor(draft, ['unitPrice']).unitPrice) {
        prices[material.id] = number(draft.unitPrice);
        writeStorage('localStorage', priceKey, prices);
      }
      return saved;
    }
    $('costs-form').addEventListener('input', persistCosts);
    $('costs-form').addEventListener('change', persistCosts);
    $('costs-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const saved = persistCosts();
      $('calculation-error').textContent = '';
      if (!showErrors(errorsFor(draft, costFields), costFields)) return;
      if (!calculate(draft)) {
        $('calculation-error').textContent = '계산 가능한 범위를 벗어났습니다. 시공 면적·간격과 비용 입력값을 확인해 주세요.';
        return;
      }
      if (saved) window.location.href = 'result.html';
    });
  }

  function renderResult() {
    draft = readStorage('sessionStorage', draftKey);
    const result = draft.priceSpec === draft.spec ? calculate(draft) : null;
    showContent('result-content', Boolean(result));
    if (!result) return false;
    summary();
    const material = materialFor(draft.spec);
    const values = {
      'total-cost': money(result.total), 'summary-material': money(result.materialCost),
      'summary-labor': money(result.laborCost), 'pipe-length': format(result.quantity) + ' m',
      'result-material-name': material.name, 'result-spec': material.spec,
      'result-price': money(number(draft.unitPrice)) + '/m',
      'result-quantity': format(result.quantity) + ' m', 'material-cost': money(result.materialCost),
      'material-subtotal': money(result.materialCost), 'labor-subtotal': money(result.laborCost),
      'labor-equation': format(number(draft.workers)) + ' 명 × ' + format(number(draft.days)) + ' 일 × ' + money(number(draft.dailyWage))
    };
    Object.entries(values).forEach(([id, value]) => { $(id).textContent = value; });
    return true;
  }

  const page = document.body.dataset.page;
  if (page === 'construction') initConstruction();
  if (page === 'costs') initCosts();
  if (page === 'result') {
    renderResult();
    $('recalculate').addEventListener('click', () => {
      if (renderResult()) $('result-status').textContent = '현재 입력값으로 견적을 다시 계산했습니다.';
    });
  }
  // 브라우저 뒤로/앞으로 이동 시 캐시된 화면도 최신 작업값으로 갱신합니다.
  window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });
  if (storageFailed) storageNotice();
})();
