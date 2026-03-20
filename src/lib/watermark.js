const LOGO_PATHS = ['/logo192.png', '/logo.png', '/logo512.png', '/favicon.ico'];

export const addWatermark = async (imageUrl) => {
  return new Promise(async (resolve) => {
    try {
      const productImg = new Image();
      productImg.crossOrigin = 'anonymous';

      const logoImg = new Image();

      await Promise.all([
        new Promise((res, rej) => {
          productImg.onload = res;
          productImg.onerror = rej;
          productImg.src = imageUrl;
        }),
        new Promise((res) => {
          const tryLoad = (idx) => {
            if (idx >= LOGO_PATHS.length) { res(); return; }
            const img = new Image();
            img.onload = () => {
              logoImg.src = img.src;
              logoImg.width = img.width;
              logoImg.height = img.height;
              // Copy natural dimensions
              Object.defineProperty(logoImg, 'naturalWidth', { value: img.naturalWidth, writable: true });
              Object.defineProperty(logoImg, 'naturalHeight', { value: img.naturalHeight, writable: true });
              res();
            };
            img.onerror = () => tryLoad(idx + 1);
            img.src = LOGO_PATHS[idx];
          };
          tryLoad(0);
        })
      ]);

      const canvas = document.createElement('canvas');
      canvas.width = productImg.naturalWidth;
      canvas.height = productImg.naturalHeight;
      const ctx = canvas.getContext('2d');

      // Draw product image
      ctx.drawImage(productImg, 0, 0);

      // Badge dimensions
      const badgeH = Math.max(52, canvas.height * 0.09);
      const logoSize = badgeH * 0.74;
      const margin = canvas.width * 0.025;
      const textGap = badgeH * 0.12;

      // Measure text
      ctx.font = `900 ${badgeH * 0.36}px Arial, sans-serif`;
      const zoniteW = ctx.measureText('ZONITE').width;
      ctx.font = `600 ${badgeH * 0.26}px Arial, sans-serif`;
      const marketW = ctx.measureText('MARKET').width;
      const maxTextW = Math.max(zoniteW, marketW);

      const badgeW = logoSize + textGap * 2 + maxTextW + badgeH * 0.3;
      const bx = canvas.width - badgeW - margin;
      const by = margin;
      const r = badgeH * 0.28;

      // Dark pill background
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + badgeW - r, by);
      ctx.quadraticCurveTo(bx + badgeW, by, bx + badgeW, by + r);
      ctx.lineTo(bx + badgeW, by + badgeH - r);
      ctx.quadraticCurveTo(bx + badgeW, by + badgeH, bx + badgeW - r, by + badgeH);
      ctx.lineTo(bx + r, by + badgeH);
      ctx.quadraticCurveTo(bx, by + badgeH, bx, by + badgeH - r);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();
      ctx.fillStyle = 'rgba(10,14,46,0.88)';
      ctx.fill();

      // Orange left accent bar
      const barW = badgeH * 0.1;
      ctx.fillStyle = '#f5a623';
      ctx.beginPath();
      ctx.moveTo(bx + r, by);
      ctx.lineTo(bx + barW, by);
      ctx.lineTo(bx + barW, by + badgeH);
      ctx.lineTo(bx + r, by + badgeH);
      ctx.quadraticCurveTo(bx, by + badgeH, bx, by + badgeH - r);
      ctx.lineTo(bx, by + r);
      ctx.quadraticCurveTo(bx, by, bx + r, by);
      ctx.closePath();
      ctx.fill();

      // Logo
      const logoPadding = badgeH * 0.13;
      const logoX = bx + barW + logoPadding;
      const logoY = by + (badgeH - logoSize) / 2;
      const logoLoaded = logoImg.src && logoImg.naturalWidth > 0;

      if (logoLoaded) {
        // Draw real logo with rounded corners
        ctx.save();
        const lR = logoSize * 0.18;
        ctx.beginPath();
        ctx.moveTo(logoX + lR, logoY);
        ctx.lineTo(logoX + logoSize - lR, logoY);
        ctx.quadraticCurveTo(logoX + logoSize, logoY, logoX + logoSize, logoY + lR);
        ctx.lineTo(logoX + logoSize, logoY + logoSize - lR);
        ctx.quadraticCurveTo(logoX + logoSize, logoY + logoSize, logoX + logoSize - lR, logoY + logoSize);
        ctx.lineTo(logoX + lR, logoY + logoSize);
        ctx.quadraticCurveTo(logoX, logoY + logoSize, logoX, logoY + logoSize - lR);
        ctx.lineTo(logoX, logoY + lR);
        ctx.quadraticCurveTo(logoX, logoY, logoX + lR, logoY);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        ctx.restore();
      } else {
        // Fallback: orange circle with Z
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#f5a623';
        ctx.fill();
        ctx.font = `900 ${logoSize * 0.58}px Arial, sans-serif`;
        ctx.fillStyle = '#0a0e2e';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Z', logoX + logoSize / 2, logoY + logoSize / 2 + 1);
      }

      // Text
      const tX = logoX + logoSize + textGap;

      ctx.font = `900 ${badgeH * 0.36}px Arial, sans-serif`;
      ctx.fillStyle = '#f5a623';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('ZONITE', tX, by + badgeH * 0.40);

      ctx.font = `600 ${badgeH * 0.26}px Arial, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText('MARKET', tX, by + badgeH * 0.74);

      canvas.toBlob(
        (blob) => resolve(blob || null),
        'image/jpeg',
        0.93
      );
    } catch (err) {
      console.error('Watermark error:', err);
      resolve(null);
    }
  });
};

export const blobToFile = (blob, name) => {
  return new File([blob], name, { type: 'image/jpeg' });
};
