const COLORS = ['#0f2942', '#0d9488', '#2563eb', '#d97706', '#e11d48', '#7c3aed', '#059669', '#64748b'];

let RAW = null;
let charts = {};
let tomSelects = {};
const tipoProdColors = {};
let activeTab = 'series';
let timelineDim = 'tipoProd';
let currentPage = 1;
const PAGE_SIZE = 25;

const state = {
  search: '',
  yearMin: 1991,
  yearMax: 2019,
  tema: '',
  edad: '',
  formato: '',
  tecnica: '',
  pais: '',
  onlyPublished: false,
  tiposProd: new Set(),
};

const els = {
  dataUpdated: document.getElementById('dataUpdated'),
  btnReset: document.getElementById('btnReset'),
  searchInput: document.getElementById('searchInput'),
  yearMin: document.getElementById('yearMin'),
  yearMax: document.getElementById('yearMax'),
  temaSelect: document.getElementById('temaSelect'),
  edadSelect: document.getElementById('edadSelect'),
  formatoSelect: document.getElementById('formatoSelect'),
  tecnicaSelect: document.getElementById('tecnicaSelect'),
  paisSelect: document.getElementById('paisSelect'),
  onlyPublished: document.getElementById('onlyPublished'),
  tipoProdPills: document.getElementById('tipoProdPills'),
  kpiSeries: document.getElementById('kpiSeries'),
  kpiEpisodes: document.getElementById('kpiEpisodes'),
  kpiHours: document.getElementById('kpiHours'),
  kpiPublished: document.getElementById('kpiPublished'),
  countSeriesTab: document.getElementById('countSeriesTab'),
  countEpisodesTab: document.getElementById('countEpisodesTab'),
  tableHead: document.getElementById('tableHead'),
  tableBody: document.getElementById('tableBody'),
  prevPage: document.getElementById('prevPage'),
  nextPage: document.getElementById('nextPage'),
  pageInfo: document.getElementById('pageInfo'),
  btnExportCsv: document.getElementById('btnExportCsv'),
};

async function init() {
  const res = await fetch('data.json');
  RAW = await res.json();

  state.yearMin = RAW.meta.minYear;
  state.yearMax = RAW.meta.maxYear;
  els.yearMin.value = state.yearMin;
  els.yearMax.value = state.yearMax;

  const yearLabel = document.getElementById('yearRangeLabel');
  if (yearLabel) yearLabel.textContent = `${state.yearMin} – ${state.yearMax}`;
  const yearSliderEl = document.getElementById('yearSlider');
  if (yearSliderEl && typeof noUiSlider !== 'undefined') {
    noUiSlider.create(yearSliderEl, {
      start: [state.yearMin, state.yearMax],
      connect: true,
      step: 1,
      range: { min: RAW.meta.minYear, max: RAW.meta.maxYear },
      format: { to: (v) => Math.round(v), from: (v) => Number(v) },
    });
    yearSliderEl.noUiSlider.on('update', (values) => {
      if (yearLabel) yearLabel.textContent = `${values[0]} – ${values[1]}`;
    });
    yearSliderEl.noUiSlider.on('change', (values) => {
      state.yearMin = Number(values[0]);
      state.yearMax = Number(values[1]);
      els.yearMin.value = state.yearMin;
      els.yearMax.value = state.yearMax;
      currentPage = 1;
      render();
    });
  }

  const dateStr = new Date(RAW.generatedAt).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  if (els.dataUpdated) els.dataUpdated.textContent = `Actualizado: ${dateStr}`;

  populateFilters();
  bindEvents();
  bindCheckEvents();
  render();
}

function populateFilters() {
  const tipos = [...new Set(RAW.episodes.map((e) => e.tipoProd))].sort();
  tipos.forEach((t, idx) => {
    const color = COLORS[idx % COLORS.length];
    tipoProdColors[t] = color;
    state.tiposProd.add(t);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pill active';
    btn.style.setProperty('--pill-color', color);
    btn.innerHTML = `<span class="pill-dot" aria-hidden="true"></span><span>${t}</span>`;
    btn.dataset.tipo = t;
    btn.addEventListener('click', () => {
      if (state.tiposProd.has(t)) {
        state.tiposProd.delete(t);
        btn.classList.remove('active');
      } else if (checkEntity === 'temporadas') {
        head.innerHTML = '<tr><th>Código</th><th>Temporada</th><th>Serie</th><th>Campos faltantes</th><th>Completitud</th></tr>';
        body.innerHTML = slice
          .map(
            ({ item, missing, pct }) => `
      <tr>
        <td><code>${item.codigo || '—'}</code></td>
        <td><strong>${item.nombre}</strong></td>
        <td>${item.serieNombre || '—'}</td>
        <td>${missing.map((m) => `<span class="tag-missing">${m}</span>`).join('')}</td>
        <td>${renderPct(pct)}</td>
      </tr>`
          )
          .join('');
      } else {
        state.tiposProd.add(t);
        btn.classList.add('active');
      }
      currentPage = 1;
      render();
    });
    els.tipoProdPills.appendChild(btn);
  });

  const fillSelect = (selectEl, values) => {
    values.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    });
  };

  const temas = [...new Set(RAW.episodes.flatMap((e) => e.temas || []).filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b, 'es'));
  const edades = [...new Set(RAW.episodes.flatMap((e) => e.edades || []).filter(Boolean).map(String))].sort((a, b) => a.localeCompare(b, 'es'));
  const formatos = [...new Set(RAW.episodes.map((e) => e.formato))].filter((x) => x && x !== 'Sin dato').sort();
  const tecnicas = [...new Set(RAW.episodes.map((e) => e.tecnica))].filter((x) => x && x !== 'Sin dato').sort();
  const paises = [...new Set(RAW.episodes.map((e) => e.pais))].filter((x) => x && x !== 'Sin dato').map(String).sort((a, b) => a.localeCompare(b, 'es'));

  fillSelect(els.temaSelect, temas);
  fillSelect(els.edadSelect, edades);
  fillSelect(els.formatoSelect, formatos);
  fillSelect(els.tecnicaSelect, tecnicas);
  fillSelect(els.paisSelect, paises);

  if (typeof TomSelect !== 'undefined') {
    ['temaSelect', 'edadSelect', 'formatoSelect', 'tecnicaSelect', 'paisSelect'].forEach((id) => {
      tomSelects[id] = new TomSelect(els[id], {
        allowEmptyOption: true,
        create: false,
      });
    });
  }
}

function bindEvents() {
  els.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value.trim().toLowerCase();
    currentPage = 1;
    render();
  });

  const syncYearChips = () => {
    document.querySelectorAll('.chip-btn').forEach((b) => {
      const r = b.dataset.range;
      const isMatch =
        r === 'all'
          ? state.yearMin === RAW.meta.minYear && state.yearMax === RAW.meta.maxYear
          : r === `${state.yearMin}-${state.yearMax}`;
      b.classList.toggle('active', isMatch);
    });
  };

  els.yearMin.addEventListener('change', () => {
    state.yearMin = Math.max(RAW.meta.minYear, Number(els.yearMin.value) || RAW.meta.minYear);
    els.yearMin.value = state.yearMin;
    syncYearChips();
    currentPage = 1;
    render();
  });

  els.yearMax.addEventListener('change', () => {
    state.yearMax = Math.min(RAW.meta.maxYear, Number(els.yearMax.value) || RAW.meta.maxYear);
    els.yearMax.value = state.yearMax;
    syncYearChips();
    currentPage = 1;
    render();
  });

  document.querySelectorAll('.chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = btn.dataset.range;
      if (r === 'all') {
        state.yearMin = RAW.meta.minYear;
        state.yearMax = RAW.meta.maxYear;
      } else if (checkEntity === 'temporadas') {
        head.innerHTML = '<tr><th>Código</th><th>Temporada</th><th>Serie</th><th>Campos faltantes</th><th>Completitud</th></tr>';
        body.innerHTML = slice
          .map(
            ({ item, missing, pct }) => `
      <tr>
        <td><code>${item.codigo || '—'}</code></td>
        <td><strong>${item.nombre}</strong></td>
        <td>${item.serieNombre || '—'}</td>
        <td>${missing.map((m) => `<span class="tag-missing">${m}</span>`).join('')}</td>
        <td>${renderPct(pct)}</td>
      </tr>`
          )
          .join('');
      } else {
        const [a, b] = r.split('-').map(Number);
        state.yearMin = a;
        state.yearMax = b;
      }
      els.yearMin.value = state.yearMin;
      els.yearMax.value = state.yearMax;
      const ys = document.getElementById('yearSlider');
      if (ys?.noUiSlider) ys.noUiSlider.set([state.yearMin, state.yearMax]);
      syncYearChips();
      currentPage = 1;
      render();
    });
  });
  syncYearChips();

  [
    ['temaSelect', 'tema'],
    ['edadSelect', 'edad'],
    ['formatoSelect', 'formato'],
    ['tecnicaSelect', 'tecnica'],
    ['paisSelect', 'pais'],
  ].forEach(([elKey, stateKey]) => {
    els[elKey].addEventListener('change', (e) => {
      state[stateKey] = e.target.value;
      currentPage = 1;
      render();
    });
  });

  els.onlyPublished.addEventListener('change', (e) => {
    state.onlyPublished = e.target.checked;
    currentPage = 1;
    render();
  });

  if (els.btnReset) {
    els.btnReset.addEventListener('click', () => {
      state.search = '';
      state.yearMin = RAW.meta.minYear;
      state.yearMax = RAW.meta.maxYear;
      state.tema = '';
      state.edad = '';
      state.formato = '';
      state.tecnica = '';
      state.pais = '';
      state.onlyPublished = false;

      els.searchInput.value = '';
      els.yearMin.value = state.yearMin;
      els.yearMax.value = state.yearMax;
      els.temaSelect.value = '';
      els.edadSelect.value = '';
      els.formatoSelect.value = '';
      els.tecnicaSelect.value = '';
      els.paisSelect.value = '';
      els.onlyPublished.checked = false;

      document.querySelectorAll('.pill').forEach((p) => {
        state.tiposProd.add(p.dataset.tipo);
        p.classList.add('active');
      });

      currentPage = 1;
      render();
    });
  }

  document.querySelectorAll('.timeline-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.timeline-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      timelineDim = btn.dataset.dim;
      const titles = {
        tipoProd: 'Evolución por año · Tipo de producción',
        temas: 'Evolución por año · Temáticas (Top 6)',
        edades: 'Evolución por año · Público / Edad',
        duracion: 'Evolución por año · Duración de capítulos',
        formato: 'Evolución por año · Formato',
      };
      const titleEl = document.getElementById('timelineTitle');
      if (titleEl) titleEl.textContent = titles[timelineDim] || titles.tipoProd;
      render();
    });
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      currentPage = 1;
      renderTable();
    });
  });

  els.prevPage.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTable();
    }
  });

  els.nextPage.addEventListener('click', () => {
    currentPage++;
    renderTable();
  });

  els.btnExportCsv.addEventListener('click', exportCsv);
}

function getFilteredEpisodes() {
  return RAW.episodes.filter((e) => {
    if (!state.tiposProd.has(e.tipoProd)) return false;
    if (e.anoProd && (e.anoProd < state.yearMin || e.anoProd > state.yearMax)) return false;
    if (state.tema && !e.temas.includes(state.tema)) return false;
    if (state.edad && !e.edades.includes(state.edad)) return false;
    if (state.formato && e.formato !== state.formato) return false;
    if (state.tecnica && e.tecnica !== state.tecnica) return false;
    if (state.pais && e.pais !== state.pais) return false;
    if (state.onlyPublished && !e.webPublicado) return false;
    if (state.search) {
      const hay = `${e.nombre} ${e.serieNombre} ${e.productora} ${e.etiquetas.join(' ')} ${e.temas.join(' ')}`.toLowerCase();
      if (!hay.includes(state.search)) return false;
    }
    return true;
  });
}

function getFilteredSeries(episodes) {
  const bySerie = new Map();
  episodes.forEach((e) => {
    if (!bySerie.has(e.idSerie)) {
      bySerie.set(e.idSerie, {
        id: e.idSerie,
        nombre: e.serieNombre,
        tipoProd: e.tipoProd,
        formato: e.formato,
        tecnica: e.tecnica,
        edades: e.edades,
        paises: new Set(),
        anos: new Set(),
        temas: new Set(),
        capitulos: 0,
        duracionMin: 0,
      });
    }
    const s = bySerie.get(e.idSerie);
    s.capitulos += 1;
    s.duracionMin += e.duracionMin;
    if (e.pais && e.pais !== 'Sin dato') s.paises.add(e.pais);
    if (e.anoProd) s.anos.add(e.anoProd);
    e.temas.forEach((t) => s.temas.add(t));
  });
  return Array.from(bySerie.values()).sort((a, b) => b.capitulos - a.capitulos);
}

let lastEpisodes = [];
let lastSeries = [];

function render() {
  lastEpisodes = getFilteredEpisodes();
  lastSeries = getFilteredSeries(lastEpisodes);

  const totalMin = lastEpisodes.reduce((acc, e) => acc + e.duracionMin, 0);
  const pubCount = lastEpisodes.filter((e) => e.webPublicado).length;
  const pubPct = lastEpisodes.length ? Math.round((pubCount / lastEpisodes.length) * 100) : 0;

  els.kpiSeries.textContent = lastSeries.length.toLocaleString('es-CL');
  els.kpiEpisodes.textContent = lastEpisodes.length.toLocaleString('es-CL');
  els.kpiHours.textContent = `${Math.round(totalMin / 60).toLocaleString('es-CL')} h`;
  els.kpiPublished.textContent = `${pubPct}%`;

  els.countSeriesTab.textContent = lastSeries.length.toLocaleString('es-CL');
  els.countEpisodesTab.textContent = lastEpisodes.length.toLocaleString('es-CL');

  renderCharts(lastEpisodes);
  renderTable();
}

function countBy(items, getKeys) {
  const map = new Map();
  items.forEach((item) => {
    const raw = getKeys(item);
    const keys = Array.isArray(raw) ? raw : raw ? [raw] : [];
    keys.forEach((k) => {
      if (!k) return;
      map.set(k, (map.get(k) || 0) + 1);
    });
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function upsertChart(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), config);
}

function getDurationBucket(min) {
  if (!min || min <= 0) return 'Sin dato';
  if (min < 5) return '< 5 min';
  if (min <= 15) return '5–15 min';
  if (min <= 30) return '15–30 min';
  return '> 30 min';
}

function renderCharts(episodes) {
  // 1. Timeline apilado por año según dimensión seleccionada
  const years = [...new Set(episodes.map((e) => e.anoProd).filter(Boolean))].sort((a, b) => a - b);
  let datasets = [];

  if (timelineDim === 'tipoProd') {
    const tipos = [...state.tiposProd].sort();
    datasets = tipos.map((tipo) => ({
      label: tipo,
      data: years.map((y) => episodes.filter((e) => e.anoProd === y && e.tipoProd === tipo).length),
      backgroundColor: tipoProdColors[tipo] || COLORS[0],
    }));
  } else if (timelineDim === 'temas') {
    const top6 = countBy(episodes, (e) => e.temas).slice(0, 6).map((x) => x[0]);
    datasets = top6.map((tema, idx) => ({
      label: tema,
      data: years.map((y) => episodes.filter((e) => e.anoProd === y && (e.temas || []).includes(tema)).length),
      backgroundColor: COLORS[idx % COLORS.length],
    }));
  } else if (timelineDim === 'edades') {
    const edades = countBy(episodes, (e) => e.edades).slice(0, 6).map((x) => x[0]);
    datasets = edades.map((edad, idx) => ({
      label: edad,
      data: years.map((y) => episodes.filter((e) => e.anoProd === y && (e.edades || []).includes(edad)).length),
      backgroundColor: COLORS[idx % COLORS.length],
    }));
  } else if (timelineDim === 'duracion') {
    const buckets = ['< 5 min', '5–15 min', '15–30 min', '> 30 min', 'Sin dato'];
    datasets = buckets.map((b, idx) => ({
      label: b,
      data: years.map((y) => episodes.filter((e) => e.anoProd === y && getDurationBucket(e.duracionMin) === b).length),
      backgroundColor: COLORS[idx % COLORS.length],
    }));
  } else if (timelineDim === 'formato') {
    const formatos = countBy(episodes, (e) => [e.formato]).slice(0, 6).map((x) => x[0]);
    datasets = formatos.map((f, idx) => ({
      label: f,
      data: years.map((y) => episodes.filter((e) => e.anoProd === y && e.formato === f).length),
      backgroundColor: COLORS[idx % COLORS.length],
    }));
  }

  upsertChart('chartTimeline', {
    type: 'bar',
    data: { labels: years, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      plugins: { legend: { position: 'bottom' } },
    },
  });

  // 2. Top 12 Temáticas
  const topTemas = countBy(episodes, (e) => e.temas).slice(0, 12);
  upsertChart('chartTemas', {
    type: 'bar',
    data: {
      labels: topTemas.map((x) => x[0]),
      datasets: [{ label: 'Capítulos', data: topTemas.map((x) => x[1]), backgroundColor: '#0d9488' }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      onClick: (_, elements) => {
        if (elements.length > 0) {
          const tema = topTemas[elements[0].index][0];
          state.tema = state.tema === tema ? '' : tema;
          if (tomSelects.temaSelect) {
            tomSelects.temaSelect.setValue(state.tema, true);
          } else if (checkEntity === 'temporadas') {
            head.innerHTML = '<tr><th>Código</th><th>Temporada</th><th>Serie</th><th>Campos faltantes</th><th>Completitud</th></tr>';
            body.innerHTML = slice
              .map(
                ({ item, missing, pct }) => `
      <tr>
        <td><code>${item.codigo || '—'}</code></td>
        <td><strong>${item.nombre}</strong></td>
        <td>${item.serieNombre || '—'}</td>
        <td>${missing.map((m) => `<span class="tag-missing">${m}</span>`).join('')}</td>
        <td>${renderPct(pct)}</td>
      </tr>`
              )
              .join('');
          } else {
            els.temaSelect.value = state.tema;
          }
          currentPage = 1;
          render();
        }
      },
    },
  });

  // 3. Edades
  const edades = countBy(episodes, (e) => e.edades);
  upsertChart('chartEdades', {
    type: 'bar',
    data: {
      labels: edades.map((x) => x[0]),
      datasets: [{ label: 'Capítulos', data: edades.map((x) => x[1]), backgroundColor: '#2563eb' }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });

  // 4. Formato
  const formatos = countBy(episodes, (e) => [e.formato]);
  upsertChart('chartFormato', {
    type: 'bar',
    data: {
      labels: formatos.map((x) => x[0]),
      datasets: [{ label: 'Capítulos', data: formatos.map((x) => x[1]), backgroundColor: '#0f2942' }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });

  // 5. Técnica
  const tecnicas = countBy(episodes, (e) => [e.tecnica]);
  upsertChart('chartTecnica', {
    type: 'doughnut',
    data: {
      labels: tecnicas.map((x) => x[0]),
      datasets: [{ data: tecnicas.map((x) => x[1]), backgroundColor: ['#0d9488', '#d97706', '#64748b', '#cbd5e1'] }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
    },
  });

  // 6. Países Top 8
  const paises = countBy(episodes, (e) => [e.pais]).slice(0, 8);
  upsertChart('chartPaises', {
    type: 'bar',
    data: {
      labels: paises.map((x) => x[0]),
      datasets: [{ label: 'Capítulos', data: paises.map((x) => x[1]), backgroundColor: '#7c3aed' }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });
}

function renderTable() {
  const rows = activeTab === 'series' ? lastSeries : lastEpisodes;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  els.pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
  els.prevPage.disabled = currentPage <= 1;
  els.nextPage.disabled = currentPage >= totalPages;

  if (activeTab === 'series') {
    els.tableHead.innerHTML = `
      <tr>
        <th>Serie</th>
        <th>Tipo Prod.</th>
        <th>Años</th>
        <th>Caps.</th>
        <th>Horas</th>
        <th>Formato / Técnica</th>
        <th>Edades</th>
        <th>Temáticas</th>
      </tr>`;
    els.tableBody.innerHTML = pageRows
      .map((s) => {
        const anos = [...s.anos].sort((a, b) => a - b);
        const anosStr = anos.length > 1 ? `${anos[0]}–${anos[anos.length - 1]}` : anos[0] || '—';
        const temasHtml = [...s.temas].slice(0, 3).map((t) => `<span class="tag">${t}</span>`).join('');
        return `
          <tr>
            <td><strong>${s.nombre}</strong><br><span class="badge-muted">${[...s.paises].join(', ') || '—'}</span></td>
            <td><span class="tag tag-prod">${s.tipoProd}</span></td>
            <td>${anosStr}</td>
            <td>${s.capitulos}</td>
            <td>${(s.duracionMin / 60).toFixed(1)} h</td>
            <td>${s.formato}<br><span class="badge-muted">${s.tecnica}</span></td>
            <td>${[...s.edades].join(', ') || '—'}</td>
            <td>${temasHtml || '—'}</td>
          </tr>`;
      })
      .join('');
  } else if (checkEntity === 'temporadas') {
    head.innerHTML = '<tr><th>Código</th><th>Temporada</th><th>Serie</th><th>Campos faltantes</th><th>Completitud</th></tr>';
    body.innerHTML = slice
      .map(
        ({ item, missing, pct }) => `
      <tr>
        <td><code>${item.codigo || '—'}</code></td>
        <td><strong>${item.nombre}</strong></td>
        <td>${item.serieNombre || '—'}</td>
        <td>${missing.map((m) => `<span class="tag-missing">${m}</span>`).join('')}</td>
        <td>${renderPct(pct)}</td>
      </tr>`
      )
      .join('');
  } else {
    els.tableHead.innerHTML = `
      <tr>
        <th>Capítulo</th>
        <th>Serie</th>
        <th>Tipo Prod.</th>
        <th>Año</th>
        <th>Duración</th>
        <th>País</th>
        <th>Temáticas</th>
        <th>Enlaces</th>
      </tr>`;
    els.tableBody.innerHTML = pageRows
      .map((e) => {
        const temasHtml = e.temas.slice(0, 3).map((t) => `<span class="tag">${t}</span>`).join('');
        const links = [
          e.urlSitio ? `<a href="${e.urlSitio}" target="_blank" rel="noopener">Web</a>` : '',
          e.urlYoutube ? `<a href="${e.urlYoutube}" target="_blank" rel="noopener">YT</a>` : '',
          e.urlVimeo ? `<a href="${e.urlVimeo}" target="_blank" rel="noopener">Vimeo</a>` : '',
        ]
          .filter(Boolean)
          .join(' · ');
        return `
          <tr>
            <td><strong>${e.nombre}</strong></td>
            <td>${e.serieNombre}</td>
            <td><span class="tag tag-prod">${e.tipoProd}</span></td>
            <td>${e.anoProd || '—'}</td>
            <td>${e.duracionMin} min</td>
            <td>${e.pais}</td>
            <td>${temasHtml || '—'}</td>
            <td>${links || '—'}</td>
          </tr>`;
      })
      .join('');
  }
}

function exportCsv() {
  const rows = activeTab === 'series' ? lastSeries : lastEpisodes;
  let headers, lines;

  if (activeTab === 'series') {
    headers = ['Serie', 'TipoProduccion', 'Capitulos', 'Horas', 'Formato', 'Tecnica', 'Edades', 'Tematicas'];
    lines = rows.map((s) => [
      s.nombre,
      s.tipoProd,
      s.capitulos,
      (s.duracionMin / 60).toFixed(1),
      s.formato,
      s.tecnica,
      s.edades.join('; '),
      [...s.temas].join('; '),
    ]);
  } else if (checkEntity === 'temporadas') {
    head.innerHTML = '<tr><th>Código</th><th>Temporada</th><th>Serie</th><th>Campos faltantes</th><th>Completitud</th></tr>';
    body.innerHTML = slice
      .map(
        ({ item, missing, pct }) => `
      <tr>
        <td><code>${item.codigo || '—'}</code></td>
        <td><strong>${item.nombre}</strong></td>
        <td>${item.serieNombre || '—'}</td>
        <td>${missing.map((m) => `<span class="tag-missing">${m}</span>`).join('')}</td>
        <td>${renderPct(pct)}</td>
      </tr>`
      )
      .join('');
  } else {
    headers = ['Capitulo', 'Serie', 'TipoProduccion', 'AnoProduccion', 'DuracionMin', 'Pais', 'Tematicas', 'UrlSitio'];
    lines = rows.map((e) => [
      e.nombre,
      e.serieNombre,
      e.tipoProd,
      e.anoProd || '',
      e.duracionMin,
      e.pais,
      e.temas.join('; '),
      e.urlSitio,
    ]);
  }

  const csv = [headers, ...lines]
    .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cntv-infantil-${activeTab}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

init();

let checkEntity = 'episodes';
let checkPage = 1;

function auditEpisode(e) {
  const missing = [];
  if (!e.anoProd) missing.push('Año');
  if (!e.duracionMin || e.duracionMin <= 0) missing.push('Duración');
  if (!e.temas || e.temas.length === 0) missing.push('Temáticas');
  if (!e.pais || e.pais === 'Sin dato') missing.push('País');
  if (!e.productora || e.productora === 'Sin dato') missing.push('Productora');
  if (e.webPublicado && !e.urlSitio && !e.urlYoutube && !e.urlVimeo) missing.push('URL web');
  const total = e.webPublicado ? 6 : 5;
  const pct = Math.round(((total - missing.length) / total) * 100);
  return { missing, pct };
}

function auditSeries(s) {
  const missing = [];
  if (!s.formato || s.formato === 'Sin dato') missing.push('Formato');
  if (!s.tecnica || s.tecnica === 'Sin dato') missing.push('Técnica');
  if (!s.edades || s.edades.length === 0) missing.push('Edades');
  if (!s.paises || s.paises.length === 0) missing.push('País');
  if (!s.productoras || s.productoras.length === 0) missing.push('Productora');
  const total = 5;
  const pct = Math.round(((total - missing.length) / total) * 100);
  return { missing, pct };
}

function auditTemporada(t) {
  const missing = [];
  if (!t.anoProd) missing.push('Año');
  if (!t.adquisicion) missing.push('Adquisición');
  if (!t.edades || t.edades.length === 0) missing.push('Edades');
  if (!t.paises || t.paises.length === 0) missing.push('País');
  if (!t.productoras) missing.push('Productora');
  if (!t.derechosVencimiento || t.derechosVencimiento === 'Sin información') missing.push('Derechos');
  const total = 6;
  const pct = Math.round(((total - missing.length) / total) * 100);
  return { missing, pct };
}

function getFilteredCheckRows() {
  const q = (document.getElementById('checkSearch')?.value || '').trim().toLowerCase();
  const field = document.getElementById('checkFieldFilter')?.value || '';
  const tipoProd = document.getElementById('checkTipoProd')?.value || '';
  const yMin = Number(document.getElementById('checkYearMin')?.value) || 0;
  const yMax = Number(document.getElementById('checkYearMax')?.value) || 9999;
  const onlyPub = document.getElementById('checkOnlyPublished')?.checked || false;

  if (checkEntity === 'episodes') {
    return RAW.episodes
      .map((e) => ({ item: e, ...auditEpisode(e) }))
      .filter((r) => r.missing.length > 0)
      .filter((r) => !field || r.missing.includes(field))
      .filter((r) => !tipoProd || r.item.tipoProd === tipoProd)
      .filter((r) => !onlyPub || r.item.webPublicado)
      .filter((r) => (!yMin && yMax === 9999) || (r.item.anoProd && r.item.anoProd >= yMin && r.item.anoProd <= yMax))
      .filter((r) => !q || (r.item.nombre || '').toLowerCase().includes(q) || (r.item.codigo || '').toLowerCase().includes(q) || (r.item.serieNombre || '').toLowerCase().includes(q));
  }
  if (checkEntity === 'temporadas') {
    return (RAW.temporadas || [])
      .map((t) => ({ item: t, ...auditTemporada(t) }))
      .filter((r) => r.missing.length > 0)
      .filter((r) => !field || r.missing.includes(field))
      .filter((r) => (!yMin && yMax === 9999) || (r.item.anoProd && r.item.anoProd >= yMin && r.item.anoProd <= yMax))
      .filter((r) => !q || (r.item.nombre || '').toLowerCase().includes(q) || (r.item.codigo || '').toLowerCase().includes(q) || (r.item.serieNombre || '').toLowerCase().includes(q));
  }
  return RAW.series
    .map((s) => ({ item: s, ...auditSeries(s) }))
    .filter((r) => r.missing.length > 0)
    .filter((r) => !field || r.missing.includes(field))
    .filter((r) => !tipoProd || r.item.tipoProd === tipoProd)
    .filter((r) => (!yMin && yMax === 9999) || (r.item.anosProd || []).some((y) => y >= yMin && y <= yMax))
    .filter((r) => !q || (r.item.nombre || '').toLowerCase().includes(q) || (r.item.codigo || '').toLowerCase().includes(q));
}

function renderCheck() {
  if (!RAW) return;
  const epAudits = RAW.episodes.map(auditEpisode);
  const epInc = epAudits.filter((a) => a.missing.length > 0).length;
  const epAvgPct = Math.round(epAudits.reduce((acc, a) => acc + a.pct, 0) / (epAudits.length || 1));

  const serAudits = RAW.series.map(auditSeries);
  const serInc = serAudits.filter((a) => a.missing.length > 0).length;
  const serAvgPct = Math.round(serAudits.reduce((acc, a) => acc + a.pct, 0) / (serAudits.length || 1));

  const tempAudits = (RAW.temporadas || []).map(auditTemporada);
  const tempInc = tempAudits.filter((a) => a.missing.length > 0).length;

  document.getElementById('checkKpiEpPct').textContent = `${epAvgPct}%`;
  document.getElementById('checkKpiEpInc').textContent = epInc.toLocaleString('es-CL');
  document.getElementById('checkKpiSerPct').textContent = `${serAvgPct}%`;
  document.getElementById('checkKpiSerInc').textContent = serInc.toLocaleString('es-CL');
  document.getElementById('checkCountEp').textContent = epInc.toLocaleString('es-CL');
  document.getElementById('checkCountSer').textContent = serInc.toLocaleString('es-CL');
  const countTempEl = document.getElementById('checkCountTemp');
  if (countTempEl) countTempEl.textContent = tempInc.toLocaleString('es-CL');

  const rows = getFilteredCheckRows();
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  if (checkPage > totalPages) checkPage = totalPages;
  const slice = rows.slice((checkPage - 1) * PAGE_SIZE, checkPage * PAGE_SIZE);

  const head = document.getElementById('checkTableHead');
  const body = document.getElementById('checkTableBody');

  const renderPct = (pct) => {
    const color = pct >= 80 ? '#0d9488' : pct >= 50 ? '#d97706' : '#dc2626';
    return `<div class="progress-cell"><div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div><strong>${pct}%</strong></div>`;
  };

  if (slice.length === 0) {
    head.innerHTML = '';
    body.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--muted)">No hay registros pendientes con los filtros actuales.</td></tr>';
  } else if (checkEntity === 'episodes') {
    head.innerHTML = '<tr><th>Código</th><th>Capítulo</th><th>Serie</th><th>Campos faltantes</th><th>Completitud</th></tr>';
    body.innerHTML = slice
      .map(
        ({ item, missing, pct }) => `
      <tr>
        <td><code>${item.codigo || '—'}</code></td>
        <td><strong>${item.nombre}</strong></td>
        <td>${item.serieNombre || '—'}</td>
        <td>${missing.map((m) => `<span class="tag-missing">${m}</span>`).join('')}</td>
        <td>${renderPct(pct)}</td>
      </tr>`
      )
      .join('');
  } else if (checkEntity === 'temporadas') {
    head.innerHTML = '<tr><th>Código</th><th>Temporada</th><th>Serie</th><th>Campos faltantes</th><th>Completitud</th></tr>';
    body.innerHTML = slice
      .map(
        ({ item, missing, pct }) => `
      <tr>
        <td><code>${item.codigo || '—'}</code></td>
        <td><strong>${item.nombre}</strong></td>
        <td>${item.serieNombre || '—'}</td>
        <td>${missing.map((m) => `<span class="tag-missing">${m}</span>`).join('')}</td>
        <td>${renderPct(pct)}</td>
      </tr>`
      )
      .join('');
  } else {
    head.innerHTML = '<tr><th>Código</th><th>Serie</th><th>Capítulos</th><th>Campos faltantes</th><th>Completitud</th></tr>';
    body.innerHTML = slice
      .map(
        ({ item, missing, pct }) => `
      <tr>
        <td><code>${item.codigo || '—'}</code></td>
        <td><strong>${item.nombre}</strong></td>
        <td>${item.capitulosCount ?? 0}</td>
        <td>${missing.map((m) => `<span class="tag-missing">${m}</span>`).join('')}</td>
        <td>${renderPct(pct)}</td>
      </tr>`
      )
      .join('');
  }

  document.getElementById('checkPageInfo').textContent = `Página ${checkPage} de ${totalPages} (${rows.length} pendientes)`;
  document.getElementById('checkPrevPage').disabled = checkPage <= 1;
  document.getElementById('checkNextPage').disabled = checkPage >= totalPages;
}

function bindCheckEvents() {
  const tipoSelect = document.getElementById('checkTipoProd');
  if (tipoSelect && RAW) {
    [...new Set(RAW.episodes.map((e) => e.tipoProd))].sort().forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      tipoSelect.appendChild(opt);
    });
  }

  const cyMin = document.getElementById('checkYearMin');
  const cyMax = document.getElementById('checkYearMax');
  const checkYearSliderEl = document.getElementById('checkYearSlider');
  const checkYearLabel = document.getElementById('checkYearLabel');
  if (checkYearSliderEl && typeof noUiSlider !== 'undefined' && RAW) {
    noUiSlider.create(checkYearSliderEl, {
      start: [RAW.meta.minYear, RAW.meta.maxYear],
      connect: true,
      step: 1,
      range: { min: RAW.meta.minYear, max: RAW.meta.maxYear },
      format: { to: (v) => Math.round(v), from: (v) => Number(v) },
    });
    checkYearSliderEl.noUiSlider.on('update', (values) => {
      if (checkYearLabel) checkYearLabel.textContent = `${values[0]} – ${values[1]}`;
    });
    checkYearSliderEl.noUiSlider.on('change', (values) => {
      if (cyMin) cyMin.value = values[0];
      if (cyMax) cyMax.value = values[1];
      checkPage = 1;
      renderCheck();
    });
  }

  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      document.getElementById('viewExplore').classList.toggle('hidden', view !== 'explore');
      document.getElementById('viewCheck').classList.toggle('hidden', view !== 'check');
      if (els.btnReset) els.btnReset.classList.toggle('hidden', view !== 'explore');
      if (view === 'check') renderCheck();
    });
  });

  ['checkTipoProd', 'checkYearMin', 'checkYearMax', 'checkOnlyPublished'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      checkPage = 1;
      renderCheck();
    });
  });

  document.querySelectorAll('.check-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.check-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      checkEntity = btn.dataset.entity;
      checkPage = 1;
      renderCheck();
    });
  });

  document.getElementById('checkSearch')?.addEventListener('input', () => {
    checkPage = 1;
    renderCheck();
  });

  document.getElementById('checkFieldFilter')?.addEventListener('change', () => {
    checkPage = 1;
    renderCheck();
  });

  document.getElementById('checkPrevPage')?.addEventListener('click', () => {
    if (checkPage > 1) {
      checkPage--;
      renderCheck();
    }
  });

  document.getElementById('checkNextPage')?.addEventListener('click', () => {
    checkPage++;
    renderCheck();
  });

  document.getElementById('btnExportCheckCsv')?.addEventListener('click', () => {
    const rows = getFilteredCheckRows();
    const header = ['codigo', 'nombre', 'serie', 'campos_faltantes', 'completitud_pct'];
    const lines = [
      header.join(','),
      ...rows.map(({ item, missing, pct }) =>
        [
          `"${(item.codigo || '').replace(/"/g, '""')}"`,
          `"${(item.nombre || '').replace(/"/g, '""')}"`,
          `"${(item.serieNombre || '').replace(/"/g, '""')}"`,
          `"${missing.join('; ')}"`,
          pct,
        ].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chequeo-${checkEntity}-pendientes.csv`;
    a.click();
  });
}
