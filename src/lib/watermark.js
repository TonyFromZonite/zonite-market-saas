export const addWatermark = async (imageUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(img, 0, 0);

      const badgeW = Math.min(img.naturalWidth * 0.38, 320);
      const badgeH = badgeW * 0.18;
      const margin = img.naturalWidth * 0.025;
      const bx = img.naturalWidth - badgeW - margin;
      const by = margin;
      const radius = badgeH / 2;

      // Dark pill background
      ctx.beginPath();
      ctx.moveTo(bx + radius, by);
      ctx.lineTo(bx + badgeW - radius, by);
      ctx.arcTo(bx + badgeW, by, bx + badgeW, by + radius, radius);
      ctx.lineTo(bx + badgeW, by + badgeH - radius);
      ctx.arcTo(bx + badgeW, by + badgeH, bx + badgeW - radius, by + badgeH, radius);
      ctx.lineTo(bx + radius, by + badgeH);
      ctx.arcTo(bx, by + badgeH, bx, by + badgeH - radius, radius);
      ctx.lineTo(bx, by + radius);
      ctx.arcTo(bx, by, bx + radius, by, radius);
      ctx.closePath();
      ctx.fillStyle = 'rgba(10, 14, 46, 0.82)';
      ctx.fill();

      // Orange accent
      const accentW = badgeW * 0.06;
      ctx.fillStyle = '#f5a623';
      ctx.beginPath();
      ctx.moveTo(bx + radius, by);
      ctx.lineTo(bx + radius + accentW, by);
      ctx.lineTo(bx + radius + accentW, by + badgeH);
      ctx.lineTo(bx + radius, by + badgeH);
      ctx.arcTo(bx, by + badgeH, bx, by + badgeH - radius, radius);
      ctx.lineTo(bx, by + radius);
      ctx.arcTo(bx, by, bx + radius, by, radius);
      ctx.closePath();
      ctx.fill();

      // Z circle
      const logoSize = badgeH * 0.65;
      const logoX = bx + badgeW * 0.1 + logoSize / 2;
      const logoY = by + badgeH / 2;
      ctx.beginPath();
      ctx.arc(logoX, logoY, logoSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#f5a623';
      ctx.fill();
      ctx.font = `900 ${logoSize * 0.62}px Arial, sans-serif`;
      ctx.fillStyle = '#0a0e2e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Z', logoX, logoY + 1);

      // Text
      const textX = bx + badgeW * 0.22;
      ctx.font = `900 ${badgeH * 0.36}px Arial, sans-serif`;
      ctx.fillStyle = '#f5a623';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('ZONITE', textX, by + badgeH * 0.38);

      ctx.font = `400 ${badgeH * 0.26}px Arial, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('MARKET', textX, by + badgeH * 0.7);

      canvas.toBlob(
        (blob) => resolve(blob || null),
        'image/jpeg',
        0.92
      );
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
};

export const blobToFile = (blob, name) => {
  return new File([blob], name, { type: 'image/jpeg' });
};
