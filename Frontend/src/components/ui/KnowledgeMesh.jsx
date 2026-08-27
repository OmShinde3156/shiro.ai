import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';

/**
 * 🌿 SHIRO KNOWLEDGE MESH & ARCHITECTURAL GRID
 * High-visibility ambient canvas knowledge graph with:
 * 1. Rich Sage & Gold opacity
 * 2. Academic isometric dot grid pattern
 * 3. Knowledge Hubs with concentric orbital halos
 * 4. Synaptic data pulse particles traveling along lines
 * 5. Interactive cursor constellation illuminator
 */
export const KnowledgeMesh = ({ className = '' }) => {
  const canvasRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    let animationFrameId;
    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;

    // Mouse coordinates
    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      radius: 190
    };

    // Node entity
    class Node {
      constructor(w, h, isHub = false, isGold = false) {
        this.isHub = isHub;
        this.isGold = isGold;
        this.reset(w, h, true);
      }

      reset(w, h, randomInit = false) {
        this.x = randomInit ? Math.random() * w : (Math.random() < 0.5 ? 0 : w);
        this.y = randomInit ? Math.random() * h : Math.random() * h;
        this.baseRadius = this.isHub ? 3.0 + Math.random() * 1.5 : 1.8 + Math.random() * 1.2;
        this.radius = this.baseRadius;
        this.vx = (Math.random() - 0.5) * (this.isHub ? 0.18 : 0.32);
        this.vy = (Math.random() - 0.5) * (this.isHub ? 0.18 : 0.32);
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.pulseSpeed = 0.018 + Math.random() * 0.02;
        this.hoverAlpha = 0;
      }

      update(w, h) {
        this.x += this.vx;
        this.y += this.vy;

        // Wrap around canvas bounds
        const margin = 30;
        if (this.x < -margin) this.x = w + margin;
        if (this.x > w + margin) this.x = -margin;
        if (this.y < -margin) this.y = h + margin;
        if (this.y > h + margin) this.y = -margin;

        this.pulsePhase += this.pulseSpeed;
        
        // Mouse proximity calculation
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < mouse.radius) {
          const factor = (1 - dist / mouse.radius);
          this.radius = this.baseRadius + factor * 2.2;
          this.hoverAlpha = factor * 0.45;
        } else {
          this.radius = this.baseRadius + Math.sin(this.pulsePhase) * 0.35;
          this.hoverAlpha = 0;
        }
      }

      draw(context, isLight) {
        // Center fade mask
        const cx = width / 2;
        const cy = height * 0.42;
        const distFromCenter = Math.hypot((this.x - cx) / (width * 0.48), (this.y - cy) / (height * 0.48));
        const centerFactor = Math.min(Math.max(distFromCenter - 0.15, 0.28), 1.0);

        // Colors
        let coreColor, haloColor;
        if (this.isGold) {
          const alpha = Math.min(0.55 + this.hoverAlpha, 1.0) * centerFactor;
          coreColor = isLight ? `rgba(214, 168, 79, ${alpha.toFixed(3)})` : `rgba(229, 184, 105, ${alpha.toFixed(3)})`;
          haloColor = isLight ? `rgba(214, 168, 79, ${(alpha * 0.35).toFixed(3)})` : `rgba(229, 184, 105, ${(alpha * 0.35).toFixed(3)})`;
        } else {
          const alpha = Math.min((this.isHub ? 0.48 : 0.38) + this.hoverAlpha, 1.0) * centerFactor;
          coreColor = isLight ? `rgba(63, 96, 72, ${alpha.toFixed(3)})` : `rgba(137, 168, 141, ${alpha.toFixed(3)})`;
          haloColor = isLight ? `rgba(63, 96, 72, ${(alpha * 0.32).toFixed(3)})` : `rgba(137, 168, 141, ${(alpha * 0.32).toFixed(3)})`;
        }

        // Draw Hub Concentric Orbit Rings
        if (this.isHub) {
          const orbitRadius = this.radius * (2.4 + Math.sin(this.pulsePhase) * 0.3);
          context.beginPath();
          context.arc(this.x, this.y, orbitRadius, 0, Math.PI * 2);
          context.strokeStyle = haloColor;
          context.lineWidth = 1;
          context.stroke();

          // Outer secondary orbit ring
          const outerOrbit = orbitRadius * 1.6;
          context.beginPath();
          context.arc(this.x, this.y, outerOrbit, 0, Math.PI * 2);
          context.strokeStyle = haloColor;
          context.setLineDash([2, 4]);
          context.lineWidth = 0.8;
          context.stroke();
          context.setLineDash([]);
        }

        // Draw Core Node
        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fillStyle = coreColor;
        context.fill();

        // Subtle core glow for hover / hub
        if (this.hoverAlpha > 0.05 || this.isHub) {
          context.beginPath();
          context.arc(this.x, this.y, this.radius * 1.8, 0, Math.PI * 2);
          context.fillStyle = haloColor;
          context.fill();
        }
      }
    }

    // Synaptic Pulse Particle entity
    class Pulse {
      constructor(nodeA, nodeB, isLight) {
        this.nodeA = nodeA;
        this.nodeB = nodeB;
        this.progress = 0;
        this.speed = 0.008 + Math.random() * 0.012;
        this.isLight = isLight;
        this.isGold = nodeA.isGold || nodeB.isGold;
      }

      update() {
        this.progress += this.speed;
        return this.progress < 1;
      }

      draw(context, isLight) {
        const x = this.nodeA.x + (this.nodeB.x - this.nodeA.x) * this.progress;
        const y = this.nodeA.y + (this.nodeB.y - this.nodeA.y) * this.progress;
        const radius = 1.4;

        const color = this.isGold
          ? (isLight ? 'rgba(214, 168, 79, 0.75)' : 'rgba(229, 184, 105, 0.85)')
          : (isLight ? 'rgba(63, 96, 72, 0.65)' : 'rgba(168, 197, 172, 0.75)');

        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();
      }
    }

    let nodes = [];
    let pulses = [];

    const initNodes = () => {
      const count = Math.min(Math.max(Math.floor((width * height) / 22000), 32), 56);
      nodes = [];
      for (let i = 0; i < count; i++) {
        const isHub = i % 5 === 0; // 20% hub nodes
        const isGold = i % 7 === 0; // Distinctive gold landmark nodes
        nodes.push(new Node(width, height, isHub, isGold));
      }
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth;
      height = canvas.parentElement ? canvas.parentElement.clientHeight : window.innerHeight;
      dpr = window.devicePixelRatio || 1;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
      initNodes();
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.targetX = -1000;
      mouse.targetY = -1000;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    handleResize();

    // Draw Academic Architectural Dot Grid
    const drawGrid = (isLight) => {
      const gridSize = 48;
      const dotRadius = 0.9;
      const gridAlpha = isLight ? '0.12' : '0.10';
      ctx.fillStyle = isLight ? `rgba(63, 96, 72, ${gridAlpha})` : `rgba(137, 168, 141, ${gridAlpha})`;

      for (let x = gridSize / 2; x < width; x += gridSize) {
        for (let y = gridSize / 2; y < height; y += gridSize) {
          // Center falloff so center remains ultra clean
          const cx = width / 2;
          const cy = height * 0.42;
          const dist = Math.hypot((x - cx) / (width * 0.5), (y - cy) / (height * 0.5));
          if (dist > 0.35) {
            ctx.beginPath();
            ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    };

    const maxConnectionDistance = 145;

    // Render loop
    const render = () => {
      // Smooth mouse interpolation
      mouse.x += (mouse.targetX - mouse.x) * 0.1;
      mouse.y += (mouse.targetY - mouse.y) * 0.1;

      ctx.clearRect(0, 0, width, height);

      const isLight = document.body.classList.contains('theme-light') || theme === 'light';

      // 1. Draw Architectural Dot Grid Matrix
      drawGrid(isLight);

      // 2. Draw connecting lines between nodes
      for (let i = 0; i < nodes.length; i++) {
        const nodeA = nodes[i];
        nodeA.update(width, height);

        for (let j = i + 1; j < nodes.length; j++) {
          const nodeB = nodes[j];
          const dx = nodeA.x - nodeB.x;
          const dy = nodeA.y - nodeB.y;
          const dist = Math.hypot(dx, dy);

          if (dist < maxConnectionDistance) {
            const proximityFactor = 1 - dist / maxConnectionDistance;
            
            // Check if mouse is near this line
            const midX = (nodeA.x + nodeB.x) / 2;
            const midY = (nodeA.y + nodeB.y) / 2;
            const mouseDist = Math.hypot(mouse.x - midX, mouse.y - midY);
            const mouseBoost = mouseDist < 140 ? (1 - mouseDist / 140) * 0.35 : 0;

            // Center mask
            const cx = width / 2;
            const cy = height * 0.42;
            const distFromCenter = Math.hypot((midX - cx) / (width * 0.48), (midY - cy) / (height * 0.48));
            const centerFactor = Math.min(Math.max(distFromCenter - 0.15, 0.22), 1.0);

            const isGoldLine = nodeA.isGold || nodeB.isGold;
            const baseOpacity = isGoldLine ? 0.16 : 0.12;
            const alpha = ((baseOpacity + mouseBoost) * proximityFactor * centerFactor).toFixed(3);
            
            ctx.beginPath();
            ctx.moveTo(nodeA.x, nodeA.y);
            ctx.lineTo(nodeB.x, nodeB.y);
            
            if (isGoldLine) {
              ctx.strokeStyle = isLight 
                ? `rgba(214, 168, 79, ${alpha})`
                : `rgba(229, 184, 105, ${alpha})`;
            } else {
              ctx.strokeStyle = isLight 
                ? `rgba(63, 96, 72, ${alpha})`
                : `rgba(137, 168, 141, ${alpha})`;
            }
            
            ctx.lineWidth = mouseBoost > 0.05 ? 1.4 : 1;
            ctx.stroke();

            // Randomly spawn traveling synaptic pulse particles
            if (Math.random() < 0.0012 && pulses.length < 8) {
              pulses.push(new Pulse(nodeA, nodeB, isLight));
            }
          }
        }
      }

      // 3. Update and draw traveling synaptic pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        const pulse = pulses[i];
        if (pulse.update()) {
          pulse.draw(ctx, isLight);
        } else {
          pulses.splice(i, 1);
        }
      }

      // 4. Draw nodes & orbital halos
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].draw(ctx, isLight);
      }

      // 5. Draw gentle interactive beacon around mouse
      if (mouse.x > 0 && mouse.y > 0) {
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 45, 0, Math.PI * 2);
        ctx.strokeStyle = isLight ? 'rgba(63, 96, 72, 0.14)' : 'rgba(137, 168, 141, 0.16)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [theme]);

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden -z-10 select-none ${className}`}>
      {/* Subtle Upper Ambient Illumination */}
      <div 
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[350px] rounded-full blur-[140px] pointer-events-none opacity-40 dark:opacity-25"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(107, 143, 113, 0.22) 0%, rgba(214, 168, 79, 0.08) 50%, transparent 80%)'
        }}
      />
      {/* Canvas Knowledge Mesh & Architectural Grid */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};

export default KnowledgeMesh;
