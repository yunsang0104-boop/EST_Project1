/* 사업 정보, 직접 작성한 견적 품목과 인건비를 관리합니다. */
(function () {
  'use strict';
  const draftKey = 'irrigation-estimate-draft-v1';
  const fundingFields = ['totalBudget'];
  const constructionFields = ['area'].concat(fundingFields);
  const constructionInputs = ['estimateName', 'farmName', 'farmAddress', 'businessOperator', 'consultationNotes'].concat(constructionFields);
  const costFields = ['workers', 'days', 'dailyWage'];
  const itemFields = ['name', 'unit', 'quantity', 'unitPrice'];
  const emptyItem = () => ({ name: '', unit: '개', quantity: '', unitPrice: '' });
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
  // 이전 견적의 계산된 수량과 단가를 직접 편집할 수 있는 품목으로 옮깁니다.
  function migrateItems(data) {
    if (!Array.isArray(data.items)) {
      const material = window.ESTIMATE_MOCK && window.ESTIMATE_MOCK.materials.find((item) => item.id === data.spec);
      const quantity = number(data.area) / number(data.spacing);
      if (material && quantity > 0 && Number.isFinite(quantity) && number(data.unitPrice) >= 0) {
        data.items = [{ name: material.name, unit: material.unit, quantity: String(quantity), unitPrice: String(data.unitPrice) }];
      }
    }
    return data;
  }
  migrateItems(draft);

  function errorsFor(data, fields) {
    const errors = {};
    fields.forEach((key) => {
      // 1단계 항목은 선택 입력입니다. 입력한 숫자의 유효성은 유지합니다.
      if (constructionFields.includes(key) && isBlank(data[key])) return;
      const value = number(data[key]);
      if (!Number.isFinite(value)) errors[key] = '유효한 숫자를 입력해 주세요.';
      else if (key === 'area') {
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
      ['시공 면적', isBlank(draft.area) ? '미입력' : format(number(draft.area)) + ' ㎡ (약 ' + pyeong(number(draft.area)) + ' 평)'],
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

  function itemErrors(item) {
    const errors = {};
    if (!item || typeof item !== 'object') return { name: '품목 정보를 확인해 주세요.' };
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 80) errors.name = '품목명을 80자 이내로 입력해 주세요.';
    if (typeof item.unit !== 'string' || !item.unit.trim() || item.unit.length > 20) errors.unit = '단위를 20자 이내로 입력해 주세요.';
    const quantity = number(item.quantity);
    const price = number(item.unitPrice);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > Number.MAX_SAFE_INTEGER) errors.quantity = '수량은 계산 가능한 범위의 0보다 큰 숫자로 입력해 주세요.';
    if (!Number.isFinite(price) || price < 0 || price > Number.MAX_SAFE_INTEGER) errors.unitPrice = '단가는 계산 가능한 범위의 0 이상 숫자로 입력해 주세요.';
    if (!Object.keys(errors).length && (!Number.isFinite(quantity * price) || quantity * price > Number.MAX_SAFE_INTEGER)) errors.unitPrice = '품목 금액이 계산 가능한 범위를 초과했습니다.';
    return errors;
  }

  // 화면과 인쇄에서 같은 수량 × 단가 합산 결과를 사용합니다.
  function calculate(data) {
    if (Object.keys(errorsFor(data, constructionFields.concat(costFields))).length) return null;
    if (!Array.isArray(data.items) || !data.items.length || data.items.some((item) => Object.keys(itemErrors(item)).length)) return null;
    const amounts = data.items.map((item) => number(item.quantity) * number(item.unitPrice));
    const materialCost = amounts.reduce((sum, amount) => sum + amount, 0);
    const laborCost = number(data.workers) * number(data.days) * number(data.dailyWage);
    const total = materialCost + laborCost;
    // 극단적인 입력으로 발생한 무한대 및 계산 범위 초과를 차단합니다.
    if (![materialCost, laborCost, total].every((value) => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER)) return null;
    return { amounts, materialCost, laborCost, total };
  }

  function initConstruction() {
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
      if ($('area').validity.badInput) errors.area = '유효한 숫자를 입력해 주세요.';
      if (showErrors(errors, constructionFields) && saved) window.location.href = 'costs.html';
    });
  }

  function initCosts() {
    const valid = !Object.keys(errorsFor(draft, constructionFields)).length;
    showContent('costs-content', valid);
    if (!valid) return;
    summary();
    if (!Array.isArray(draft.items) || !draft.items.length) draft.items = [emptyItem()];
    costFields.forEach((key) => { if (draft[key] == null) draft[key] = '0'; });
    populate(costFields);
    function persistCosts() {
      draft.items = Array.from($('estimate-items').children, (row) => {
        const item = {};
        itemFields.forEach((key) => { item[key] = row.querySelector('[data-field="' + key + '"]').value; });
        return item;
      });
      return collect(costFields);
    }
    function updateAmounts(showValidation) {
      let sum = 0;
      let validItems = true;
      let firstInvalid;
      Array.from($('estimate-items').children).forEach((row, index) => {
        const item = draft.items[index];
        const errors = itemErrors(item);
        itemFields.forEach((key) => {
          const input = row.querySelector('[data-field="' + key + '"]');
          if (input.validity.badInput) errors[key] = '유효한 숫자를 입력해 주세요.';
          if (showValidation || input.getAttribute('aria-invalid') === 'true') input.setAttribute('aria-invalid', errors[key] ? 'true' : 'false');
        });
        const invalid = Object.keys(errors).length > 0;
        if (invalid) {
          validItems = false;
          if (!firstInvalid) firstInvalid = row.querySelector('[data-field="' + Object.keys(errors)[0] + '"]');
        }
        if (showValidation || !invalid) row.querySelector('.item-error').textContent = Object.values(errors).join(' ');
        const amount = invalid ? null : number(item.quantity) * number(item.unitPrice);
        row.querySelector('.item-amount').textContent = amount == null ? '—' : money(amount);
        if (amount != null) sum += amount;
      });
      $('items-subtotal').textContent = validItems && sum <= Number.MAX_SAFE_INTEGER ? money(sum) : '품목을 확인해 주세요.';
      return firstInvalid;
    }
    function renderItems() {
      $('estimate-items').replaceChildren();
      draft.items.forEach((item, index) => {
        const fragment = $('estimate-item-template').content.cloneNode(true);
        const row = fragment.querySelector('.estimate-item');
        const errorId = 'item-error-' + index;
        row.querySelector('.item-error').id = errorId;
        row.querySelector('.item-heading').textContent = '품목 ' + (index + 1);
        itemFields.forEach((key) => {
          const input = row.querySelector('[data-field="' + key + '"]');
          input.value = item && item[key] != null ? item[key] : '';
          input.name = 'items[' + index + '][' + key + ']';
          input.setAttribute('aria-describedby', errorId);
        });
        const remove = row.querySelector('.remove-item');
        remove.disabled = draft.items.length === 1;
        remove.setAttribute('aria-label', '품목 ' + (index + 1) + ' 삭제');
        remove.addEventListener('click', () => {
          persistCosts();
          draft.items.splice(index, 1);
          renderItems();
          persistCosts();
          $('add-item').focus();
        });
        $('estimate-items').append(fragment);
      });
      updateAmounts(false);
    }
    renderItems();
    persistCosts();
    $('add-item').addEventListener('click', () => {
      persistCosts();
      draft.items.push(emptyItem());
      renderItems();
      persistCosts();
      $('estimate-items').lastElementChild.querySelector('input').focus();
    });
    function onCostInput() {
      persistCosts();
      updateAmounts(false);
      $('calculation-error').textContent = '';
    }
    $('costs-form').addEventListener('input', onCostInput);
    $('costs-form').addEventListener('change', onCostInput);
    $('costs-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const saved = persistCosts();
      $('calculation-error').textContent = '';
      const invalidItem = updateAmounts(true);
      if (invalidItem) { invalidItem.focus(); return; }
      if (!showErrors(errorsFor(draft, costFields), costFields)) return;
      if (!calculate(draft)) {
        $('calculation-error').textContent = '계산 가능한 범위를 벗어났습니다. 품목 금액과 인건비 입력값을 확인해 주세요.';
        return;
      }
      if (saved) window.location.href = 'result.html';
    });
  }

  function renderResult() {
    draft = migrateItems(migrateBudget(readStorage('sessionStorage', draftKey)));
    const result = calculate(draft);
    showContent('result-content', Boolean(result));
    if (!result) return false;
    summary();
    $('result-items').replaceChildren();
    draft.items.forEach((item, index) => {
      const row = document.createElement('tr');
      [item.name.trim(), item.unit.trim(), format(number(item.quantity)), money(number(item.unitPrice)), money(result.amounts[index])].forEach((value) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        row.append(cell);
      });
      $('result-items').append(row);
    });
    const values = {
      'total-cost': money(result.total), 'summary-material': money(result.materialCost),
      'summary-labor': money(result.laborCost),
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
