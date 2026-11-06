import { useEffect, useRef } from 'react';

export default function VinylDisc({ isPlaying, speed = 1, color = '#7c3aed' }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const angleRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 4;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);

      // Vinyl base
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(0.3, '#16213e');
      gradient.addColorStop(0.5, '#0f3460');
      gradient.addColorStop(1, '#000');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Grooves
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angleRef.current);
      for (let i = 10; i < r - 10; i += 4) {
        ctx.beginPath();
        ctx.arc(0, 0, i, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,0.03)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label center
      const lR = r * 0.3;
      const labelGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, lR);
      labelGrad.addColorStop(0, color);
      labelGrad.addColorStop(1, color + 'aa');
      ctx.beginPath();
      ctx.arc(0, 0, lR, 0, Math.PI * 2);
      ctx.fillStyle = labelGrad;
      ctx.fill();

      // Spindle hole
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();

      ctx.restore();

      // Glow ring
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = color + '55';
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const animate = () => {
      if (isPlaying) {
        angleRef.current += 0.008 * speed;
      }
      draw();
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, speed, color]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={160}
      style={{ borderRadius: '50%', display: 'block' }}
    />
  );
}
