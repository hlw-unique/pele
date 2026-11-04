// Shared, DOM-free diagram pipeline.
//
// Validation, pele render options and the SVG post-processing (theme variables and host CSS) live
// here so that the Node reference renderer (src/core/render.js) and the browser renderer
// (src/web/render.js) cannot drift apart. Anything in this file must stay free of Node and DOM
// APIs: it is imported by tests, by the static site bundle, and optionally by any Node consumer.

import { UserError, themeToDeclarations } from './theme.js';

export const MAX_CODE = 50_000;
export const MAX_CSS = 20_000;

const MONOSPACE_PARTS = new Set(['members', 'attributes', 'files', 'messages']);

function number(value, fallback, min, max, label) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new UserError(`${label} 必须在 ${min} 到 ${max} 之间`);
  }
  return n;
}

function boolean(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') throw new UserError('布尔选项必须是 true 或 false');
  return value;
}

export function normalizeRenderOptions(input = {}) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new UserError('options 必须是对象');
  }

  const options = {
    fontSize: number(input.fontSize, 16, 6, 48, '字号'),
    padding: number(input.padding, 16, 0, 80, '图表内边距'),
    responsive: false,
    maxWidth: input.maxWidth === undefined || input.maxWidth === null || input.maxWidth === 0
      ? undefined
      : number(input.maxWidth, 960, 200, 4000, '最大宽度'),
    autoDirection: boolean(input.autoDirection, true),
    links: boolean(input.links, false),
    images: boolean(input.images, false),
  };

  if (input.directionBreakpoint !== undefined) {
    options.directionBreakpoint = number(input.directionBreakpoint, 640, 200, 4000, '方向切换宽度');
  }

  if (input.idPrefix !== undefined) {
    if (typeof input.idPrefix !== 'string' || !/^[A-Za-z][\w:-]{0,40}$/.test(input.idPrefix)) {
      throw new UserError('idPrefix 必须以字母开头，只能包含字母、数字、下划线、冒号和横线');
    }
    options.idPrefix = input.idPrefix;
  }

  if (input.monospace !== undefined) {
    if (!Array.isArray(input.monospace) || input.monospace.some((part) => !MONOSPACE_PARTS.has(part))) {
      throw new UserError('monospace 只能包含 members、attributes、files、messages');
    }
    options.monospace = input.monospace;
  }

  if (input.now !== undefined) {
    const date = new Date(input.now);
    if (Number.isNaN(date.getTime())) throw new UserError('now 必须是有效日期');
    options.now = date;
  }

  return options;
}

export function normalizeEdge(input = {}) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new UserError('edge 必须是对象');
  }

  let width = null;
  if (input.width !== undefined && input.width !== null && input.width !== '' && input.width !== 'auto') {
    width = number(input.width, 1, 0.25, 8, '线条宽度');
  }

  const dash = boolean(input.dash, false);
  let dashPattern = '6 4';
  if (input.dashPattern !== undefined) {
    if (typeof input.dashPattern !== 'string' || !/^\d+(?:\.\d+)?(?:[ ,]+\d+(?:\.\d+)?){0,7}$/.test(input.dashPattern)) {
      throw new UserError('dashPattern 必须是数字组成的虚线间距，例如 "6 4"');
    }
    dashPattern = input.dashPattern;
  }

  return { width, dash, dashPattern };
}

export function normalizeCss(input) {
  if (input === undefined || input === null || input === '') return '';
  if (typeof input !== 'string') throw new UserError('css 必须是字符串');
  if (input.length > MAX_CSS) throw new UserError(`自定义 CSS 不能超过 ${MAX_CSS} 个字符`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(input)) {
    throw new UserError('自定义 CSS 包含不可见控制字符');
  }
  if (/@import|url\s*\(|expression\s*\(|javascript:|-moz-binding|behavior\s*:|<\/?\s*(?:script|style|iframe|object|embed)\b|<!--|-->/i.test(input)) {
    throw new UserError('自定义 CSS 包含不允许的指令（@import、url()、script/style 标签等）');
  }
  return input.replace(/\r\n?/g, '\n');
}

export function normalizeCode(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new UserError('请提供 Mermaid 代码');
  }
  if (input.length > MAX_CODE) {
    throw new UserError(`Mermaid 代码不能超过 ${MAX_CODE} 个字符`);
  }
  return input;
}

export function edgeCss(edge) {
  const rules = [];
  if (edge.width !== null) {
    rules.push(`.pele-edges, .pele-edge { stroke-width: ${edge.width}; }`);
  }
  if (edge.dash) {
    rules.push(`.pele-edges, .pele-edge { stroke-dasharray: ${edge.dashPattern}; }`);
  }
  return rules.join('\n');
}

function escapeXmlText(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// In an HTML document a <style> element holds raw text: entities are not decoded. Only escape
// what would make the XML invalid, so child combinators (>) keep working in the browser preview.
function escapeStyleText(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;');
}

function escapeXmlAttr(value) {
  return escapeXmlText(value).replace(/"/g, '&quot;');
}

function rootTag(svg) {
  const match = /<svg\b[^>]*>/i.exec(svg);
  if (!match) throw new Error('pele 没有返回 SVG 根元素');
  return match[0];
}

function appendRootStyle(svg, declarations) {
  if (!declarations) return svg;
  const tag = rootTag(svg);
  let next;
  if (/\bstyle="/i.test(tag)) {
    // Put the host's variables first: a palette from the diagram's own front matter is part of
    // the existing style and must keep precedence, as it does in a browser.
    next = tag.replace(/\bstyle="([^"]*)"/i, (_, style) => `style="${escapeXmlAttr(declarations)}${style ? `;${style}` : ''}"`);
  } else {
    next = tag.replace(/>$/, ` style="${escapeXmlAttr(declarations)}">`);
  }
  return svg.replace(tag, () => next);
}

function insertStyle(svg, css) {
  if (!css) return svg;
  const tag = rootTag(svg);
  return svg.replace(tag, () => `${tag}<style>${escapeStyleText(css)}</style>`);
}

/**
 * Validate a render request and turn it into pele options plus the host-side SVG decorations.
 * Throws UserError for anything the UI should show as a friendly message.
 */
export function prepareDiagram({ code, theme, css = '', options = {}, edge = {}, inlineTheme = true }) {
  const source = normalizeCode(code);
  const renderOptions = normalizeRenderOptions(options);
  const styles = normalizeCss(css);
  const edgeOptions = normalizeEdge(edge);

  return {
    source,
    inlineTheme,
    theme,
    peleOptions: {
      ...renderOptions,
      fontFamily: theme.font,
      fontFamilyMono: theme.fontMono,
    },
    hostCss: [edgeCss(edgeOptions), styles].filter(Boolean).join('\n'),
  };
}

/** Apply theme variables (when requested) and host CSS to the SVG pele produced. */
export function assembleSvg(result, prepared) {
  let svg = result.svg;
  if (prepared.inlineTheme) svg = appendRootStyle(svg, themeToDeclarations(prepared.theme));
  svg = insertStyle(svg, prepared.hostCss);

  return {
    svg,
    width: result.width,
    height: result.height,
    type: result.type,
    mermaidType: result.mermaidType,
    links: result.links ?? [],
  };
}
