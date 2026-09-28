import { useLayoutEffect, useState } from 'react';

export function useVisibleViewport() {
  const [bounds, setBounds] = useState<{ top: number; height: number; bottom: number } | null>(null);
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setBounds({ top: viewport.offsetTop, height: viewport.height, bottom: Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) });
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => { viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update); };
  }, []);
  return bounds;
}
