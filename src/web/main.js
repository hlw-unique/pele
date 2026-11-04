// The whole workbench runs in the browser: pele renders, the canvas rasterizes, nothing is fetched.

import { EXAMPLES } from '../core/examples.js';
import { themeSchema } from '../core/theme.js';
import { renderDiagramAsync } from './render.js';
import { renderPng, pngSize } from './png.js';
import { canCopyImage, copyPngToClipboard } from './clipboard.js';

const STORAGE_KEY = 'pele-workbench:v2';

const TYPE_LABELS = {
  flowchart: '流程图',
  sequence: '时序图',
  class: '类图',
  state: '状态图',
  er: 'ER 图',
  pie: '饼图',
  gantt: '甘特图',
  gitGraph: 'Git 图',
  mindmap: '思维导图',
  timeline: '时间线',
  journey: '用户旅程',
  xychart: 'XY 图',
  quadrantChart: '象限图',
  requirement: '需求图',
  c4: 'C4 图',
  sankey: '桑基图',
  block: '块图',
  packet: '数据包',
  kanban: '看板',
  architecture: '架构图',
  radar: '雷达图',
  treemap: '矩形树图',
  info: '信息图',
  agentflow: 'Agent 图',
  usecase: '用例图',
  railroad: '铁路图',
  treeView: '树视图',
  venn: '韦恩图',
  cynefin: 'Cynefin',
  wardley: 'Wardley',
  swimlane: '泳道图',
  ishikawa: '鱼骨图',
  eventmodeling: '事件建模',
};

const COLOR_RE = /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|[a-z]{3,20}|(?:rgb|rgba|hsl|hsla)\([0-9a-f\s.,%+\-/]*\))$/i;
const FONT_RE = /^[\p{L}\p{N}\s,._'"-]{1,200}$/u;

const state = {
  schema: null,
  theme: null,
  code: '',
  exampleId: null,
  options: { fontSize: 16 },
  edge: { width: 'auto', dash: false },
  png: { scale: 2, background: 'auto', color: '#ffffff', padding: 24 },
  css: '',
  lastRender: null,
  requestId: 0,
  renderTimer: 0,
  saveTimer: 0,
  activePreset: null,
  exporting: false,
  ready: false,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function isColor(value) {
  return typeof value === 'string' && value.length <= 120 && COLOR_RE.test(value.trim());
}

function isFont(value) {
  return typeof value === 'string' && FONT_RE.test(value.trim());
}

function toHex(value) {
  const text = String(value).trim();
  if (/^#[0-9a-f]{6}$/i.test(text)) return text.toLowerCase();
  if (/^#[0-9a-f]{8}$/i.test(text)) return text.slice(0, 7).toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(text)) {
    return '#' + text.slice(1).split('').map((char) => char + char).join('').toLowerCase();
  }
  if (/^#[0-9a-f]{4}$/i.test(text)) {
    return '#' + text.slice(1, 4).split('').map((char) => char + char).join('').toLowerCase();
  }
  const match = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(text);
  if (match) {
    return '#' + [match[1], match[2], match[3]]
      .map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, '0'))
      .join('');
  }
  return '#000000';
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function toast(message, isError = false) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.toggle('error', isError);
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 2800);
}

function setStatus(text) {
  $('#status').textContent = text;
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function scheduleSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveNow, 350);
}

function saveNow() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      code: state.code,
      theme: state.theme,
      edge: state.edge,
      png: state.png,
      css: state.css,
      fontSize: state.options.fontSize,
      exampleId: state.exampleId,
      activePreset: state.activePreset,
    }));
  } catch {
    // A full or disabled localStorage should never break the workbench.
  }
}

function hydrate() {
  const stored = readStore();
  const base = state.schema.theme.defaults;
  const storedTheme = stored && typeof stored.theme === 'object' && stored.theme !== null ? stored.theme : null;
  const baseSeries = Array.isArray(base.series) ? base.series : [];
  const savedSeries = storedTheme && Array.isArray(storedTheme.series) ? storedTheme.series : null;

  state.theme = { ...base, ...(storedTheme ?? {}) };
  state.theme.series = Array.from({ length: 8 }, (_, index) => {
    const value = savedSeries?.[index] ?? baseSeries[index] ?? '#000000';
    return isColor(value) ? value : (baseSeries[index] ?? '#000000');
  });

  const radius = parseFloat(state.theme.radius);
  state.theme.radius = `${Number.isFinite(radius) ? Math.max(0, Math.min(24, radius)) : 8}px`;

  const examples = state.schema.examples;
  const savedExample = openedExample(stored?.exampleId);
  state.exampleId = savedExample?.id ?? examples[0]?.id ?? null;
  state.code = typeof stored?.code === 'string' && stored.code.trim() !== ''
    ? stored.code
    : (savedExample?.code ?? examples[0]?.code ?? '');

  if (stored && typeof stored.css === 'string') state.css = stored.css;
  if (stored?.edge && typeof stored.edge === 'object') {
    const width = stored.edge.width;
    state.edge.width = width === 'auto' || width === null || width === undefined ? 'auto' : String(width);
    state.edge.dash = Boolean(stored.edge.dash);
  }
  if (stored?.png && typeof stored.png === 'object') {
    state.png = {
      scale: Number(stored.png.scale) || 2,
      background: ['auto', 'transparent', 'custom'].includes(stored.png.background) ? stored.png.background : 'auto',
      color: isColor(stored.png.color) ? stored.png.color : '#ffffff',
      padding: Number.isFinite(Number(stored.png.padding)) ? Math.max(0, Math.min(96, Number(stored.png.padding))) : 24,
    };
  }
  const fontSize = Number(stored?.fontSize);
  state.options.fontSize = Number.isFinite(fontSize) ? Math.max(12, Math.min(24, fontSize)) : 16;
  state.activePreset = typeof stored?.activePreset === 'string' ? stored.activePreset : null;
}

function openedExample(id) {
  if (!state.schema) return null;
  return state.schema.examples.find((example) => example.id === id) ?? null;
}

function buildExampleOptions() {
  const select = $('#example-select');
  select.replaceChildren();
  for (const example of state.schema.examples) {
    const option = el('option', null, example.label);
    option.value = example.id;
    select.append(option);
  }
  select.value = state.exampleId ?? '';
}

function buildFontList() {
  const list = $('#font-list');
  list.replaceChildren();
  const seen = new Set();
  for (const value of [...state.schema.theme.fontSuggestions, ...state.schema.theme.monoFontSuggestions]) {
    if (seen.has(value)) continue;
    seen.add(value);
    const option = document.createElement('option');
    option.value = value;
    list.append(option);
  }
}

function buildPresets() {
  const host = $('#presets');
  host.replaceChildren();
  for (const preset of state.schema.theme.presets) {
    const button = el('button', 'preset');
    button.type = 'button';
    button.dataset.presetId = preset.id;
    const swatches = el('span', 'preset-swatches');
    for (const color of preset.swatches ?? []) {
      const swatch = document.createElement('i');
      swatch.style.backgroundColor = color;
      swatches.append(swatch);
    }
    const text = el('span', 'preset-text');
    text.append(el('strong', null, preset.label), el('small', null, preset.description ?? ''));
    button.append(swatches, text);
    button.addEventListener('click', () => applyPreset(preset.id));
    host.append(button);
  }
  updatePresetActive();
}

function updatePresetActive() {
  for (const button of $$('#presets .preset')) {
    button.classList.toggle('active', button.dataset.presetId === state.activePreset);
  }
}

function markCustomPreset() {
  state.activePreset = null;
  updatePresetActive();
}

function applyPreset(id) {
  const preset = state.schema.theme.presets.find((item) => item.id === id);
  if (!preset) return;
  state.theme = { ...preset.theme, series: [...preset.theme.series] };
  state.activePreset = id;
  rebuildThemeControls();
  applyThemeVars();
  updatePresetActive();
  scheduleRender(0);
  scheduleSave();
}

function applyThemeVars() {
  const canvas = $('#preview');
  if (!canvas || !state.schema) return;
  for (const group of state.schema.theme.groups) {
    for (const field of group.fields ?? []) {
      canvas.style.setProperty(field.cssVar, state.theme[field.key]);
    }
  }
  state.theme.series.forEach((color, index) => {
    canvas.style.setProperty(`--pele-series-${index + 1}`, color);
  });
  canvas.style.backgroundColor = state.theme.bg;
}

function rebuildThemeControls() {
  const host = $('#theme-controls');
  host.replaceChildren();
  for (const group of state.schema.theme.groups) {
    if (group.id === 'advanced') {
      const details = el('details', 'section details');
      details.append(el('summary', null, group.label));
      for (const field of group.fields ?? []) details.append(createField(field));
      host.append(details);
      continue;
    }

    const section = el('section', 'section');
    section.append(el('div', 'section-title', group.label));
    if (group.kind === 'series') {
      const grid = el('div', 'series-grid');
      for (let index = 0; index < (group.count ?? 8); index++) {
        grid.append(createSeriesField(index));
      }
      section.append(grid);
      section.append(el('p', 'hint', '图表类（饼图、XY 图、时间线等）会依次使用这些颜色。'));
    } else {
      for (const field of group.fields ?? []) section.append(createField(field));
    }
    host.append(section);
  }
}

function createField(field) {
  switch (field.control) {
    case 'color':
      return createColorField(field);
    case 'font':
      return createFontField(field);
    case 'select':
      return createSelectField(field);
    case 'range':
      return createRangeField(field);
    default:
      return el('div');
  }
}

function createColorField(field) {
  const row = el('div', 'field');
  const label = el('label', 'field-label', field.label);
  const box = el('div', 'color-box');
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = toHex(state.theme[field.key]);
  picker.id = `theme-${field.key}-color`;
  picker.setAttribute('aria-label', field.label);
  picker.title = field.cssVar;
  const text = document.createElement('input');
  text.type = 'text';
  text.className = 'color-text';
  text.value = state.theme[field.key];
  text.id = `theme-${field.key}-text`;
  text.spellcheck = false;
  text.setAttribute('aria-label', `${field.label}颜色值`);
  label.htmlFor = text.id;
  box.append(picker, text);
  row.append(label, box);

  const commit = (value) => {
    state.theme[field.key] = value;
    picker.value = toHex(value);
    text.value = value;
    text.classList.remove('invalid');
    applyThemeVars();
    markCustomPreset();
    scheduleSave();
  };

  picker.addEventListener('input', () => commit(picker.value));
  text.addEventListener('input', () => {
    const value = text.value.trim();
    if (!isColor(value)) {
      text.classList.add('invalid');
      return;
    }
    commit(value);
  });
  text.addEventListener('blur', () => {
    if (!isColor(text.value.trim())) {
      text.value = state.theme[field.key];
      text.classList.remove('invalid');
    }
  });

  return row;
}

function createSeriesField(index) {
  const row = el('div', 'series-item');
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = toHex(state.theme.series[index]);
  picker.setAttribute('aria-label', `系列色 ${index + 1}`);
  const text = document.createElement('input');
  text.type = 'text';
  text.className = 'color-text';
  text.value = state.theme.series[index];
  text.spellcheck = false;
  const label = el('span', null, String(index + 1));
  const commit = (value) => {
    state.theme.series[index] = value;
    picker.value = toHex(value);
    text.value = value;
    text.classList.remove('invalid');
    applyThemeVars();
    markCustomPreset();
    scheduleSave();
  };
  picker.addEventListener('input', () => commit(picker.value));
  text.addEventListener('input', () => {
    const value = text.value.trim();
    if (!isColor(value)) {
      text.classList.add('invalid');
      return;
    }
    commit(value);
  });
  text.addEventListener('blur', () => {
    if (!isColor(text.value.trim())) {
      text.value = state.theme.series[index];
      text.classList.remove('invalid');
    }
  });
  row.append(picker, text, label);
  return row;
}

function createFontField(field) {
  const row = el('div', 'field column');
  const label = el('label', 'field-label', field.label);
  label.htmlFor = `theme-${field.key}`;
  label.title = field.cssVar;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'text-input';
  input.id = `theme-${field.key}`;
  input.value = state.theme[field.key];
  input.setAttribute('list', 'font-list');
  input.spellcheck = false;
  row.append(label, input);

  input.addEventListener('input', () => {
    const value = input.value.trim();
    if (!isFont(value)) {
      input.classList.add('invalid');
      return;
    }
    input.classList.remove('invalid');
    state.theme[field.key] = value;
    markCustomPreset();
    scheduleRender(400);
    scheduleSave();
  });
  input.addEventListener('blur', () => {
    if (!isFont(input.value.trim())) {
      input.value = state.theme[field.key];
      input.classList.remove('invalid');
    }
  });
  return row;
}

function createSelectField(field) {
  const row = el('div', 'field');
  const label = el('label', 'field-label', field.label);
  label.htmlFor = `theme-${field.key}`;
  label.title = field.cssVar;
  const select = el('select', 'select');
  select.id = `theme-${field.key}`;
  for (const value of field.options ?? []) {
    const option = el('option', null, value);
    option.value = value;
    select.append(option);
  }
  select.value = state.theme[field.key];
  select.addEventListener('change', () => {
    state.theme[field.key] = select.value;
    applyThemeVars();
    markCustomPreset();
    scheduleSave();
  });
  row.append(label, select);
  return row;
}

function createRangeField(field) {
  const row = el('div', 'field');
  const label = el('label', 'field-label', field.label);
  label.htmlFor = `theme-${field.key}`;
  label.title = field.cssVar;
  const range = el('div', 'range-row');
  const input = document.createElement('input');
  input.type = 'range';
  input.id = `theme-${field.key}`;
  input.min = String(field.min ?? 0);
  input.max = String(field.max ?? 24);
  input.step = String(field.step ?? 1);
  const current = parseFloat(state.theme[field.key]);
  input.value = String(Number.isFinite(current) ? current : 0);
  const output = el('output', 'range-value', `${input.value}${field.suffix ?? ''}`);
  range.append(input, output);
  row.append(label, range);

  input.addEventListener('input', () => {
    const value = `${input.value}${field.suffix ?? ''}`;
    state.theme[field.key] = value;
    output.textContent = value;
    applyThemeVars();
    markCustomPreset();
    scheduleSave();
  });
  return row;
}

function syncStaticControls() {
  const code = $('#code');
  code.value = state.code;
  updateCodeCount();

  const select = $('#example-select');
  if (state.exampleId) select.value = state.exampleId;

  $('#edge-width').value = String(state.edge.width ?? 'auto');
  $('#edge-dash').checked = Boolean(state.edge.dash);

  $('#font-size').value = String(state.options.fontSize);
  $('#font-size-value').textContent = `${state.options.fontSize}px`;

  $('#custom-css').value = state.css;

  $('#png-scale').value = String(state.png.scale);
  $('#png-background').value = state.png.background;
  $('#png-color').value = toHex(state.png.color);
  $('#png-color-text').value = state.png.color;
  $('#png-color-field').hidden = state.png.background !== 'custom';
  $('#png-padding').value = String(state.png.padding);
  $('#png-padding-value').textContent = `${state.png.padding}px`;

  const copyable = canCopyImage();
  for (const id of ['copy-png', 'copy-png-pane']) {
    const button = $(`#${id}`);
    if (button) button.disabled = !copyable;
  }

  updatePresetActive();
  updateEstimate();
}

function updateCodeCount() {
  const lines = state.code === '' ? 0 : state.code.split('\n').length;
  $('#code-count').textContent = `${lines} 行 · ${state.code.length} 字符`;
}

function updateMeta(data) {
  const label = TYPE_LABELS[data.type] ?? data.type;
  const elapsed = Number.isFinite(data.elapsed) ? ` · ${data.elapsed} ms` : '';
  $('#preview-meta').textContent = `${label} · ${data.width} × ${data.height} px${elapsed}`;
}

function updateEstimate() {
  const target = $('#png-estimate');
  if (!state.lastRender) {
    target.textContent = '—';
    return;
  }
  try {
    const size = pngSize(state.lastRender.width, state.lastRender.height, {
      padding: Number(state.png.padding) || 0,
      scale: Number(state.png.scale) || 2,
    });
    target.textContent = `${size.width} × ${size.height} px`;
  } catch {
    target.textContent = '超出浏览器上限';
  }
}

function showError(error) {
  const message = typeof error?.message === 'string' && error.message !== '' ? error.message : '渲染失败';
  const title = $('#error-title');
  const detail = $('#error-detail');
  title.textContent = error?.code ? `[${error.code}] ${message}` : message;
  const lines = [];
  if (error?.line) {
    lines.push(`位置：第 ${error.line} 行${error.column ? `，第 ${error.column} 列` : ''}`);
  }
  if (error?.snippet) lines.push(error.snippet);
  if (error?.detail) lines.push(error.detail);
  detail.textContent = lines.join('\n');
  $('#error-box').hidden = false;
  $('#preview').classList.add('is-stale');
}

function hideError() {
  $('#error-box').hidden = true;
  $('#error-title').textContent = '';
  $('#error-detail').textContent = '';
  $('#preview').classList.remove('is-stale');
}

function scheduleRender(delay = 180) {
  clearTimeout(state.renderTimer);
  state.renderTimer = setTimeout(renderNow, delay);
}

function buildInput(inlineTheme) {
  return {
    code: state.code,
    theme: state.theme,
    css: state.css,
    options: {
      fontSize: Number(state.options.fontSize),
      padding: 16,
    },
    edge: {
      width: state.edge.width === 'auto' ? null : Number(state.edge.width),
      dash: Boolean(state.edge.dash),
    },
    inlineTheme,
  };
}

function pngOptions() {
  return {
    scale: Number(state.png.scale),
    background: state.png.background === 'custom' ? state.png.color : state.png.background,
    padding: Number(state.png.padding),
  };
}

async function renderNow() {
  if (!state.ready) return;
  clearTimeout(state.renderTimer);
  const requestId = ++state.requestId;
  setStatus('渲染中…');
  try {
    const data = await renderDiagramAsync(buildInput(false));
    if (requestId !== state.requestId) return;

    state.lastRender = data;
    const preview = $('#preview');
    preview.innerHTML = data.svg;
    applyThemeVars();
    updateMeta(data);
    updateEstimate();
    hideError();
    setStatus('');
  } catch (error) {
    if (requestId !== state.requestId) return;
    showError(error);
    setStatus('渲染失败');
  }
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportName(extension) {
  const type = String(state.lastRender?.type ?? 'diagram').replace(/[^\w-]/g, '') || 'diagram';
  if (extension === 'png') return `pele-${type}@${state.png.scale}x.png`;
  return `pele-${type}.svg`;
}

function setExporting(value) {
  state.exporting = value;
  for (const id of ['export-svg', 'export-png', 'export-svg-pane', 'export-png-pane', 'copy-png', 'copy-png-pane']) {
    const button = $(`#${id}`);
    if (!button) continue;
    button.disabled = value || (id.startsWith('copy-') && !canCopyImage());
  }
}

async function exportSvg() {
  if (state.exporting || !state.ready) return;
  setExporting(true);
  setStatus('生成 SVG…');
  try {
    const data = await renderDiagramAsync(buildInput(true));
    const filename = exportName('svg');
    const blob = new Blob([data.svg], { type: 'image/svg+xml;charset=utf-8' });
    download(blob, filename);
    hideError();
    toast(`SVG 已导出 · ${formatBytes(blob.size)}`);
  } catch (error) {
    showError(error);
    toast(error?.message ?? 'SVG 导出失败', true);
  } finally {
    setExporting(false);
    setStatus('');
  }
}

async function exportPng() {
  if (state.exporting || !state.ready) return;
  setExporting(true);
  setStatus('生成 PNG…');
  try {
    const data = await renderDiagramAsync(buildInput(true));
    const png = await renderPng(data, pngOptions(), state.theme);
    download(png.blob, exportName('png'));
    hideError();
    toast(`PNG 已导出 · ${png.width} × ${png.height} px · ${formatBytes(png.blob.size)}`);
  } catch (error) {
    showError(error);
    toast(error?.message ?? 'PNG 导出失败', true);
  } finally {
    setExporting(false);
    setStatus('');
  }
}

async function copyImage() {
  if (state.exporting || !state.ready) return;
  setExporting(true);
  setStatus('复制中…');

  // Start rasterizing before touching the clipboard: Safari only grants write() inside the gesture.
  const job = (async () => {
    const data = await renderDiagramAsync(buildInput(true));
    return renderPng(data, pngOptions(), state.theme);
  })();
  job.catch(() => { /* reported by the clipboard call below */ });

  try {
    await copyPngToClipboard(job.then((png) => png.blob));
    const png = await job;
    hideError();
    toast(`图片已复制到剪贴板 · ${png.width} × ${png.height} px`);
  } catch (error) {
    showError(error);
    toast(error?.message ?? '复制失败', true);
  } finally {
    setExporting(false);
    setStatus('');
  }
}

function setTab(name) {
  const isStyle = name === 'style';
  $('#tab-style').classList.toggle('active', isStyle);
  $('#tab-export').classList.toggle('active', !isStyle);
  $('#tab-style').setAttribute('aria-selected', String(isStyle));
  $('#tab-export').setAttribute('aria-selected', String(!isStyle));
  $('#style-pane').hidden = !isStyle;
  $('#export-pane').hidden = isStyle;
}

function resetAll() {
  state.theme = { ...state.schema.theme.defaults, series: [...state.schema.theme.defaults.series] };
  state.edge = { width: 'auto', dash: false };
  state.options.fontSize = 16;
  state.css = '';
  state.png = { scale: 2, background: 'auto', color: '#ffffff', padding: 24 };
  state.activePreset = 'light';
  rebuildThemeControls();
  syncStaticControls();
  applyThemeVars();
  scheduleRender(0);
  scheduleSave();
  toast('已恢复默认设置');
}

function loadExample(id) {
  const example = openedExample(id);
  if (!example) return;
  state.exampleId = example.id;
  state.code = example.code;
  const code = $('#code');
  code.value = example.code;
  updateCodeCount();
  hideError();
  scheduleRender(0);
  scheduleSave();
}

function bindStatic() {
  const code = $('#code');
  code.addEventListener('input', () => {
    state.code = code.value;
    updateCodeCount();
    scheduleRender(180);
    scheduleSave();
  });
  code.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      code.setRangeText('  ', code.selectionStart, code.selectionEnd, 'end');
      code.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      renderNow();
    }
  });

  $('#example-select').addEventListener('change', (event) => {
    loadExample(event.target.value);
  });

  $('#restore-code').addEventListener('click', () => {
    const example = openedExample(state.exampleId);
    if (!example) return;
    state.code = example.code;
    code.value = example.code;
    updateCodeCount();
    hideError();
    scheduleRender(0);
    scheduleSave();
  });

  $('#edge-width').addEventListener('change', (event) => {
    state.edge.width = event.target.value;
    scheduleRender(0);
    scheduleSave();
  });
  $('#edge-dash').addEventListener('change', (event) => {
    state.edge.dash = event.target.checked;
    scheduleRender(0);
    scheduleSave();
  });

  $('#font-size').addEventListener('input', (event) => {
    state.options.fontSize = Number(event.target.value);
    $('#font-size-value').textContent = `${state.options.fontSize}px`;
    scheduleRender(220);
    scheduleSave();
  });

  $('#custom-css').addEventListener('input', (event) => {
    state.css = event.target.value;
    scheduleRender(500);
    scheduleSave();
  });

  $('#tab-style').addEventListener('click', () => setTab('style'));
  $('#tab-export').addEventListener('click', () => setTab('export'));
  $('#reset-all').addEventListener('click', resetAll);

  $('#png-scale').addEventListener('change', (event) => {
    state.png.scale = Number(event.target.value);
    updateEstimate();
    scheduleSave();
  });
  $('#png-background').addEventListener('change', (event) => {
    state.png.background = event.target.value;
    $('#png-color-field').hidden = state.png.background !== 'custom';
    updateEstimate();
    scheduleSave();
  });
  const pngColor = $('#png-color');
  const pngColorText = $('#png-color-text');
  const commitPngColor = (value) => {
    state.png.color = value;
    pngColor.value = toHex(value);
    pngColorText.value = value;
    pngColorText.classList.remove('invalid');
    updateEstimate();
    scheduleSave();
  };
  pngColor.addEventListener('input', () => commitPngColor(pngColor.value));
  pngColorText.addEventListener('input', () => {
    const value = pngColorText.value.trim();
    if (!isColor(value)) {
      pngColorText.classList.add('invalid');
      return;
    }
    commitPngColor(value);
  });
  pngColorText.addEventListener('blur', () => {
    if (!isColor(pngColorText.value.trim())) {
      pngColorText.value = state.png.color;
      pngColorText.classList.remove('invalid');
    }
  });
  $('#png-padding').addEventListener('input', (event) => {
    state.png.padding = Number(event.target.value);
    $('#png-padding-value').textContent = `${state.png.padding}px`;
    updateEstimate();
    scheduleSave();
  });

  for (const id of ['export-svg', 'export-svg-pane']) {
    $(`#${id}`).addEventListener('click', exportSvg);
  }
  for (const id of ['export-png', 'export-png-pane']) {
    $(`#${id}`).addEventListener('click', exportPng);
  }
  for (const id of ['copy-png', 'copy-png-pane']) {
    $(`#${id}`).addEventListener('click', copyImage);
  }

  window.addEventListener('beforeunload', saveNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
}

function boot() {
  bindStatic();
  try {
    // The schema used to come from GET /api/schema; it is a build-time constant now.
    state.schema = { theme: themeSchema(), examples: EXAMPLES };
    hydrate();
    buildExampleOptions();
    buildFontList();
    buildPresets();
    rebuildThemeControls();
    syncStaticControls();
    applyThemeVars();
    state.ready = true;
    renderNow();
  } catch (error) {
    console.error(error);
    $('#preview-meta').textContent = '工作台加载失败';
    $('#preview').innerHTML = '<div class="preview-empty">工作台加载失败，请刷新页面；如果仍然失败，请查看浏览器控制台。</div>';
    toast('工作台加载失败，请刷新页面重试', true);
  }
}

boot();
