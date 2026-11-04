// Reference renderer for Node and tests.
//
// The shipped site does not use this file: it calls pele/lazy through src/web/render.js so that
// every diagram type is downloaded on demand. Both paths share src/core/diagram.js, and the test
// suite asserts that they produce identical SVG for the same input.

import { render as peleRender } from 'pele';
import { prepareDiagram, assembleSvg } from './diagram.js';

export function renderDiagram(input) {
  const started = performance.now();
  const prepared = prepareDiagram(input);
  const result = peleRender(prepared.source, prepared.peleOptions);
  return {
    ...assembleSvg(result, prepared),
    elapsed: Math.round((performance.now() - started) * 10) / 10,
  };
}

export { MAX_CODE, MAX_CSS, normalizeCss, normalizeEdge, normalizeRenderOptions } from './diagram.js';
