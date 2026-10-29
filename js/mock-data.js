// 규격·단가 모두 개발 시연용 예시이며 실제 제품 목록이나 시세가 아닙니다.
window.ESTIMATE_MOCK = {
  materials: [
    { id: 'pipe-16', name: '관수용 배관 (예시)', spec: '16 mm', unit: 'm', price: 600 },
    { id: 'pipe-20', name: '관수용 배관 (예시)', spec: '20 mm', unit: 'm', price: 900 },
    { id: 'pipe-25', name: '관수용 배관 (예시)', spec: '25 mm', unit: 'm', price: 1200 }
  ],
  // 실제 시공 산정식이 아닌 시연용 가정. 확정 시 이 함수만 교체합니다.
  calculateQuantity: function (area, spacing) { return area / spacing; }
};
