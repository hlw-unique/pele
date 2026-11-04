// Browser renderer: same pipeline as src/core/render.js, but diagram types are downloaded on
// demand through pele/lazy so the first paint does not pay for all 33 diagram kinds.

import { detectType, load, render as peleRender } from 'pele/lazy';
import { prepareDiagram, assembleSvg } from '../core/diagram.js';

function diagramTypeOf(code) {
  try {
    return detectType(code);
  } catch {
    return null;
  }
}

export async function renderDiagramAsync(input) {
  const prepared = prepareDiagram(input);
  const type = diagramTypeOf(prepared.source);

  // load() resolves immediately once this kind of diagram has been fetched.
  await load(type);

  const started = performance.now();
  const result = peleRender(prepared.source, prepared.peleOptions);
  return {
    ...assembleSvg(result, prepared),
    elapsed: Math.round((performance.now() - started) * 10) / 10,
  };
}
