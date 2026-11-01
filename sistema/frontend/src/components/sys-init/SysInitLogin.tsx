import { useState, useEffect, useRef } from "react";
import { ShieldCheck, Sparkles, Eye, EyeOff, AlertCircle } from "lucide-react";

const REMEMBER_PROFILE_KEY = "lojista_sysinit_remember_profile";

export type SysInitProfile = {
  name: string;
  email: string;
  role: string;
  tagline: string;
  initials: string;
};

export const SYS_INIT_PROFILES: SysInitProfile[] = [
  {
    name: "Tarcísio",
    email: "tarcisio@teltech.com.br",
    role: "Sócio Co-Founder",
    tagline: "Estratégia, Finanças & Inteligência Técnica",
    initials: "TS",
  },
  {
    name: "Lucas",
    email: "lucas@teltech.com.br",
    role: "Sócio Co-Founder",
    tagline: "Arquitetura Arcana, Engenharia & Inovação",
    initials: "LM",
  },
];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
};

function ParticlesBackground({
  density = 0.00012,
  linkDistance = 130,
  color = "265 85% 62%",
}: {
  density?: number;
  linkDistance?: number;
  color?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.min(140, Math.max(40, Math.floor(width * height * density)));
      const arr: Particle[] = [];
      for (let i = 0; i < target; i++) {
        arr.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 1.6 + 0.6,
          a: Math.random() * 0.5 + 0.3,
        });
      }
      particlesRef.current = arr;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onLeave = () => (mouseRef.current = null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      const ps = particlesRef.current;
      const mouse = mouseRef.current;

      for (const p of ps) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        if (mouse) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 14000) {
            const f = (1 - d2 / 14000) * 0.6;
            p.x += (dx / Math.sqrt(d2 || 1)) * f;
            p.y += (dy / Math.sqrt(d2 || 1)) * f;
          }
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${color} / ${p.a})`;
        ctx.fill();
      }

      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          const a = ps[i];
          const b = ps[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < linkDistance) {
            const alpha = (1 - d / linkDistance) * 0.25;
            ctx.strokeStyle = `hsl(${color} / ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [density, linkDistance, color]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ pointerEvents: "none", position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}

function CRMBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colors = {
      windowBg: "rgba(26, 26, 32, 0.65)",
      windowBorder: "rgba(124, 58, 237, 0.3)",
      columnBg: "rgba(35, 35, 42, 0.4)",
      cardBg: "rgba(45, 45, 53, 0.95)",
      textGhost: "rgba(255, 255, 255, 0.15)",
      tagPurple: "#7C3AED",
      tagDeepPurple: "#6D28D9",
      tagSoftPurple: "#F3E8FF",
      glowPurple: "rgba(124, 58, 237, 0.16)",
      glowSoft: "rgba(109, 40, 217, 0.10)",
    };
    const tagColors = [colors.tagPurple, colors.tagDeepPurple, colors.tagSoftPurple, colors.tagPurple];

    let width = 0, height = 0, time = 0;
    let mouseX = window.innerWidth / 2;
    let currentLeftBlur = 0, currentRightBlur = 0;

    const winConfig = { width: 480, height: 350, radius: 14, headerHeight: 32 };
    const colsConfig = { count: 3, padding: 16, gap: 16, yOffset: 48 };
    const cardConfig = { height: 60, gap: 12, radius: 6 };
    const colWidth = (winConfig.width - colsConfig.padding * 2 - colsConfig.gap * (colsConfig.count - 1)) / colsConfig.count;

    function resize() {
      if (!canvas || !ctx) return;
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mouseX = width / 2;
    }

    class Card {
      id: number; colIndex: number; rowIndex: number; tagColor: string;
      x: number; y: number; targetX: number; targetY: number;
      textWidth1: number; textWidth2: number;
      isDragging: boolean; scale: number; targetScale: number;
      constructor(id: number, colIndex: number, rowIndex: number) {
        this.id = id; this.colIndex = colIndex; this.rowIndex = rowIndex;
        this.tagColor = tagColors[Math.floor(Math.random() * tagColors.length)];
        this.x = 0; this.y = 0; this.targetX = 0; this.targetY = 0;
        this.textWidth1 = 40 + Math.random() * 30;
        this.textWidth2 = 60 + Math.random() * 50;
        this.isDragging = false; this.scale = 1; this.targetScale = 1;
      }
      updateTargets(colX: number, startY: number) {
        this.targetX = colX;
        this.targetY = startY + this.rowIndex * (cardConfig.height + cardConfig.gap);
        if (this.x === 0) { this.x = this.targetX; this.y = this.targetY; }
      }
      update() {
        if (!this.isDragging) {
          this.x += (this.targetX - this.x) * 0.04;
          this.y += (this.targetY - this.y) * 0.04;
        }
        this.scale += (this.targetScale - this.scale) * 0.1;
      }
      draw(c: CanvasRenderingContext2D) {
        c.save();
        c.translate(this.x + colWidth / 2, this.y + cardConfig.height / 2);
        c.scale(this.scale, this.scale);
        c.translate(-(this.x + colWidth / 2), -(this.y + cardConfig.height / 2));
        if (this.isDragging) { c.shadowColor = "rgba(0,0,0,0.5)"; c.shadowBlur = 20; c.shadowOffsetY = 10; }
        c.fillStyle = colors.cardBg;
        c.beginPath(); c.roundRect(this.x, this.y, colWidth, cardConfig.height, cardConfig.radius); c.fill();
        c.shadowColor = "transparent";
        c.fillStyle = this.tagColor;
        c.beginPath(); c.roundRect(this.x + 12, this.y + 12, 35, 12, 4); c.fill();
        c.fillStyle = colors.textGhost;
        c.beginPath(); c.roundRect(this.x + 12, this.y + 35, this.textWidth2, 5, 2); c.fill();
        c.beginPath(); c.roundRect(this.x + 12, this.y + 47, this.textWidth1, 5, 2); c.fill();
        c.beginPath(); c.arc(this.x + colWidth - 20, this.y + cardConfig.height - 20, 8, 0, Math.PI * 2); c.fill();
        c.restore();
      }
    }

    class BaseCursor {
      x: number; y: number; targetX: number; targetY: number; scale: number;
      pulses: { x: number; y: number; radius: number; alpha: number }[];
      constructor() {
        this.x = winConfig.width / 2; this.y = winConfig.height / 2;
        this.targetX = this.x; this.targetY = this.y;
        this.scale = 1; this.pulses = [];
      }
      addPulse() { this.pulses.push({ x: this.x, y: this.y, radius: 2, alpha: 0.6 }); }
      updatePulses(dt: number) {
        for (let i = this.pulses.length - 1; i >= 0; i--) {
          const p = this.pulses[i];
          p.radius += 0.06 * dt; p.alpha -= 0.0025 * dt;
          if (p.alpha <= 0) this.pulses.splice(i, 1);
        }
      }
      draw(c: CanvasRenderingContext2D) {
        c.save();
        this.pulses.forEach(p => {
          c.beginPath(); c.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          c.strokeStyle = `rgba(255,255,255,${Math.max(0, p.alpha)})`; c.lineWidth = 2.5; c.stroke();
        });
        c.restore();
        c.save();
        c.translate(this.x, this.y); c.scale(this.scale, this.scale);
        c.shadowColor = "rgba(0,0,0,0.3)"; c.shadowBlur = 12; c.shadowOffsetY = 6; c.shadowOffsetX = 2;
        c.beginPath();
        c.moveTo(3, 3); c.lineTo(3, 32); c.quadraticCurveTo(14, 22, 28, 18); c.closePath();
        c.fillStyle = "#272321"; c.fill();
        c.shadowColor = "transparent"; c.lineWidth = 4.5; c.strokeStyle = "#FFFFFF";
        c.lineJoin = "round"; c.lineCap = "round"; c.stroke();
        c.restore();
      }
    }

    function recalculateIndices(cards: Card[]) {
      for (let c = 0; c < colsConfig.count; c++) {
        const inCol = cards.filter(card => card.colIndex === c);
        inCol.sort((a, b) => a.y - b.y);
        inCol.forEach((card, i) => { card.rowIndex = i; });
      }
    }

    class DragDropCursor extends BaseCursor {
      state: string; card: Card | null; timer: number; clickOffsetX: number; clickOffsetY: number;
      constructor() {
        super(); this.state = "IDLE"; this.card = null; this.timer = 1000;
        this.clickOffsetX = 0; this.clickOffsetY = 0;
      }
      update(dt: number, app: { cards: Card[]; cursor: DragDropCursor }) {
        this.x += (this.targetX - this.x) * 0.03; this.y += (this.targetY - this.y) * 0.03;
        this.updatePulses(dt);
        switch (this.state) {
          case "IDLE":
            this.timer -= dt;
            if (this.timer <= 0) {
              const lastColCards = app.cards.filter(c => c.colIndex === colsConfig.count - 1);
              if (lastColCards.length > 3) {
                const toRecycle = lastColCards.sort((a, b) => b.rowIndex - a.rowIndex)[0];
                toRecycle.colIndex = 0; toRecycle.y = winConfig.height + 200;
                recalculateIndices(app.cards);
              }
              const movable = app.cards.filter(c => c.colIndex < colsConfig.count - 1);
              if (movable.length === 0) return;
              this.card = movable[Math.floor(Math.random() * movable.length)];
              this.state = "MOVING";
              this.clickOffsetX = colWidth / 2 + (Math.random() * 20 - 10);
              this.clickOffsetY = cardConfig.height / 2 + (Math.random() * 10 - 5);
            }
            break;
          case "MOVING":
            this.targetX = this.card!.x + this.clickOffsetX; this.targetY = this.card!.y + this.clickOffsetY;
            if (Math.hypot(this.targetX - this.x, this.targetY - this.y) < 5) {
              this.state = "GRABBING"; this.timer = 400; this.scale = 0.85; this.addPulse();
            }
            break;
          case "GRABBING":
            this.targetX = this.card!.x + this.clickOffsetX; this.targetY = this.card!.y + this.clickOffsetY;
            this.timer -= dt;
            if (this.timer <= 0) {
              this.card!.isDragging = true; this.card!.targetScale = 1.05;
              this.card!.colIndex += 1; recalculateIndices(app.cards); this.state = "DRAGGING";
            }
            break;
          case "DRAGGING": {
            const dColX = colsConfig.padding + this.card!.colIndex * (colWidth + colsConfig.gap);
            const dColY = colsConfig.yOffset + 45 + this.card!.rowIndex * (cardConfig.height + cardConfig.gap);
            this.targetX = dColX + this.clickOffsetX; this.targetY = dColY + this.clickOffsetY;
            this.card!.x = this.x - this.clickOffsetX; this.card!.y = this.y - this.clickOffsetY;
            this.card!.targetX = dColX; this.card!.targetY = dColY;
            if (Math.hypot(this.targetX - this.x, this.targetY - this.y) < 5) {
              this.state = "DROPPING"; this.timer = 300;
              this.card!.isDragging = false; this.card!.targetScale = 1; this.scale = 1;
            }
            break;
          }
          case "DROPPING":
            this.timer -= dt;
            if (this.timer <= 0) {
              this.state = "IDLE"; this.timer = 2000 + Math.random() * 1000; this.card = null;
              this.targetX += (Math.random() - 0.5) * 150; this.targetY += (Math.random() - 0.5) * 150;
            }
            break;
        }
      }
    }

    interface Modal { isOpen: boolean; progress: number; sourceCard: Card | null; toggleState: boolean; }
    class ModalCursor extends BaseCursor {
      state: string; card: Card | null; timer: number;
      modalW: number; modalH: number; modalX: number; modalY: number;
      toggleX: number; toggleY: number; closeX: number; closeY: number;
      constructor() {
        super(); this.state = "IDLE"; this.card = null; this.timer = 1500;
        this.modalW = winConfig.width * 0.68; this.modalH = winConfig.height * 0.68;
        this.modalX = (winConfig.width - this.modalW) / 2; this.modalY = (winConfig.height - this.modalH) / 2;
        this.toggleX = this.modalX + this.modalW - 50; this.toggleY = this.modalY + 50;
        this.closeX = this.modalX + 16; this.closeY = this.modalY + 16;
      }
      update(dt: number, app: { cards: Card[]; cursor: ModalCursor; modal: Modal }) {
        this.x += (this.targetX - this.x) * 0.035; this.y += (this.targetY - this.y) * 0.035;
        this.updatePulses(dt);
        switch (this.state) {
          case "IDLE":
            this.timer -= dt;
            if (this.timer <= 0 && app.modal.progress < 0.01) {
              this.card = app.cards[Math.floor(Math.random() * app.cards.length)];
              this.state = "MOVE_TO_CARD";
            }
            break;
          case "MOVE_TO_CARD":
            this.targetX = this.card!.x + colWidth / 2; this.targetY = this.card!.y + cardConfig.height / 2;
            if (Math.hypot(this.targetX - this.x, this.targetY - this.y) < 5) {
              this.state = "CLICK_CARD"; this.timer = 300; this.scale = 0.85; this.addPulse();
            }
            break;
          case "CLICK_CARD":
            this.targetX = this.card!.x + colWidth / 2; this.targetY = this.card!.y + cardConfig.height / 2;
            this.timer -= dt;
            if (this.timer <= 0) {
              app.modal.isOpen = true; app.modal.sourceCard = this.card;
              this.state = "WAIT_MODAL"; this.scale = 1; this.timer = 600;
            }
            break;
          case "WAIT_MODAL":
            this.timer -= dt;
            if (this.timer <= 0 && app.modal.progress > 0.95) this.state = "MOVE_TO_TOGGLE";
            break;
          case "MOVE_TO_TOGGLE":
            this.targetX = this.toggleX + 20; this.targetY = this.toggleY + 12;
            if (Math.hypot(this.targetX - this.x, this.targetY - this.y) < 5) {
              this.state = "CLICK_TOGGLE"; this.timer = 300; this.scale = 0.85; this.addPulse();
            }
            break;
          case "CLICK_TOGGLE":
            this.timer -= dt;
            if (this.timer <= 0) {
              app.modal.toggleState = !app.modal.toggleState;
              this.state = "WAIT_TOGGLE"; this.scale = 1; this.timer = 800;
            }
            break;
          case "WAIT_TOGGLE":
            this.timer -= dt;
            if (this.timer <= 0) this.state = "MOVE_TO_CLOSE";
            break;
          case "MOVE_TO_CLOSE":
            this.targetX = this.closeX; this.targetY = this.closeY;
            if (Math.hypot(this.targetX - this.x, this.targetY - this.y) < 5) {
              this.state = "CLICK_CLOSE"; this.timer = 300; this.scale = 0.85; this.addPulse();
            }
            break;
          case "CLICK_CLOSE":
            this.timer -= dt;
            if (this.timer <= 0) {
              app.modal.isOpen = false; this.state = "WAIT_CLOSE"; this.scale = 1; this.timer = 600;
            }
            break;
          case "WAIT_CLOSE":
            this.timer -= dt;
            if (this.timer <= 0 && app.modal.progress < 0.05) {
              this.state = "IDLE"; this.timer = 2000 + Math.random() * 1000;
              this.targetX += (Math.random() - 0.5) * 100; this.targetY += (Math.random() - 0.5) * 100;
              app.modal.sourceCard = null;
            }
            break;
        }
      }
    }

    function generateCards(matrix: number[]): Card[] {
      const cards: Card[] = [];
      let id = 0;
      for (let c = 0; c < matrix.length; c++)
        for (let r = 0; r < matrix[c]; r++)
          cards.push(new Card(id++, c, r));
      return cards;
    }

    const app1 = { cards: generateCards([3, 2, 1]), cursor: new DragDropCursor() };
    const app2 = { cards: generateCards([2, 2, 2]), cursor: new ModalCursor(), modal: { isOpen: false, progress: 0, sourceCard: null as Card | null, toggleState: false } };
    recalculateIndices(app1.cards);
    recalculateIndices(app2.cards);

    function drawBackgroundGlows() {
      const g1 = ctx!.createRadialGradient(width * 0.3, height * 0.3, 0, width * 0.3, height * 0.3, 800);
      g1.addColorStop(0, colors.glowPurple); g1.addColorStop(1, "transparent");
      ctx!.fillStyle = g1; ctx!.fillRect(0, 0, width, height);
      const fx = Math.sin(time * 0.0005) * 100, fy = Math.cos(time * 0.0003) * 100;
      const g2 = ctx!.createRadialGradient(width * 0.7 + fx, height * 0.7 + fy, 0, width * 0.7 + fx, height * 0.7 + fy, 800);
      g2.addColorStop(0, colors.glowSoft); g2.addColorStop(1, "transparent");
      ctx!.fillStyle = g2; ctx!.fillRect(0, 0, width, height);
    }

    function drawKanbanContent(app: { cards: Card[] }) {
      for (let i = 0; i < colsConfig.count; i++) {
        const colX = colsConfig.padding + i * (colWidth + colsConfig.gap);
        const colY = colsConfig.yOffset;
        const colH = winConfig.height - colsConfig.yOffset - colsConfig.padding;
        ctx!.fillStyle = colors.columnBg;
        ctx!.beginPath(); ctx!.roundRect(colX, colY, colWidth, colH, 10); ctx!.fill();
        ctx!.fillStyle = colors.textGhost;
        ctx!.beginPath(); ctx!.roundRect(colX + 15, colY + 15, 50, 6, 3); ctx!.fill();
        app.cards.forEach(card => { if (card.colIndex === i) card.updateTargets(colX, colY + 45); });
      }
      app.cards.filter(c => !c.isDragging).forEach(card => { card.update(); card.draw(ctx!); });
      app.cards.filter(c => c.isDragging).forEach(card => { card.update(); card.draw(ctx!); });
    }

    function drawModalOverlay(app: typeof app2) {
      if (app.modal.progress < 0.01) return;
      const p = app.modal.progress;
      const easeP = 1 - Math.pow(1 - p, 3);
      ctx!.fillStyle = `rgba(0,0,0,${easeP * 0.6})`;
      ctx!.fillRect(0, winConfig.headerHeight, winConfig.width, winConfig.height);
      const card = app.modal.sourceCard;
      if (!card) return;
      const cursor = app.cursor as ModalCursor;
      const targetW = cursor.modalW, targetH = cursor.modalH;
      const targetX = cursor.modalX, targetY = cursor.modalY;
      const x = card.x + (targetX - card.x) * easeP;
      const y = card.y + (targetY - card.y) * easeP;
      const w = colWidth + (targetW - colWidth) * easeP;
      const h = cardConfig.height + (targetH - cardConfig.height) * easeP;
      ctx!.fillStyle = colors.cardBg;
      ctx!.beginPath(); ctx!.roundRect(x, y, w, h, 16); ctx!.fill();
      ctx!.strokeStyle = `rgba(124,58,237,${easeP * 0.4})`; ctx!.lineWidth = 1; ctx!.stroke();
      if (easeP > 0.8) {
        ctx!.globalAlpha = (easeP - 0.8) * 5;
        ctx!.fillStyle = colors.textGhost;
        ctx!.beginPath(); ctx!.roundRect(x + 20, y + 20, 120, 8, 4); ctx!.fill();
        ctx!.beginPath(); ctx!.roundRect(x + 20, y + 36, 160, 5, 3); ctx!.fill();
        const tX = cursor.toggleX, tY = cursor.toggleY;
        ctx!.beginPath(); ctx!.roundRect(x + 20, tY + 8, 100, 5, 3); ctx!.fill();
        ctx!.fillStyle = app.modal.toggleState ? colors.tagPurple : "rgba(255,255,255,0.1)";
        ctx!.beginPath(); ctx!.roundRect(tX, tY, 40, 24, 12); ctx!.fill();
        ctx!.fillStyle = "#FFFFFF";
        ctx!.beginPath(); ctx!.arc(app.modal.toggleState ? tX + 28 : tX + 12, tY + 12, 8, 0, Math.PI * 2); ctx!.fill();
        ctx!.fillStyle = "#665F70";
        ctx!.beginPath(); ctx!.arc(cursor.closeX, cursor.closeY, 6, 0, Math.PI * 2); ctx!.fill();
        ctx!.globalAlpha = 1;
      }
    }

    function drawMacWindow(winX: number, winY: number, app: any, contentCb: (a: any) => void, overlayCb: ((a: any) => void) | null) {
      const floatY = Math.sin(time * 0.0015 + winX) * 10;
      const curWinY = winY + floatY;
      ctx!.save();
      ctx!.translate(winX, curWinY);
      ctx!.shadowColor = "rgba(0,0,0,0.5)"; ctx!.shadowBlur = 50; ctx!.shadowOffsetY = 25;
      ctx!.fillStyle = colors.windowBg;
      ctx!.beginPath(); ctx!.roundRect(0, 0, winConfig.width, winConfig.height, winConfig.radius); ctx!.fill();
      ctx!.save();
      ctx!.beginPath(); ctx!.roundRect(0, 0, winConfig.width, winConfig.height, winConfig.radius); ctx!.clip();
      ctx!.shadowColor = "transparent";
      ctx!.fillStyle = "rgba(0,0,0,0.2)";
      ctx!.beginPath(); ctx!.roundRect(0, 0, winConfig.width, winConfig.headerHeight, [winConfig.radius, winConfig.radius, 0, 0]); ctx!.fill();
      ["#7C3AED", "#6D28D9", "#665F70"].forEach((color, i) => {
        ctx!.fillStyle = color; ctx!.beginPath(); ctx!.arc(20 + i * 22, winConfig.headerHeight / 2, 6, 0, Math.PI * 2); ctx!.fill();
      });
      ctx!.beginPath(); ctx!.moveTo(0, winConfig.headerHeight); ctx!.lineTo(winConfig.width, winConfig.headerHeight);
      ctx!.strokeStyle = "rgba(255,255,255,0.05)"; ctx!.stroke();
      contentCb(app);
      if (overlayCb) overlayCb(app);
      ctx!.restore();
      ctx!.strokeStyle = colors.windowBorder; ctx!.lineWidth = 1;
      ctx!.beginPath(); ctx!.roundRect(0, 0, winConfig.width, winConfig.height, winConfig.radius); ctx!.stroke();
      app.cursor.draw(ctx!);
      ctx!.restore();
    }

    let lastTime = 0;
    let raf = 0;

    function animate(timestamp: number) {
      if (!lastTime) lastTime = timestamp;
      const deltaTime = timestamp - lastTime;
      lastTime = timestamp;
      time = timestamp;
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, width, height);
      drawBackgroundGlows();
      app1.cursor.update(deltaTime, app1);
      app2.cursor.update(deltaTime, app2);
      if (app2.modal.isOpen) { app2.modal.progress += (1 - app2.modal.progress) * 0.1; }
      else { app2.modal.progress += (0 - app2.modal.progress) * 0.1; }
      const targetLeftBlur = Math.max(0, (mouseX - width / 2) / (width / 2));
      const targetRightBlur = Math.max(0, (width / 2 - mouseX) / (width / 2));
      currentLeftBlur += (targetLeftBlur - currentLeftBlur) * 0.05;
      currentRightBlur += (targetRightBlur - currentRightBlur) * 0.05;
      const maxBlurPx = 8, maxDarken = 0.3;
      const maxSafeGap = width - winConfig.width * 2 - 80;
      const idealGap = Math.max(340, width * 0.25);
      const gap = Math.min(idealGap, Math.max(120, maxSafeGap));
      const totalWidth = winConfig.width * 2 + gap;
      const win1X = width / 2 - totalWidth / 2;
      const win1Y = height / 2 - winConfig.height / 2 - 140;
      ctx.save();
      ctx.filter = `blur(${currentLeftBlur * maxBlurPx}px) brightness(${1 - currentLeftBlur * maxDarken})`;
      drawMacWindow(win1X, win1Y, app1, drawKanbanContent, null);
      ctx.restore();
      const win2X = win1X + winConfig.width + gap;
      const win2Y = height / 2 - winConfig.height / 2 + 160;
      ctx.save();
      ctx.filter = `blur(${currentRightBlur * maxBlurPx}px) brightness(${1 - currentRightBlur * maxDarken})`;
      drawMacWindow(win2X, win2Y, app2, drawKanbanContent, drawModalOverlay);
      ctx.restore();
      raf = requestAnimationFrame(animate);
    }

    const onMouseMove = (e: MouseEvent) => { mouseX = e.clientX; };
    const onMouseLeave = () => { mouseX = window.innerWidth / 2; };
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    resize();
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ pointerEvents: "none", position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1 }}
    />
  );
}

interface SysInitLoginProps {
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (profile: SysInitProfile) => void;
  loading: boolean;
  error: string;
  shake: boolean;
}

export function SysInitLogin({
  password,
  onPasswordChange,
  onSubmit,
  loading,
  error,
  shake,
}: SysInitLoginProps) {
  const [selected, setSelected] = useState<SysInitProfile>(() => {
    try {
      const savedEmail = localStorage.getItem(REMEMBER_PROFILE_KEY);
      if (savedEmail) {
        const found = SYS_INIT_PROFILES.find(p => p.email === savedEmail);
        if (found) return found;
      }
    } catch {}
    return SYS_INIT_PROFILES[0];
  });
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(timer);
  }, [selected]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !password.trim()) return;
    try {
      if (remember) {
        localStorage.setItem(REMEMBER_PROFILE_KEY, selected.email);
      } else {
        localStorage.removeItem(REMEMBER_PROFILE_KEY);
      }
      sessionStorage.setItem("lojista-sysinit-user", JSON.stringify(selected));
    } catch {}
    onSubmit(selected);
  };

  const BG = "rgb(17, 17, 26)";
  const CARD_BG = "rgba(22, 22, 30, 0.82)";
  const PRIMARY = "#7C3AED";
  const PRIMARY_GLOW = "#6D28D9";
  const BORDER = "rgba(255, 255, 255, 0.08)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        minHeight: "100dvh",
        overflow: "hidden",
        background: BG,
        color: "#F8F7FC",
        fontFamily: "Inter, 'SF Pro Display', -apple-system, sans-serif",
        WebkitFontSmoothing: "antialiased",
        zIndex: 50,
      }}
    >
      {/* Layer 1: Partículas hero (fundo) */}
      <ParticlesBackground />

      {/* Layer 2: Animação CRM (janelas Mac) */}
      <CRMBackground />

      {/* Grid texture */}
      <div
        style={{
          pointerEvents: "none",
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          minHeight: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          padding:
            "calc(24px + env(safe-area-inset-top, 0px)) 16px calc(24px + env(safe-area-inset-bottom, 0px))",
          boxSizing: "border-box",
        }}
      >
        <section
          style={{
            width: "100%",
            maxWidth: 440,
            background: CARD_BG,
            backdropFilter: "blur(24px) saturate(160%)",
            WebkitBackdropFilter: "blur(24px) saturate(160%)",
            border: `1px solid ${BORDER}`,
            borderRadius: 24,
            padding: "min(36px, 7vw) min(36px, 7vw) min(30px, 6vw)",
            boxShadow:
              "0 10px 40px -10px rgba(0,0,0,0.55), 0 20px 60px -20px rgba(124, 58, 237, 0.45)",
            animation: shake ? "tg-shake 0.45s ease" : "tg-fade-up 0.6s ease both",
          }}
        >
          {/* Brand */}
          <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 30 }}>
            <img
              src="/teltech-logo.png"
              alt="Teltech"
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                objectFit: "cover",
                flexShrink: 0,
                boxShadow: "0 0 20px rgba(124, 58, 237, 0.4)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            />
            <div style={{ lineHeight: 1.25 }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#F8F7FC",
                  letterSpacing: "-0.5px",
                }}
              >
                Teltech Sys-Init
              </h1>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>
                Painel Central Multi-Tenant
              </p>
            </div>
            <span
              style={{
                marginLeft: "auto",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                borderRadius: 20,
                border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,0.04)",
                padding: "4px 10px",
                fontSize: 10,
                fontWeight: 500,
                color: "rgba(255,255,255,0.6)",
              }}
            >
              <ShieldCheck size={12} style={{ color: PRIMARY }} /> Seguro
            </span>
          </header>

          {/* Greeting */}
          <div key={selected.email} style={{ marginBottom: 24, animation: "tg-fade-up 0.5s ease both" }}>
            <h2
              style={{
                margin: 0,
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.5px",
                color: "#F8F7FC",
              }}
            >
              E aí!?{" "}
              <span
                style={{
                  background: `linear-gradient(135deg, ${PRIMARY}, #F3E8FF)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {selected.name}
              </span>{" "}
              <span
                style={{
                  display: "inline-block",
                  animation: "tg-wave 1.6s ease-in-out",
                  transformOrigin: "70% 70%",
                }}
              >
                <Sparkles size={22} style={{ color: PRIMARY, verticalAlign: "middle" }} />
              </span>
            </h2>
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 13,
                fontStyle: "italic",
                color: "rgba(255,255,255,0.38)",
                letterSpacing: "0.01em",
              }}
            >
              {selected.tagline}
            </p>
          </div>

          {/* Profile selector (Tarcísio & Lucas) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
            {SYS_INIT_PROFILES.map(p => {
              const active = p.email === selected.email;
              return (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => setSelected(p)}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    padding: "12px 8px 10px",
                    border: active ? "1.5px solid rgba(124, 58, 237, 0.7)" : `1px solid ${BORDER}`,
                    borderRadius: 16,
                    background: active ? "rgba(124, 58, 237, 0.14)" : "rgba(255,255,255,0.03)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.25s ease",
                    transform: active ? "scale(1.02)" : "scale(1)",
                    boxShadow: active ? "0 0 50px rgba(124, 58, 237, 0.35)" : "none",
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.transform = "";
                      e.currentTarget.style.borderColor = BORDER;
                      e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    }
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      position: "relative",
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_GLOW})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#FFFFFF",
                      transition: "transform 0.3s",
                      transform: active ? "scale(1.05)" : "scale(1)",
                      overflow: "hidden",
                    }}
                  >
                    {p.initials}
                    {active && (
                      <span
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: "50%",
                          animation: "tg-pulse-ring 1.8s ease-out infinite",
                        }}
                      />
                    )}
                  </div>

                  <div style={{ textAlign: "center", lineHeight: 1.3 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: active ? 700 : 500,
                        color: active ? "#F8F7FC" : "rgba(255,255,255,0.7)",
                      }}
                    >
                      {p.name}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{p.role}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Form */}
          <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }} noValidate>
            <div>
              <label
                htmlFor="sysinit-password"
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 6,
                  fontSize: 11,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                <span>Senha</span>
              </label>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  border: error
                    ? "1px solid rgba(124, 58, 237, 0.75)"
                    : "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  transition: "all 0.3s",
                }}
                onFocusCapture={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(124, 58, 237, 0.65)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 50px rgba(124, 58, 237, 0.35)";
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.06)";
                }}
                onBlurCapture={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = error
                    ? "rgba(124, 58, 237, 0.75)"
                    : "rgba(255,255,255,0.1)";
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
                }}
              >
                <input
                  ref={inputRef}
                  id="sysinit-password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => onPasswordChange(e.target.value)}
                  placeholder="••••••••••"
                  aria-label="Senha do Sys-Init"
                  autoComplete="current-password"
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    padding: "13px 16px",
                    fontSize: 14,
                    color: "#F8F7FC",
                    letterSpacing: "0.1em",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "rgba(255,255,255,0.4)",
                    cursor: "pointer",
                    padding: "0 12px",
                    display: "flex",
                    alignItems: "center",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Error */}
              <div
                style={{
                  overflow: "hidden",
                  transition: "all 0.3s",
                  maxHeight: error ? 48 : 0,
                  opacity: error ? 1 : 0,
                  marginTop: error ? 8 : 0,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#F3E8FF",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <AlertCircle size={14} style={{ color: PRIMARY, flexShrink: 0 }} />
                  {error}
                </p>
              </div>
            </div>

            {/* Remember me */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <span
                style={{
                  position: "relative",
                  display: "inline-flex",
                  width: 16,
                  height: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 5,
                  border: remember ? `1.5px solid ${PRIMARY}` : "1.5px solid rgba(255,255,255,0.2)",
                  background: remember ? PRIMARY : "rgba(255,255,255,0.04)",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              >
                {remember && (
                  <svg viewBox="0 0 12 12" style={{ width: 10, height: 10, color: "#FFFFFF" }}>
                    <path
                      d="M2.5 6.5l2.5 2.5 4.5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                />
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                Lembrar-me neste dispositivo
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !password.trim()}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 48,
                width: "100%",
                borderRadius: 13,
                border: "none",
                background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_GLOW})`,
                color: "#FFFFFF",
                fontSize: 14,
                fontWeight: 700,
                cursor: loading || !password.trim() ? "not-allowed" : "pointer",
                opacity: loading || !password.trim() ? 0.6 : 1,
                boxShadow: "0 20px 60px -20px rgba(124, 58, 237, 0.45)",
                transition: "all 0.3s",
                fontFamily: "inherit",
                overflow: "hidden",
              }}
              onMouseEnter={e => {
                if (!loading && password.trim()) e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "";
              }}
            >
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                  animation: loading ? "none" : "tg-shimmer 2.5s ease-in-out infinite",
                }}
              />
              {loading ? (
                <>
                  <span
                    style={{
                      animation: "spin 1s linear infinite",
                      display: "inline-block",
                      fontSize: 16,
                    }}
                  >
                    ⟳
                  </span>
                  Autenticando...
                </>
              ) : (
                <>
                  Entrar
                  <span style={{ fontSize: 15, transition: "transform 0.3s" }}>→</span>
                </>
              )}
            </button>
          </form>

          <p
            style={{
              marginTop: 24,
              textAlign: "center",
              fontSize: 10,
              color: "rgba(255,255,255,0.25)",
            }}
          >
            Protegido com criptografia de ponta a ponta · Teltech © {new Date().getFullYear()}
          </p>
        </section>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes tg-shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-7px); }
          40%, 80% { transform: translateX(7px); }
        }
        @keyframes tg-wave {
          0%, 60%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(14deg); }
          20% { transform: rotate(-8deg); }
          30% { transform: rotate(14deg); }
          40% { transform: rotate(-4deg); }
          50% { transform: rotate(10deg); }
        }
        @keyframes tg-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tg-pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.6); }
          100% { box-shadow: 0 0 0 14px rgba(124, 58, 237, 0); }
        }
        @keyframes tg-shimmer {
          0%   { transform: translateX(-200%); }
          60%, 100% { transform: translateX(200%); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
