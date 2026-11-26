const COLORS = ['#0f2942', '#0d9488', '#2563eb', '#d97706', '#e11d48', '#7c3aed', '#059669', '#64748b'];

let RAW = null;
let charts = {};
let activeTab = 'series';
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

  const dateStr = new Date(RAW.generatedAt).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  els.dataUpdated.textContent = `Actualizado: ${dateStr}`;

  populateFilters();
  bindEvents();
  render();
}

function populateFilters() {
  const tipos = [...new Set(RAW.episodes.map((e) => e.tipoProd))].sort();
  tipos.forEach((t) => {
    state.tiposProd.add(t);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pill active';
    btn.textContent = t;
    btn.dataset.tipo = t;
    btn.addEventListener('click', () => {
      if (state.tiposProd.has(t)) {
        state.tiposProd.delete(t);
        btn.classList.remove('active');
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

  const temas = [...new Set(RAW.episodes.flatMap((e) => e.temas))].sort((a, b) => a.localeCompare(b, 'es'));
  const edades = [...new Set(RAW.episodes.flatMap((e) => e.edades))].sort((a, b) => a.localeCompare(b, 'es'));
  const formatos = [...new Set(RAW.episodes.map((e) => e.formato))].filter((x) => x !== 'Sin dato').sort();
  const tecnicas = [...new Set(RAW.episodes.map((e) => e.tecnica))].filter((x) => x !== 'Sin dato').sort();
  const paises = [...new Set(RAW.episodes.map((e) => e.pais))].filter((x) => x !== 'Sin dato').sort((a, b) => a.localeCompare(b, 'es'));

  fillSelect(els.temaSelect, temas);
  fillSelect(els.edadSelect, edades);
  fillSelect(els.formatoSelect, formatos);
  fillSelect(els.tecnicaSelect, tecnicas);
  fillSelect(els.paisSelect, paises);
}

function bindEvents() {
  els.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value.trim().toLowerCase();
    currentPage = 1;
    render();
  });

  els.yearMin.addEventListener('change', () => {
    state.yearMin = Number(els.yearMin.value) || RAW.meta.minYear;
    currentPage = 1;
    render();
  });

  els.yearMax.addEventListener('change', () => {
    state.yearMax = Number(els.yearMax.value) || RAW.meta.maxYear;
    currentPage = 1;
    render();
  });

  document.querySelectorAll('.chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = btn.dataset.range;
      if (r === 'all') {
        state.yearMin = RAW.meta.minYear;
        state.yearMax = RAW.meta.maxYear;
      } else {
        const [a, b] = r.split('-').map(Number);
        state.yearMin = a;
        state.yearMax = b;
      }
      els.yearMin.value = state.yearMin;
      els.yearMax.value = state.yearMax;
      currentPage = 1;
      render();
    });
  });

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
    const keys = getKeys(item);
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

function renderCharts(episodes) {
  // 1. Timeline apilado por tipo de producción
  const years = [...new Set(episodes.map((e) => e.anoProd).filter(Boolean))].sort((a, b) => a - b);
  const tipos = [...state.tiposProd];
  const datasets = tipos.map((tipo, idx) => ({
    label: tipo,
    data: years.map((y) => episodes.filter((e) => e.anoProd === y && e.tipoProd === tipo).length),
    backgroundColor: COLORS[idx % COLORS.length],
  }));

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
          els.temaSelect.value = state.tema;
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
            <td>${s.edades.join(', ') || '—'}</td>
            <td>${temasHtml || '—'}</td>
          </tr>`;
      })
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
