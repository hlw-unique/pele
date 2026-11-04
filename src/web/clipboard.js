// Copy a PNG to the system clipboard.
//
// clipboard.write() must run inside the user gesture, so the blob is passed as a promise: the
// write starts immediately while the rasterizer keeps working. Safari requires exactly this shape;
// engines that insist on a resolved blob get a second attempt once it settles.

import { UserError } from '../core/theme.js';

export function canCopyImage() {
  return typeof ClipboardItem !== 'undefined' && Boolean(navigator.clipboard?.write);
}

function explain(error) {
  if (error?.name === 'NotAllowedError') {
    return '浏览器拒绝写入剪贴板，请允许剪贴板权限后重试（需要 HTTPS 或 localhost）';
  }
  if (error?.name === 'TypeError') {
    return '当前浏览器不支持复制 PNG 图片，请改用“导出 PNG”';
  }
  return error?.message || '复制到剪贴板失败';
}

export async function copyPngToClipboard(blobPromise) {
  if (!canCopyImage()) {
    throw new UserError('当前浏览器不支持复制图片，请改用“导出 PNG”');
  }

  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })]);
  } catch (error) {
    const blob = await blobPromise;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch {
      throw new UserError(explain(error));
    }
  }
}
