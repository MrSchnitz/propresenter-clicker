import { useEffect, useRef } from "react";

const COLORS = ["#e94560", "#533483", "#00d672", "#f59e0b", "#3b82f6"];

type Particle = {
  el: HTMLDivElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  age: number;
  life: number;
};

export default function DvdBouncer() {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const state = {
      x: 30 + Math.random() * 80,
      y: 30 + Math.random() * 80,
      dx: 1.6,
      dy: 1.2,
      colorIdx: 0,
    };

    const particles: Particle[] = [];

    function spawnConfetti(x: number, y: number) {
      const parent = el!.parentElement;
      if (!parent) return;
      for (let i = 0; i < 50; i++) {
        const p = document.createElement("div");
        p.style.cssText =
          "position:absolute;left:0;top:0;width:8px;height:8px;border-radius:2px;pointer-events:none;z-index:20;will-change:transform,opacity";
        p.style.backgroundColor =
          COLORS[Math.floor(Math.random() * COLORS.length)];
        parent.appendChild(p);

        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
        const speed = 4 + Math.random() * 6;
        particles.push({
          el: p,
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rot: Math.random() * 360,
          age: 0,
          life: 1800 + Math.random() * 600,
        });
      }
    }

    el.style.backgroundColor = COLORS[0];
    el.style.transform = `translate(${state.x}px, ${state.y}px)`;

    let frameId = 0;

    const tick = () => {
      const parent = el.parentElement;
      if (parent) {
        const pW = parent.clientWidth;
        const pH = parent.clientHeight;
        const w = el.offsetWidth;
        const h = el.offsetHeight;

        state.x += state.dx;
        state.y += state.dy;

        let hitX = false;
        let hitY = false;

        if (state.x <= 0) {
          state.x = 0;
          state.dx = Math.abs(state.dx);
          hitX = true;
        } else if (state.x + w >= pW) {
          state.x = pW - w;
          state.dx = -Math.abs(state.dx);
          hitX = true;
        }
        if (state.y <= 0) {
          state.y = 0;
          state.dy = Math.abs(state.dy);
          hitY = true;
        } else if (state.y + h >= pH) {
          state.y = pH - h;
          state.dy = -Math.abs(state.dy);
          hitY = true;
        }

        if (hitX || hitY) {
          state.colorIdx = (state.colorIdx + 1) % COLORS.length;
          el.style.backgroundColor = COLORS[state.colorIdx];
        }
        if (hitX && hitY) {
          // True corner hit — the moment everyone in The Office was waiting for.
          const cx = state.dx > 0 ? state.x : state.x + w;
          const cy = state.dy > 0 ? state.y : state.y + h;
          spawnConfetti(cx, cy);
        }

        el.style.transform = `translate(${state.x}px, ${state.y}px)`;

        // Update live confetti particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.age += 16;
          p.vy += 0.3; // gravity
          p.x += p.vx;
          p.y += p.vy;
          p.rot += 8;
          p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;
          p.el.style.opacity = String(Math.max(0, 1 - p.age / p.life));
          if (p.age >= p.life) {
            p.el.remove();
            particles.splice(i, 1);
          }
        }
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      for (const p of particles) p.el.remove();
    };
  }, []);

  return (
    <div
      ref={elRef}
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 -z-10 flex items-center rounded-lg px-4 py-2 opacity-60 shadow-lg select-none will-change-transform"
    >
      <img
        src="/pp-logo.svg"
        alt=""
        draggable={false}
        className="h-5 w-auto"
      />
    </div>
  );
}
