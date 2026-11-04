// Rasterize a rendered SVG in the browser.
//
// The old server used @resvg/resvg-js, which cannot run on GitHub Pages. Instead the SVG is handed
// to the browser as an image and painted onto a canvas: the same engine that draws the preview
// draws the PNG, so export and preview agree pixel for pixel. System fonts are used, which keeps
// CJK labels working without shipping a font file.

import { UserError, normalizeColor } from '../core/theme.js';

// Canvas limits differ per browser. 8192 px per side and 32 MP keep Safari and mobile devices on
// the safe side of the ~2 GB of temporary memory a bitmap of this size needs.
export const MAX_PNG_DIMENSION = 8192;
export const MAX_PNG_PIXELS = 32_000_000;

export function normalizePngOptions(input = {}, theme) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new UserError('png 必须是对象');
  }

  const scale = input.scale === undefined || input.scale === null ? 2 : Number(input.scale);
  if (!Number.isFinite(scale) || scale < 0.5 || scale > 4) {
    throw new UserError('PNG 倍率必须在 0.5 到 4 之间');
  }

  const padding = input.padding === undefined || input.padding === null ? 24 : Number(input.padding);
  if (!Number.isFinite(padding) || padding < 0 || padding > 200) {
    throw new UserError('PNG 留白必须在 0 到 200 之间');
  }

  let background = input.background === undefined || input.background === null ? 'auto' : input.background;
  if (typeof background !== 'string') throw new UserError('PNG 背景必须是 auto、transparent 或颜色值');
  if (background === 'auto') {
    background = theme.bg === 'transparent' || theme.bg === 'none' ? null : theme.bg;
  } else if (background === 'transparent' || background === 'none') {
    background = null;
  } else if (background === 'custom') {
    if (input.color === undefined || input.color === null) {
      throw new UserError('png.background 为 custom 时需要同时提供 png.color');
    }
    background = normalizeColor(input.color, 'png.color');
  } else {
    background = normalizeColor(background, 'png.background');
  }

  return { scale, padding, background };
}

/** Final bitmap size, with the same guards the server used to enforce. */
export function pngSize(width, height, { padding = 0, scale = 1 } = {}) {
  const pixelWidth = Math.ceil((width + padding * 2) * scale);
  const pixelHeight = Math.ceil((height + padding * 2) * scale);

  if (pixelWidth > MAX_PNG_DIMENSION || pixelHeight > MAX_PNG_DIMENSION || pixelWidth * pixelHeight > MAX_PNG_PIXELS) {
    throw new UserError(
      `导出图片过大（${pixelWidth}×${pixelHeight}），请降低倍率或留白`,
      400,
      { maxDimension: MAX_PNG_DIMENSION, maxPixels: MAX_PNG_PIXELS }
    );
  }

  return { width: pixelWidth, height: pixelHeight };
}

function formatNumber(value) {
  return String(Number(value.toFixed(2)));
}

// Grow the SVG canvas so the requested padding surrounds the diagram instead of shrinking it.
function withPadding(svg, width, height, padding) {
  if (!padding) return svg;
  const tag = /<svg\b[^>]*>/i.exec(svg)?.[0];
  if (!tag) throw new Error('SVG 缺少根元素');

  const canvasWidth = formatNumber(width + padding * 2);
  const canvasHeight = formatNumber(height + padding * 2);
  const next = tag
    .replace(/\swidth="[^"]*"/i, ` width="${canvasWidth}"`)
    .replace(/\sheight="[^"]*"/i, ` height="${canvasHeight}"`)
    .replace(/\sviewBox="[^"]*"/i, ` viewBox="${formatNumber(-padding)} ${formatNumber(-padding)} ${canvasWidth} ${canvasHeight}"`);
  return svg.replace(tag, () => next);
}

function loadSvgImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new UserError('SVG 解码失败，请检查自定义 CSS 或字体设置'));
    image.src = url;
  });
}

function toBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Paint `svg` onto a canvas and return a PNG blob.
 * @returns {Promise<{blob: Blob, width: number, height: number, background: string|null}>}
 */
export async function renderPng({ svg, width, height }, pngInput, theme) {
  const options = normalizePngOptions(pngInput, theme);
  const size = pngSize(width, height, options);
  const prepared = withPadding(svg, width, height, options.padding);

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext('2d');
  if (!context) throw new UserError('浏览器无法创建绘图画布');

  if (options.background) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, size.width, size.height);
  }

  const url = URL.createObjectURL(new Blob([prepared], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await loadSvgImage(url);
    context.drawImage(image, 0, 0, size.width, size.height);
  } finally {
    URL.revokeObjectURL(url);
  }

  const blob = await toBlob(canvas);
  if (!blob) {
    throw new UserError(`浏览器未能生成 ${size.width}×${size.height} 的 PNG，请降低倍率或留白`);
  }

  return { blob, width: size.width, height: size.height, background: options.background };
}
