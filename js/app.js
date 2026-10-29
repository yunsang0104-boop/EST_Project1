/* 화면 이동과 입력 처리는 이 파일에서 관리합니다.
 * Mock 물량 산정식은 mock-data.js의 calculateQuantity에서 교체할 수 있습니다. */
(function () {
  'use strict';
  const mock = window.ESTIMATE_MOCK;
  const draftKey = 'irrigation-estimate-draft-v1';
  const priceKey = 'irrigation-material-prices-v1';
  const fundingFields = ['totalBudget'];
  const constructionFields = ['area', 'spec', 'spacing'].concat(fundingFields);
  const constructionInputs = ['estimateName', 'farmName', 'farmAddress', 'businessOperator', 'consultationNotes'].concat(constructionFields);
  const costFields = ['unitPrice', 'workers', 'days', 'dailyWage'];
  const $ = (id) => document.getElementById(id);
  const format = (value) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value);
  const money = (value) => format(value) + ' 원';
  // 1평 = 400/121 ㎡. 표시만 환산하며 물량·비용 계산에는 입력한 ㎡를 사용합니다.
  const pyeong = (area) => format(area * 121 / 400);
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
  const isBlank = (value) => value == null || (typeof value === 'string' && value.trim() === '');
  const budgetTotal = (data) => isBlank(data.totalBudget) ? 0 : number(data.totalBudget);
  const hasFunding = (data) => !isBlank(data.totalBudget);
  const selfFunding = (data) => budgetTotal(data) * 0.4;
  const subsidy = (data) => budgetTotal(data) - selfFunding(data);
  function migrateBudget(data) {
    if (data.totalBudget == null && [data.selfFunding, data.subsidy].some((value) => !isBlank(value))) {
      data.totalBudget = String((isBlank(data.selfFunding) ? 0 : number(data.selfFunding)) + (isBlank(data.subsidy) ? 0 : number(data.subsidy)));
    }
    return data;
  }
  migrateBudget(draft);

  function errorsFor(data, fields) {
    const errors = {};
    fields.forEach((key) => {
      if (key === 'spec') {
        if (!materialFor(data.spec)) errors.spec = '배관 규격을 선택해 주세요.';
        return;
      }
      if (fundingFields.includes(key) && isBlank(data[key])) return;
      const value = number(data[key]);
      if (!Number.isFinite(value)) errors[key] = '유효한 숫자를 입력해 주세요.';
      else if (key === 'area' || key === 'spacing') {
        if (value <= 0) errors[key] = '0보다 큰 값을 입력해 주세요.';
      } else if (value < 0) errors[key] = '0 이상의 값을 입력해 주세요.';
      else if (key === 'workers' && !Number.isSafeInteger(value)) errors[key] = '작업 인원은 0 이상의 정수로 입력해 주세요.';
      else if (key === 'totalBudget' && (!Number.isSafeInteger(value) || value > Number.MAX_SAFE_INTEGER / 100)) errors[key] = '계산 가능한 범위의 원 단위 정수로 입력해 주세요.';
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
    const estimateName = typeof draft.estimateName === 'string' ? draft.estimateName.trim().slice(0, 80) : '';
    const farmName = typeof draft.farmName === 'string' ? draft.farmName.trim().slice(0, 80) : '';
    const farmAddress = typeof draft.farmAddress === 'string' ? draft.farmAddress.trim().slice(0, 200) : '';
    const businessOperator = typeof draft.businessOperator === 'string' ? draft.businessOperator.trim().slice(0, 80) : '';
    const consultationNotes = typeof draft.consultationNotes === 'string' ? draft.consultationNotes.trim().slice(0, 2000) : '';
    const items = [
      ['사업명', estimateName || '미입력'],
      ['농가명', farmName || '미입력'],
      ['소재지주소', farmAddress || '미입력'],
      ['시공 면적', format(number(draft.area)) + ' ㎡ (약 ' + pyeong(number(draft.area)) + ' 평)'],
      ['배관 규격', material.spec + ' (예시)'],
      ['배관 간격', format(number(draft.spacing)) + ' m'],
      ['총사업비', hasFunding(draft) ? money(budgetTotal(draft)) : '미입력'],
      ['자부담금 (40%)', hasFunding(draft) ? money(selfFunding(draft)) : '미입력'],
      ['보조금 (60%)', hasFunding(draft) ? money(subsidy(draft)) : '미입력'],
      ['사업자', businessOperator || '미입력', 'text-summary'],
      ['상담내용', consultationNotes || '미입력', 'consultation-summary']
    ];
    items.forEach(([label, value, rowClass], index) => {
      const item = document.createElement('div');
      if (index === 0) item.className = 'estimate-name-summary';
      if (index === 2) item.className = 'farm-address-summary';
      if (rowClass) item.className = rowClass;
      const title = document.createElement('span');
      title.textContent = label;
      const content = document.createElement('strong');
      content.className = index <= 2 || rowClass ? 'estimate-name-value' : 'summary-value';
      content.textContent = value;
      item.append(title, content);
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
    function updateAreaPreview() {
      const area = number($('area').value);
      const valid = Number.isFinite(area) && area > 0;
      $('area-pyeong').textContent = valid
        ? '약 ' + pyeong(area) + ' 평 (1평 ≈ 3.3058 ㎡ · 소수점 최대 2자리 반올림)'
        : '면적을 입력하면 평수도 함께 표시됩니다. (1평 ≈ 3.3058 ㎡)';
      $('area-pyeong').classList.toggle('numeric-preview', valid);
    }
    populate(constructionInputs);
    updateAreaPreview();
    function updateBudgetPreview() {
      // number 입력창은 숫자로 완성되지 않은 입력도 빈 문자열로 반환할 수 있습니다.
      const errors = errorsFor(draft, fundingFields);
      fundingFields.forEach((key) => {
        if ($(key).validity.badInput) errors[key] = '유효한 숫자를 입력해 주세요.';
        $(key + '-error').textContent = errors[key] || '';
        $(key).setAttribute('aria-invalid', errors[key] ? 'true' : 'false');
      });
      $('self-funding').textContent = Object.keys(errors).length ? '금액 확인 필요' : hasFunding(draft) ? money(selfFunding(draft)) : '미입력';
      $('subsidy-amount').textContent = Object.keys(errors).length ? '금액 확인 필요' : hasFunding(draft) ? money(subsidy(draft)) : '미입력';
      return errors;
    }
    updateBudgetPreview();
    function persistConstruction() {
      collect(constructionInputs);
      updateAreaPreview();
      updateBudgetPreview();
    }
    $('construction-form').addEventListener('input', persistConstruction);
    $('construction-form').addEventListener('change', persistConstruction);
    $('construction-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const saved = collect(constructionInputs);
      const errors = Object.assign(errorsFor(draft, constructionFields), updateBudgetPreview());
      if (showErrors(errors, constructionFields) && saved) window.location.href = 'costs.html';
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
    draft = migrateBudget(readStorage('sessionStorage', draftKey));
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
    $('print-estimate').addEventListener('click', async () => {
      if (window.estimateAttachmentsReady && !await window.estimateAttachmentsReady) return;
      if (renderResult()) window.print();
    });
  }
  // 브라우저 뒤로/앞으로 이동 시 캐시된 화면도 최신 작업값으로 갱신합니다.
  window.addEventListener('pageshow', (event) => { if (event.persisted) window.location.reload(); });
  if (storageFailed) storageNotice();
})();
