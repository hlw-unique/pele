import test from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLES } from '../src/core/examples.js';
import { renderDiagram } from '../src/core/render.js';
import { renderDiagramAsync } from '../src/web/render.js';
import { MAX_CSS, normalizeCss } from '../src/core/diagram.js';
import { normalizePngOptions, pngSize, MAX_PNG_DIMENSION, MAX_PNG_PIXELS } from '../src/web/png.js';
import { resolveTheme, UserError } from '../src/core/theme.js';

const THEMES = ['light', 'dark'].map((preset) => [preset, resolveTheme({ preset })]);

test('every example renders in both presets', () => {
  for (const example of EXAMPLES) {
    for (const [preset, theme] of THEMES) {
      const result = renderDiagram({
        code: example.code,
        theme,
        inlineTheme: true,
        options: { fontSize: 16 },
        edge: { width: 1.5 },
      });
      assert.match(result.svg, /^<svg /, `${example.id} (${preset})`);
      assert.ok(result.width > 0 && result.height > 0);
      assert.ok(result.svg.includes('--pele-bg'), `${example.id} (${preset}) inlines theme vars`);
    }
  }
});

// The site ships the lazy renderer; the reference renderer uses the full pele build. If these ever
// disagree, the published workbench would render differently from the tests.
test('lazy renderer matches the reference renderer', async () => {
  for (const example of EXAMPLES) {
    const theme = resolveTheme({ preset: 'dark' });
    const input = { code: example.code, theme, inlineTheme: true, edge: { width: 1.5 }, options: { fontSize: 16 } };
    const reference = renderDiagram(input);
    const lazy = await renderDiagramAsync(input);
    assert.equal(lazy.svg, reference.svg, example.id);
    assert.equal(lazy.width, reference.width, example.id);
    assert.equal(lazy.height, reference.height, example.id);
    assert.equal(lazy.type, reference.type, example.id);
  }
});

test('custom CSS and line options are injected once', () => {
  const theme = resolveTheme({ radius: 14 });
  const { svg } = renderDiagram({
    code: 'flowchart LR\n  A-->B',
    theme,
    inlineTheme: true,
    edge: { width: 2, dash: true },
    css: '.pele-node > rect, .pele-node > path { stroke: #ff0000; stroke-width: 4px; }',
  });

  assert.ok(svg.includes('.pele-node > rect'));
  assert.equal(svg.match(/\.pele-edges, \.pele-edge \{ stroke-width: 2; \}/g)?.length, 1);
  assert.ok(svg.includes('stroke-dasharray: 6 4'));
  assert.ok(svg.includes('--pele-radius:14px'));
});

test('preview mode leaves the root style to the page', () => {
  const theme = resolveTheme({ preset: 'dark' });
  const inline = renderDiagram({ code: 'flowchart LR\n  A-->B', theme, inlineTheme: true });
  const preview = renderDiagram({ code: 'flowchart LR\n  A-->B', theme, inlineTheme: false, css: '.pele-label { fill: #000; }' });

  assert.ok(inline.svg.includes('--pele-bg:#0f172a'));
  assert.ok(!preview.svg.includes('--pele-bg:'), 'theme vars must not be baked into the preview SVG');
  assert.ok(preview.svg.includes('<style>'), 'host CSS is still inlined into the preview SVG');
});

test('a diagram palette keeps precedence over theme series colors', () => {
  const code = `---
config:
  themeVariables:
    xyChart:
      plotColorPalette: "#205ea6, #bc5215"
---
xychart
  x-axis [a, b]
  y-axis 0 --> 10
  bar [3, 5]`;
  const theme = resolveTheme({ series: Array(8).fill('#ff0000') });
  const { svg } = renderDiagram({ code, theme, inlineTheme: true });
  const themeAt = svg.indexOf('--pele-series-1:#ff0000');
  const paletteAt = svg.indexOf('--pele-series-1:#205ea6');
  assert.ok(themeAt >= 0);
  assert.ok(paletteAt > themeAt);
});

test('theme values are validated', () => {
  assert.throws(() => resolveTheme({ bg: 'url(http://example.com/a.png)' }), UserError);
  assert.throws(() => resolveTheme({ bg: 'custom' }), UserError);
  assert.throws(() => resolveTheme({ radius: 99 }), UserError);
  assert.throws(() => resolveTheme({ font: 'x"; }' }), UserError);
  assert.throws(() => resolveTheme({ preset: 'nope' }), UserError);
});

test('custom CSS is filtered', () => {
  assert.equal(normalizeCss(''), '');
  assert.equal(normalizeCss('.a{fill:red}'), '.a{fill:red}');
  for (const css of ['@import "x.css";', 'a{background:url(x)}', '</style><script>x</script>', 'a{behavior:url(x)}']) {
    assert.throws(() => normalizeCss(css), UserError, css);
  }
  assert.throws(() => normalizeCss('a'.repeat(MAX_CSS + 1)), UserError);
});

test('PNG options normalize background, scale and padding', () => {
  const theme = resolveTheme({ preset: 'dark' });

  assert.deepEqual(normalizePngOptions({}, theme), { scale: 2, padding: 24, background: '#0f172a' });
  assert.equal(normalizePngOptions({ background: 'transparent' }, theme).background, null);
  assert.equal(normalizePngOptions({ background: 'none' }, theme).background, null);
  assert.equal(normalizePngOptions({ background: '#123456' }, theme).background, '#123456');
  assert.equal(normalizePngOptions({ background: 'custom', color: '#abcdef' }, theme).background, '#abcdef');
  assert.equal(normalizePngOptions({}, resolveTheme({ bg: 'transparent' })).background, null);

  assert.throws(() => normalizePngOptions({ scale: 9 }, theme), UserError);
  assert.throws(() => normalizePngOptions({ padding: 500 }, theme), UserError);
  assert.throws(() => normalizePngOptions({ background: 'custom' }, theme), UserError);
  assert.throws(() => normalizePngOptions({ background: 'url(x)' }, theme), UserError);
});

test('PNG canvas size respects the browser limits', () => {
  assert.deepEqual(pngSize(200, 100, { padding: 10, scale: 2 }), { width: 440, height: 240 });

  assert.throws(() => pngSize(4000, 1000, { padding: 0, scale: 4 }), UserError);
  assert.throws(() => pngSize(MAX_PNG_DIMENSION, 10, { padding: 1, scale: 1 }), UserError);
  assert.throws(() => pngSize(8000, 5000, { padding: 0, scale: 1 }), UserError);

  const fits = pngSize(4000, 4000, { padding: 0, scale: 1 });
  assert.ok(fits.width * fits.height <= MAX_PNG_PIXELS);
});

test('syntax errors carry pele error details', () => {
  const theme = resolveTheme({ preset: 'light' });
  assert.throws(
    () => renderDiagram({ code: 'flowchart LR\n  A -->', theme }),
    (error) => {
      assert.equal(error.code, 'syntax');
      assert.ok(Number.isInteger(error.line));
      return true;
    }
  );
});
