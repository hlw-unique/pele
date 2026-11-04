// Theme handling for the Pele diagram studio.
// Pele exposes its visual style through CSS custom properties. This module is the single
// source of truth for the public theme keys, defaults, presets, validation, and CSS mapping.

export class UserError extends Error {
  constructor(message, status = 400, details = {}) {
    super(message);
    this.name = 'UserError';
    this.status = status;
    this.details = details;
  }
}

export const LIGHT_THEME = Object.freeze({
  bg: '#ffffff',
  fg: '#1f1f1f',
  fgOnLight: '#1f1f1f',
  fgOnDark: '#ffffff',
  muted: '#6e6e6e',
  line: '#1f1f1f',
  surface: '#f3f3f3',
  surfaceAlt: '#e6e6e6',
  border: '#8a8a8a',
  accent: '#5b7bd5',
  critical: '#e45756',
  font: 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace',
  titleWeight: '700',
  headingWeight: '700',
  boldWeight: '600',
  radius: '8px',
  series: Object.freeze([
    '#4c78a8',
    '#f58518',
    '#54a24b',
    '#e45756',
    '#72b7b2',
    '#eeca3b',
    '#b279a2',
    '#9d755d',
  ]),
});

export const DARK_THEME = Object.freeze({
  bg: '#0f172a',
  fg: '#e2e8f0',
  fgOnLight: '#0f172a',
  fgOnDark: '#f8fafc',
  muted: '#94a3b8',
  line: '#cbd5e1',
  surface: '#1e293b',
  surfaceAlt: '#243349',
  border: '#475569',
  accent: '#38bdf8',
  critical: '#fb7185',
  font: 'system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace',
  titleWeight: '700',
  headingWeight: '700',
  boldWeight: '600',
  radius: '8px',
  series: Object.freeze([
    '#38bdf8',
    '#fb923c',
    '#4ade80',
    '#f87171',
    '#2dd4bf',
    '#facc15',
    '#c084fc',
    '#f472b6',
  ]),
});

export const PRESETS = Object.freeze([
  {
    id: 'light',
    label: '浅色',
    description: '干净、清晰，适合文档和演示',
    swatches: ['#ffffff', '#f3f3f3', '#5b7bd5', '#1f1f1f'],
    theme: LIGHT_THEME,
  },
  {
    id: 'dark',
    label: '深色',
    description: '深蓝底色，适合暗色主题和屏幕展示',
    swatches: ['#0f172a', '#1e293b', '#38bdf8', '#e2e8f0'],
    theme: DARK_THEME,
  },
]);

const COLOR_RE = /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|[a-z]{3,20}|(?:rgb|rgba|hsl|hsla)\([0-9a-fA-F\s.,%+\-/]*\))$/i;
const FONT_RE = /^[\p{L}\p{N}\s,._'"-]{1,200}$/u;
const WEIGHT_RE = /^(?:normal|bold|bolder|lighter|[1-9]00)$/;
const RADIUS_RE = /^(\d+(?:\.\d+)?)(?:px)?$/;

const RESERVED_COLORS = new Set(['auto', 'custom', 'inherit', 'initial', 'unset', 'revert', 'revert-layer']);

function color(value, key) {
  const text = String(value).trim();
  if (text.length > 120 || !COLOR_RE.test(text) || RESERVED_COLORS.has(text.toLowerCase())) {
    throw new UserError(`主题颜色 "${key}" 无效：${text}`);
  }
  return text;
}

export function normalizeColor(value, key = 'color') {
  return color(value, key);
}

function colorList(value, key) {
  if (!Array.isArray(value)) throw new UserError(`主题字段 "${key}" 必须是颜色数组`);
  if (value.length > 8) throw new UserError(`主题字段 "${key}" 最多 8 个颜色`);
  return value.map((item, index) => color(item, `${key}[${index}]`));
}

function font(value, key) {
  const text = String(value).trim();
  if (!FONT_RE.test(text)) {
    throw new UserError(`字体 "${key}" 无效，只能包含字体名称、逗号、引号和空格`);
  }
  return text;
}

function weight(value, key) {
  const text = String(value).trim();
  if (!WEIGHT_RE.test(text)) throw new UserError(`字重 "${key}" 无效：${text}`);
  return text;
}

function radius(value) {
  if (typeof value === 'number') value = String(value);
  const match = RADIUS_RE.exec(String(value).trim());
  if (!match) throw new UserError('圆角必须是 0 到 64 之间的像素值，例如 8 或 "8px"');
  const px = Number(match[1]);
  if (!Number.isFinite(px) || px < 0 || px > 64) {
    throw new UserError('圆角必须在 0 到 64 之间');
  }
  return `${px}px`;
}

// Public fields, in the order the style panel shows them.
export const THEME_FIELDS = Object.freeze([
  { key: 'bg', cssVar: '--pele-bg', label: '背景', control: 'color', default: LIGHT_THEME.bg, group: 'canvas' },
  { key: 'fg', cssVar: '--pele-fg', label: '文字', control: 'color', default: LIGHT_THEME.fg, group: 'canvas' },
  { key: 'muted', cssVar: '--pele-muted', label: '次要文字', control: 'color', default: LIGHT_THEME.muted, group: 'canvas' },
  { key: 'surface', cssVar: '--pele-surface', label: '节点填充', control: 'color', default: LIGHT_THEME.surface, group: 'nodes' },
  { key: 'surfaceAlt', cssVar: '--pele-surface-alt', label: '分组填充', control: 'color', default: LIGHT_THEME.surfaceAlt, group: 'nodes' },
  { key: 'border', cssVar: '--pele-border', label: '边框', control: 'color', default: LIGHT_THEME.border, group: 'nodes' },
  { key: 'line', cssVar: '--pele-line', label: '线条 / 箭头', control: 'color', default: LIGHT_THEME.line, group: 'lines' },
  { key: 'accent', cssVar: '--pele-accent', label: '强调色', control: 'color', default: LIGHT_THEME.accent, group: 'lines' },
  { key: 'critical', cssVar: '--pele-critical', label: '警示色', control: 'color', default: LIGHT_THEME.critical, group: 'lines' },
  { key: 'fgOnLight', cssVar: '--pele-fg-on-light', label: '浅色填充上的文字', control: 'color', default: LIGHT_THEME.fgOnLight, group: 'advanced' },
  { key: 'fgOnDark', cssVar: '--pele-fg-on-dark', label: '深色填充上的文字', control: 'color', default: LIGHT_THEME.fgOnDark, group: 'advanced' },
  { key: 'font', cssVar: '--pele-font', label: '正文字体', control: 'font', default: LIGHT_THEME.font, group: 'type' },
  { key: 'fontMono', cssVar: '--pele-font-mono', label: '等宽字体', control: 'font', default: LIGHT_THEME.fontMono, group: 'type' },
  { key: 'titleWeight', cssVar: '--pele-title-weight', label: '标题字重', control: 'select', options: ['400', '500', '600', '700', '800', '900'], default: LIGHT_THEME.titleWeight, group: 'type' },
  { key: 'headingWeight', cssVar: '--pele-heading-weight', label: '标题内字重', control: 'select', options: ['400', '500', '600', '700', '800', '900'], default: LIGHT_THEME.headingWeight, group: 'type' },
  { key: 'boldWeight', cssVar: '--pele-bold-weight', label: '加粗字重', control: 'select', options: ['400', '500', '600', '700', '800', '900'], default: LIGHT_THEME.boldWeight, group: 'type' },
  { key: 'radius', cssVar: '--pele-radius', label: '圆角', control: 'range', min: 0, max: 24, step: 1, suffix: 'px', default: LIGHT_THEME.radius, group: 'shape' },
]);

const FIELD_BY_KEY = new Map(THEME_FIELDS.map((field) => [field.key, field]));

export const THEME_GROUPS = Object.freeze([
  { id: 'canvas', label: '画布与文字' },
  { id: 'nodes', label: '节点与分组' },
  { id: 'lines', label: '线条与强调' },
  { id: 'type', label: '字体' },
  { id: 'shape', label: '形状' },
  { id: 'series', label: '系列色', kind: 'series' },
  { id: 'advanced', label: '高级颜色', collapsed: true },
]);

export const FONT_SUGGESTIONS = Object.freeze([
  LIGHT_THEME.font,
  '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
  '"Noto Sans SC", "Source Han Sans SC", sans-serif',
  'Inter, "Segoe UI", "Microsoft YaHei", sans-serif',
  'Georgia, "Songti SC", "Noto Serif SC", serif',
  '"Source Han Serif SC", "Noto Serif SC", serif',
  'Arial, Helvetica, sans-serif',
]);

export const MONO_FONT_SUGGESTIONS = Object.freeze([
  LIGHT_THEME.fontMono,
  'Consolas, "Courier New", monospace',
  '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
  '"Source Code Pro", "Noto Sans Mono", monospace',
]);

export function presetById(id) {
  return PRESETS.find((preset) => preset.id === id);
}

export function resolveTheme(input) {
  let source = input;
  if (source == null) source = {};
  if (typeof source === 'string') source = { preset: source };
  if (typeof source !== 'object' || Array.isArray(source)) {
    throw new UserError('theme 必须是对象或预设名称');
  }

  let base = LIGHT_THEME;
  if (source.preset !== undefined) {
    if (typeof source.preset !== 'string') throw new UserError('theme.preset 必须是预设名称');
    const preset = presetById(source.preset);
    if (!preset) throw new UserError(`未知主题预设：${source.preset}`);
    base = preset.theme;
  }

  const theme = { ...base, series: [...base.series] };

  for (const field of THEME_FIELDS) {
    const value = source[field.key];
    if (value === undefined || value === null || value === '') continue;
    switch (field.control) {
      case 'color':
        theme[field.key] = color(value, field.key);
        break;
      case 'font':
        theme[field.key] = font(value, field.key);
        break;
      case 'select':
        theme[field.key] = weight(value, field.key);
        break;
      case 'range':
        theme[field.key] = radius(value);
        break;
      default:
        break;
    }
  }

  if (source.series !== undefined) {
    const list = colorList(source.series, 'series');
    theme.series = [...list, ...base.series.slice(list.length)].slice(0, 8);
  }

  return theme;
}

export function themeToVars(theme) {
  const vars = {};
  for (const field of THEME_FIELDS) {
    vars[field.cssVar] = theme[field.key];
  }
  theme.series.forEach((value, index) => {
    vars[`--pele-series-${index + 1}`] = value;
  });
  return vars;
}

export function themeToDeclarations(theme) {
  return Object.entries(themeToVars(theme))
    .map(([name, value]) => `${name}:${value}`)
    .join(';');
}

export function themeField(key) {
  return FIELD_BY_KEY.get(key);
}

// The schema drives the style panel in the browser. It intentionally contains everything the
// client needs to render controls without duplicating defaults.
export function themeSchema() {
  const fields = THEME_FIELDS.map((field) => ({
    key: field.key,
    cssVar: field.cssVar,
    label: field.label,
    control: field.control,
    default: field.default,
    ...(field.options ? { options: field.options } : {}),
    ...(field.min !== undefined ? { min: field.min, max: field.max, step: field.step } : {}),
    ...(field.suffix ? { suffix: field.suffix } : {}),
  }));

  const groups = THEME_GROUPS.map((group) => {
    if (group.kind === 'series') {
      return { ...group, count: 8, defaults: LIGHT_THEME.series };
    }
    const groupFields = fields.filter((field) => {
      const meta = FIELD_BY_KEY.get(field.key);
      return meta?.group === group.id;
    });
    return { ...group, fields: groupFields };
  });

  return {
    defaults: LIGHT_THEME,
    groups,
    presets: PRESETS,
    fontSuggestions: FONT_SUGGESTIONS,
    monoFontSuggestions: MONO_FONT_SUGGESTIONS,
  };
}
