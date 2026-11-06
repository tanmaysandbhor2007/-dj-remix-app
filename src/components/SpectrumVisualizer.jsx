import { useEffect, useRef } from 'react';

export default function SpectrumVisualizer({ getAnalyserData }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      const data = getAnalyserData ? getAnalyserData() : new Uint8Array(128).fill(0);

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);

      const barW = (W / data.length) * 2;
      let x = 0;

      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 255;
        const h = v * H;

        // Color based on frequency
        const hue = (i / data.length) * 240 + 180; // cyan to purple
        const gradient = ctx.createLinearGradient(0, H - h, 0, H);
        gradient.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.9)`);
        gradient.addColorStop(1, `hsla(${hue}, 100%, 30%, 0.3)`);

        ctx.fillStyle = gradient;
        ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
        ctx.shadowBlur = 4;
        ctx.fillRect(x, H - h, barW - 1, h);
        x += barW;
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [getAnalyserData]);

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={120}
      className="spectrum-canvas"
    />
  );
}
