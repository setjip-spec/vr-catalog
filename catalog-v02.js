(() => {
  const previousInit = init;
  const previousFiltered = filtered;

  function syncAvailabilityControl() {
    const el = document.getElementById('availability');
    if (!el) return;
    const current = state.availability || 'Все';
    const actual = [...new Set(all().map(r => r.availability).filter(Boolean))]
      .sort((a,b) => String(a).localeCompare(String(b), 'ru'));
    const values = ['Все', 'Есть в Meta', 'Есть в Steam', ...actual.filter(v => !['Все','Есть в Meta','Есть в Steam'].includes(v))];
    el.innerHTML = '';
    values.forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      el.appendChild(o);
    });
    el.value = values.includes(current) ? current : 'Все';
    state.availability = el.value;
  }

  init = function() {
    previousInit();
    syncAvailabilityControl();
  };

  filtered = function() {
    const originalQ = state.q || '';
    state.q = '';
    let rows;
    try {
      rows = previousFiltered();
    } finally {
      state.q = originalQ;
    }
    const q = originalQ.trim().toLocaleLowerCase('ru');
    if (!q) return rows;
    return rows.filter(r => {
      const haystack = [
        r.name, r.type, r.category, r.subcategory, r.description, r.comment,
        r.platform, r.bestRaw, r.availability, r.qloader, r.installWhere
      ].join(' ').toLocaleLowerCase('ru');
      return haystack.includes(q);
    });
  };

  const previousFmt = fmt;
  fmt = function(k, v, r) {
    if (k === 'type' && v === '18+') return '<span class="tag adult">18+</span>';
    if (k === 'qloader' && v === 'RUS') return '<span class="tag rus">RUS</span>';
    return previousFmt(k, v, r);
  };

  init();
  cols();
  render();
})();
