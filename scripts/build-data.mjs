import fs from 'node:fs';
import path from 'node:path';

const EPISODES_CSV = path.join('data', 'cntvinfantil-dashboard-episodes.csv');
const SERIES_CSV = path.join('data', 'cntvinfantil-dashboard-series.csv');
const TEMPORADAS_CSV = path.join('data', 'cntvinfantil-dashboard-temporadas.csv');

const TIPO_PROD_MAP = {
  PP: 'Producción Propia',
  C: 'Compra',
  F: 'Fondo CNTV',
  D: 'Donación',
  CO: 'Coproducción',
  CR: 'Coproducción Regional',
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
      } else if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ''));
  return rows.slice(1).map((r) => {
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = (r[i] ?? '').trim();
    }
    return obj;
  });
}

function parseListField(val) {
  if (!val || val === '[]') return [];
  const cleaned = val
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, '').replace(/\s+/g, ' '))
    .filter((s) => s && s !== '0' && s !== 'No aplica');
  return [...new Set(cleaned)];
}

function parseDurationMin(val) {
  if (!val) return 0;
  const parts = val.split(':').map(Number);
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    return Math.round((parts[0] * 60 + parts[1] + parts[2] / 60) * 10) / 10;
  }
  return 0;
}

function extractTipoProd(codigo) {
  const m = (codigo || '').match(/^\d{4}-([A-Z]+)-/);
  const code = m ? m[1] : 'OTRO';
  return { code, label: TIPO_PROD_MAP[code] || code };
}

async function main() {
  const [csv1, csv2, csv3] = [
    fs.readFileSync(EPISODES_CSV, 'utf8'),
    fs.readFileSync(SERIES_CSV, 'utf8'),
    fs.readFileSync(TEMPORADAS_CSV, 'utf8'),
  ];

  const rawEpisodes = parseCsv(csv1);
  const rawSeries = parseCsv(csv2);
  const rawTemporadas = parseCsv(csv3);

  const temporadasMap = new Map();
  for (const t of rawTemporadas) {
    if (t.id_temporada) {
      temporadasMap.set(t.id_temporada, t);
    }
  }

  const seriesMap = new Map();
  for (const s of rawSeries) {
    const id = s.id_serie;
    if (!id || Number.isNaN(Number(id))) continue;
    const { code: tipoProdCode, label: tipoProd } = extractTipoProd(s.codigo);
    const validFormato = ['Ficción', 'Documental', 'Reportaje', 'Instruccional', 'Mixto', 'Docu ficción'].includes(s.formato)
      ? s.formato
      : 'Sin dato';
    const validTecnica = ['Acción real', 'Animación', 'Mixto'].includes(s.tecnica) ? s.tecnica : 'Sin dato';

    seriesMap.set(id, {
      id,
      codigo: s.codigo,
      tipoProdCode,
      tipoProd,
      nombre: s.nombre || s.display_nombre || `Serie ${id}`,
      formato: validFormato,
      tecnica: validTecnica,
      edades: parseListField(s.edades_publico),
      paises: parseListField(s.paises),
      productoras: s.productoras ? s.productoras.split(';').map((p) => p.trim()).filter(Boolean) : [],
      temporadas: Number(s.temporadas_num) || 1,
      capitulosCount: 0,
      duracionTotalMin: 0,
      anosProd: new Set(),
      anosEstreno: new Set(),
      temas: new Set(),
      etiquetas: new Set(),
    });
  }

  const episodes = [];
  for (const e of rawEpisodes) {
    if (!e.id_capitulo) continue;
    const idSerie = e.id_serie;
    const serie = seriesMap.get(idSerie);
    const { code: tipoProdCode, label: tipoProd } = serie
      ? { code: serie.tipoProdCode, label: serie.tipoProd }
      : extractTipoProd(e.codigo);

    const temp = temporadasMap.get(e.id_temporada);
    const duracionMin = parseDurationMin(e.duracion);
    const anoProd = Number(e.ano_produccion) || (temp ? Number(temp.ano_produccion) || null : null);
    const anoEstreno = Number(e.ano_estreno) || null;
    const temas = parseListField(e.temas);
    const etiquetas = parseListField(e.etiquetas);

    if (serie) {
      serie.capitulosCount += 1;
      serie.duracionTotalMin = Math.round((serie.duracionTotalMin + duracionMin) * 10) / 10;
      if (anoProd) serie.anosProd.add(anoProd);
      if (anoEstreno) serie.anosEstreno.add(anoEstreno);
      temas.forEach((t) => serie.temas.add(t));
      etiquetas.forEach((et) => serie.etiquetas.add(et));
    }

    episodes.push({
      id: e.id_capitulo,
      codigo: e.codigo,
      nombre: e.nombre || e.display_nombre || 'Sin título',
      tipo: e.tipo || 'Capítulo',
      idSerie,
      serieNombre: e.serie_nombre || (serie ? serie.nombre : ''),
      tipoProdCode,
      tipoProd,
      formato: serie ? serie.formato : 'Sin dato',
      tecnica: serie ? serie.tecnica : 'Sin dato',
      edades: serie ? serie.edades : [],
      pais: e.pais || 'Sin dato',
      productora: e.productora || 'Sin dato',
      duracionMin,
      anoProd,
      anoEstreno,
      temas,
      etiquetas,
      webPublicado: e.web_publicado === '1' || e.web_publicado === 'TRUE',
      geoblocking: e.geoblocking === '1' || e.geoblocking === 'TRUE',
      urlSitio: e.url_sitio || '',
      urlYoutube: e.url_youtube || '',
      urlVimeo: e.url_vimeo || '',
    });
  }

  const series = Array.from(seriesMap.values())
    .filter((s) => s.capitulosCount > 0)
    .map((s) => ({
      ...s,
      anosProd: [...s.anosProd].sort((a, b) => a - b),
      anosEstreno: [...s.anosEstreno].sort((a, b) => a - b),
      temas: [...s.temas],
      etiquetas: [...s.etiquetas].slice(0, 30),
    }));

  const years = episodes.map((e) => e.anoProd).filter(Boolean);
  const out = {
    generatedAt: new Date().toISOString(),
    meta: {
      minYear: Math.min(...years),
      maxYear: Math.max(...years),
      totalSeries: series.length,
      totalEpisodes: episodes.length,
      totalTemporadas: rawTemporadas.length,
    },
    series,
    temporadas: rawTemporadas
      .filter((t) => t.id_temporada)
      .map((t) => ({
        id: t.id_temporada,
        codigo: t.codigo || '',
        nombre: t.nombre || t.display_nombre || `Temporada ${t.temporada_num || ''}`,
        serieNombre: t.serie_nombre || '',
        anoProd: Number(t.ano_produccion) || null,
        adquisicion: t.adquisicion || '',
        edades: parseListField(t.edades_publico),
        paises: parseListField(t.paises),
        productoras: t.productoras || '',
        derechosVencimiento: t.derechos_vencimiento || '',
      })),
    episodes,
  };

  fs.mkdirSync(path.dirname('data.json'), { recursive: true });
  fs.writeFileSync('data.json', JSON.stringify(out));
  console.log(`Generado data.json: ${series.length} series, ${episodes.length} capítulos.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
