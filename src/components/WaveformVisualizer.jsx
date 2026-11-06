import { useEffect, useRef } from 'react';

export default function WaveformVisualizer({ analyserData, color = '#00f5ff', label }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, W, H);

    if (!analyserData || analyserData.length === 0) {
      // Draw idle line
      ctx.strokeStyle = color + '44';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      return;
    }

    const sliceWidth = W / analyserData.length;
    const gradient = ctx.createLinearGradient(0, 0, W, 0);
    gradient.addColorStop(0, color + '88');
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, color + '88');

    ctx.lineWidth = 2;
    ctx.strokeStyle = gradient;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    ctx.beginPath();
    for (let i = 0; i < analyserData.length; i++) {
      const v = analyserData[i] / 255;
      const barH = v * H;
      const x = i * sliceWidth;
      const y = H - barH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Mirror
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    for (let i = 0; i < analyserData.length; i++) {
      const v = analyserData[i] / 255;
      const barH = v * H * 0.5;
      const x = i * sliceWidth;
      const y = barH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [analyserData, color]);

  return (
    <div className="waveform-container">
      {label && <span className="waveform-label">{label}</span>}
      <canvas ref={canvasRef} width={300} height={80} className="waveform-canvas" />
    </div>
  );
}
