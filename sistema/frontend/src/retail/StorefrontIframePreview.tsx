import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MotionConfig } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { StorefrontInteractivePreview } from '@/storefront/PublicStorefrontApp';
import { StorefrontWindowContext } from '@/storefront/storefront-motion';

const IFRAME_SRCDOC = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;overflow-x:hidden;">
    <div id="sf-iframe-root"></div>
  </body>
</html>`;

const MOBILE_VIEWPORT_WIDTH = 375;
const DESKTOP_MIN_VIEWPORT_WIDTH = 1240;
const DESKTOP_NATIVE_THRESHOLD = 1120;

function syncHeadStyles(sourceDoc: Document, targetDoc: Document) {
  let baseEl = targetDoc.head.querySelector('base');
  if (!baseEl) {
    baseEl = targetDoc.createElement('base');
    targetDoc.head.prepend(baseEl);
  }
  baseEl.href = `${window.location.origin}/`;

  targetDoc.head
    .querySelectorAll('[data-sf-synced-style="true"]')
    .forEach((n) => n.remove());

  const nodes = sourceDoc.head.querySelectorAll(
    'style, link[rel="stylesheet"]',
  );
  nodes.forEach((node) => {
    const clone = node.cloneNode(true) as HTMLElement;
    clone.setAttribute('data-sf-synced-style', 'true');
    targetDoc.head.appendChild(clone);
  });
}

export interface StorefrontIframePreviewProps {
  storeData: any;
  products: any[];
  previewDevice: 'desktop' | 'mobile';
  selectedSectionId: string | null;
  onSelectEditorSection: (sectionId: string) => void;
  resetSignal: number;
  onSimulationCartChange?: (count: number) => void;
  isActive?: boolean;
}

export function StorefrontIframePreview({
  storeData,
  products,
  previewDevice,
  selectedSectionId,
  onSelectEditorSection,
  resetSignal,
  onSimulationCartChange,
  isActive = true,
}: StorefrontIframePreviewProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const savedScrollYRef = useRef(0);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  const [stageWidth, setStageWidth] = useState(0);
  const [portalTarget, setPortalTarget] = useState<{
    win: Window;
    mountNode: HTMLElement;
  } | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const w = Math.floor(el.clientWidth);
      if (w > 0) {
        setStageWidth(w);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isActive]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let headObserver: MutationObserver | null = null;
    let cleanupScroll: (() => void) | null = null;

    const setupIframe = () => {
      const iframeWin = iframe.contentWindow;
      const iframeDoc = iframe.contentDocument;
      if (!iframeWin || !iframeDoc) return;

      syncHeadStyles(window.document, iframeDoc);

      const mountNode =
        iframeDoc.getElementById('sf-iframe-root') ||
        (() => {
          const div = iframeDoc.createElement('div');
          div.id = 'sf-iframe-root';
          iframeDoc.body.appendChild(div);
          return div;
        })();

      if (headObserver) headObserver.disconnect();
      headObserver = new MutationObserver(() => {
        syncHeadStyles(window.document, iframeDoc);
      });
      headObserver.observe(window.document.head, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      if (cleanupScroll) cleanupScroll();
      const onScroll = () => {
        if (!isActiveRef.current) return;
        savedScrollYRef.current = iframeWin.scrollY;
      };
      iframeWin.addEventListener('scroll', onScroll, { passive: true });
      cleanupScroll = () => iframeWin.removeEventListener('scroll', onScroll);

      setPortalTarget({ win: iframeWin, mountNode });
    };

    iframe.addEventListener('load', setupIframe);
    if (iframe.contentDocument?.readyState === 'complete') {
      setupIframe();
    }

    return () => {
      iframe.removeEventListener('load', setupIframe);
      if (headObserver) headObserver.disconnect();
      if (cleanupScroll) cleanupScroll();
    };
  }, []);

  useEffect(() => {
    if (!isActive || !portalTarget?.win) return;
    const targetY = savedScrollYRef.current;
    const raf = portalTarget.win.requestAnimationFrame(() => {
      portalTarget.win.scrollTo({ top: targetY, behavior: 'auto' });
    });
    return () => portalTarget.win.cancelAnimationFrame(raf);
  }, [isActive, portalTarget]);

  const effectiveStageWidth = stageWidth > 0 ? stageWidth : 960;

  let viewportWidth: number;
  let scale: number;
  let viewportHeight: number;

  if (previewDevice === 'mobile') {
    viewportWidth = MOBILE_VIEWPORT_WIDTH;
    scale =
      effectiveStageWidth < MOBILE_VIEWPORT_WIDTH
        ? effectiveStageWidth / MOBILE_VIEWPORT_WIDTH
        : 1;
    const baseHeight = 720;
    viewportHeight = Math.round(baseHeight / Math.max(scale, 0.75));
  } else if (effectiveStageWidth >= DESKTOP_NATIVE_THRESHOLD) {
    viewportWidth = effectiveStageWidth;
    scale = 1;
    viewportHeight = 740;
  } else {
    viewportWidth = DESKTOP_MIN_VIEWPORT_WIDTH;
    scale = Math.max(0.24, effectiveStageWidth / DESKTOP_MIN_VIEWPORT_WIDTH);
    const desiredVisualHeight = effectiveStageWidth < 520 ? 520 : 700;
    viewportHeight = Math.min(
      1360,
      Math.max(760, Math.round(desiredVisualHeight / scale)),
    );
  }

  const scaledWidth = Math.round(viewportWidth * scale);
  const scaledHeight = Math.round(viewportHeight * scale);

  return (
    <div
      ref={stageRef}
      className="w-full min-w-0 flex justify-center bg-page p-2 sm:p-4 overflow-hidden"
    >
      <div
        style={{
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
        }}
        className="relative rounded-2xl border border-line bg-surface overflow-hidden shrink-0"
      >
        {!portalTarget && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-muted bg-surface z-10">
            <Loader2 size={16} className="animate-spin text-brand" />
            <span>Preparando prévia da vitrine...</span>
          </div>
        )}

        <iframe
          ref={iframeRef}
          title="Prévia interativa da Loja Virtual"
          srcDoc={IFRAME_SRCDOC}
          style={{
            width: `${viewportWidth}px`,
            height: `${viewportHeight}px`,
            transform: scale < 0.999 ? `scale(${scale})` : undefined,
            transformOrigin: 'top left',
            border: 0,
            display: 'block',
          }}
        />

        {portalTarget &&
          createPortal(
            <StorefrontWindowContext.Provider value={portalTarget.win}>
              <MotionConfig reducedMotion="user">
                <StorefrontInteractivePreview
                  storeData={storeData}
                  products={products}
                  selectedSectionId={selectedSectionId}
                  onSelectEditorSection={onSelectEditorSection}
                  resetSignal={resetSignal}
                  onSimulationCartChange={onSimulationCartChange}
                />
              </MotionConfig>
            </StorefrontWindowContext.Provider>,
            portalTarget.mountNode,
          )}
      </div>
    </div>
  );
}
