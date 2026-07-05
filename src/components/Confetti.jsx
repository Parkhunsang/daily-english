import React, { useEffect, useRef } from "react";

export function Confetti({ active }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Handle high-DPI screens
    const dpr = window.devicePixelRatio || 1;
    const resizeCanvas = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const colors = ["#FF2D55", "#FF9500", "#FFCC00", "#4CD964", "#5AC8FA", "#007AFF", "#5856D6"];
    const particles = [];

    // Create particles from both bottom corners shooting inwards/upwards
    const spawnParticles = () => {
      // Left corner
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: 0,
          y: window.innerHeight,
          vx: Math.random() * 12 + 6,
          vy: -(Math.random() * 18 + 10),
          size: Math.random() * 8 + 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rSpeed: Math.random() * 6 - 3,
          gravity: 0.45,
          drag: 0.97
        });
      }
      // Right corner
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: window.innerWidth,
          y: window.innerHeight,
          vx: -(Math.random() * 12 + 6),
          vy: -(Math.random() * 18 + 10),
          size: Math.random() * 8 + 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rSpeed: Math.random() * 6 - 3,
          gravity: 0.45,
          drag: 0.97
        });
      }
    };

    spawnParticles();

    let duration = 0;

    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      let alive = false;

      particles.forEach((p) => {
        p.vy += p.gravity;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rSpeed;

        if (p.y < window.innerHeight + 50 && p.x > -50 && p.x < window.innerWidth + 50) {
          alive = true;
          
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          
          // Draw rectangles and circles randomly
          if (p.size % 2 === 0) {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          
          ctx.restore();
        }
      });

      duration++;

      // Continue animating for up to 5 seconds if particles are still alive
      if (alive && duration < 300) {
        animationRef.current = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
        display: "block"
      }}
    />
  );
}
