export interface ImageTransform {
  scale: number;
  x: number;
  y: number;
}

export function zoomTransform(
  current: ImageTransform,
  scale: number,
  cursorX: number,
  cursorY: number
): ImageTransform {
  const nextScale = Math.max(0.1, Math.min(8, scale));
  const ratio = nextScale / current.scale;
  return {
    scale: nextScale,
    x: cursorX - (cursorX - current.x) * ratio,
    y: cursorY - (cursorY - current.y) * ratio
  };
}

export function panTransform(
  current: ImageTransform,
  dx: number,
  dy: number,
  width: number,
  height: number
): ImageTransform {
  const maxX = (width * Math.max(1, current.scale)) / 2;
  const maxY = (height * Math.max(1, current.scale)) / 2;
  return {
    scale: current.scale,
    x: Math.max(-maxX, Math.min(maxX, current.x + dx)),
    y: Math.max(-maxY, Math.min(maxY, current.y + dy))
  };
}
