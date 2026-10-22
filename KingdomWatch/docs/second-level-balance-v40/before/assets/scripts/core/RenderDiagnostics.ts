/** Opt-in, read-only rendering report for a user's own phone. No rendering overrides. */
import { director, Label, screen, sys, view } from 'cc';
import { LO } from '../config/GameConfig';

let installed = false;

function rounded(n: number): number { return Math.round(n * 1000) / 1000; }
function size(v: { width: number; height: number }): number[] {
  return [rounded(v.width), rounded(v.height)];
}
function rect(v: { x: number; y: number; width: number; height: number }): number[] {
  return [rounded(v.x), rounded(v.y), rounded(v.width), rounded(v.height)];
}

function collect(mode: string): any {
  const canvas = document.getElementById('GameCanvas') as HTMLCanvasElement | null;
  const bounds = canvas?.getBoundingClientRect();
  const vv = window.visualViewport;
  const css = getComputedStyle(document.documentElement);
  const dpr = window.devicePixelRatio || 1;
  const pageScale = vv?.scale || 1;
  // The page-scale-aware ratio is an estimate, not a physical-panel measurement.
  const targetW = bounds ? bounds.width * dpr * pageScale : 0;
  const targetH = bounds ? bounds.height * dpr * pageScale : 0;
  const gl = (director.root?.device as unknown as { gl?: WebGLRenderingContext })?.gl;
  const engineSafe = sys.getSafeAreaRect();
  const rawSafe = sys.getSafeAreaRect(false);
  const labels = (director.getScene()?.getComponentsInChildren(Label) || [])
    .filter(l => l.enabledInHierarchy && l.node.activeInHierarchy && l.string.trim())
    .slice(0, 16).map(l => {
      // Read-only engine internals are optional; unavailable fields stay null.
      const probe = l as unknown as {
        assemblerData?: { canvas?: HTMLCanvasElement };
        textStyle?: { fontScale?: number; actualFontSize?: number };
      };
      const textCanvas = probe.assemblerData?.canvas;
      const ws = l.node.worldScale;
      return {
        node: l.node.name, text: l.string.slice(0, 48), font: l.font?.name || l.fontFamily,
        systemFont: l.useSystemFont, fontSize: l.fontSize, actualFontSize: l.actualFontSize,
        cacheMode: l.cacheMode, bold: l.isBold, outlineWidth: l.outlineWidth,
        worldScale: [rounded(ws.x), rounded(ws.y)],
        textCanvasPixels: textCanvas ? [textCanvas.width, textCanvas.height] : null,
        engineTextScale: probe.textStyle?.fontScale ?? null,
        engineTextFontSize: probe.textStyle?.actualFontSize ?? null,
      };
    });
  return {
    report: 'kw-render-diagnostics-v35', capturedAt: new Date().toISOString(), mode,
    page: location.origin + location.pathname, query: location.search,
    browser: {
      userAgent: navigator.userAgent, devicePixelRatio: dpr,
      dprCap: (window as unknown as { __KW_DPR_CAP?: number }).__KW_DPR_CAP ?? null,
      innerCss: [innerWidth, innerHeight], outerCss: [outerWidth, outerHeight],
      screenCss: [window.screen.width, window.screen.height],
      availableScreenCss: [window.screen.availWidth, window.screen.availHeight],
      documentCss: [document.documentElement.clientWidth, document.documentElement.clientHeight],
      visualViewport: vv ? {
        width: rounded(vv.width), height: rounded(vv.height), scale: rounded(vv.scale),
        offsetLeft: rounded(vv.offsetLeft), offsetTop: rounded(vv.offsetTop),
      } : null,
      viewportMeta: document.querySelector('meta[name="viewport"]')?.getAttribute('content'),
      safeCss: ['top', 'right', 'bottom', 'left'].map(edge => css.getPropertyValue('--safe-' + edge).trim()),
    },
    canvas: canvas && bounds ? {
      backingPixels: [canvas.width, canvas.height], cssRect: rect(bounds),
      pixelRatio: [rounded(canvas.width / bounds.width), rounded(canvas.height / bounds.height)],
      estimatedDisplayPixels: [rounded(targetW), rounded(targetH)],
      estimatedBackingToDisplay: [rounded(canvas.width / targetW), rounded(canvas.height / targetH)],
      transform: getComputedStyle(canvas).transform,
      ancestors: [canvas.parentElement, canvas.parentElement?.parentElement].filter(Boolean).map(el => {
        const s = getComputedStyle(el!);
        return { id: el!.id, cssRect: rect(el!.getBoundingClientRect()), transform: s.transform, zoom: s.getPropertyValue('zoom') };
      }),
    } : null,
    engine: {
      version: '3.8.8', isMobile: sys.isMobile, os: sys.os, browserType: sys.browserType,
      devicePixelRatio: screen.devicePixelRatio,
      windowPixels: size(screen.windowSize), resolutionPixels: size(screen.resolution),
      resolutionToWindow: [rounded(screen.resolution.width / screen.windowSize.width), rounded(screen.resolution.height / screen.windowSize.height)],
      design: size(view.getDesignResolutionSize()), visible: size(view.getVisibleSize()),
      scale: [rounded(view.getScaleX()), rounded(view.getScaleY())],
      safeRectSymmetric: rect(engineSafe), safeRectRaw: rect(rawSafe),
      appliedLayout: { half: LO.half, notchTop: LO.notchTop, safeTop: LO.safeTop, safeBottom: LO.safeBottom },
    },
    graphics: gl ? {
      drawingBufferPixels: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      attributes: gl.getContextAttributes(), version: gl.getParameter(gl.VERSION),
      renderer: gl.getParameter(gl.RENDERER), maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    } : null,
    labels,
  };
}

export function installRenderDiagnostics(): void {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return;
  if (new URLSearchParams(location.search).get('renderdiag') !== '1'
    && !/\/diagnostics(?:\.html)?\/?$/.test(location.pathname)) return;
  installed = true;
  // The HTML panel exists before the engine starts. Expose only a read-only provider.
  const bridge = window as unknown as { __kwCollectRenderDiagnostics?: (mode: string) => any };
  bridge.__kwCollectRenderDiagnostics = collect;
  window.dispatchEvent(new Event('kw-render-diagnostics-ready'));
}
