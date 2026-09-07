(() => {
  function isFreeItem(r) {
    if (!r) return false;
    if (r.free === true) return true;
    if (Number(r.currentPrice) === 0 && r.currentPrice !== null && r.currentPrice !== "") return true;
    if (Number(r.basePrice) === 0 && r.basePrice !== null && r.basePrice !== "") return true;
    const p = `${r.currentPrice ?? ""} ${r.basePrice ?? ""}`.toLocaleLowerCase("ru");
    return p.includes("бесплат") || p.includes("free");
  }

  const originalRow = row;
  row = function(r) {
    const x = originalRow(r);
    x.freeStatus = isFreeItem(x) ? "Бесплатно" : "Платная";
    return x;
  };

  if (!COLUMNS.some(c => c.key === "freeStatus")) {
    COLUMNS.splice(3, 0, { key: "freeStatus", label: "Цена", default: false });
  }

  if (!state.price) state.price = "Все";

  const originalFiltered = filtered;
  filtered = function() {
    const rows = originalFiltered();
    if (state.price === "Бесплатные") return rows.filter(isFreeItem);
    if (state.price === "Платные") return rows.filter(r => !isFreeItem(r));
    return rows;
  };

  function syncPriceControl() {
    const e = document.getElementById("price");
    if (!e) return;
    e.innerHTML = "";
    ["Все", "Бесплатные", "Платные"].forEach(v => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      e.appendChild(o);
    });
    e.value = state.price || "Все";
    e.onchange = ev => {
      state.price = ev.target.value;
      render();
    };
  }

  const originalInit = init;
  init = function() {
    originalInit();
    syncPriceControl();
  };

  const originalReset = resetFilters.onclick;
  resetFilters.onclick = () => {
    state.price = "Все";
    originalReset();
  };

  syncPriceControl();
  cols();
  render();
})();
