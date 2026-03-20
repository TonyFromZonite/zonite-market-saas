const LOGO_PATHS = [
  "/zonite-logo-watermark.png",
  "/logo192.png",
  "/logo.png",
  "/favicon.ico",
];

const loadImage = (src, crossOrigin = false) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const loadBestLogo = async () => {
  for (const path of LOGO_PATHS) {
    try {
      return await loadImage(path, false);
    } catch {
      // try next fallback
    }
  }
  return null;
};

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const drawFallbackWatermark = (ctx, canvas) => {
  const badgeH = Math.max(52, canvas.height * 0.09);
  const logoSize = badgeH * 0.74;
  const margin = canvas.width * 0.025;
  const textGap = badgeH * 0.12;

  ctx.font = `900 ${badgeH * 0.36}px Arial, sans-serif`;
  const zoniteW = ctx.measureText("ZONITE").width;
  ctx.font = `600 ${badgeH * 0.26}px Arial, sans-serif`;
  const marketW = ctx.measureText("MARKET").width;
  const maxTextW = Math.max(zoniteW, marketW);

  const badgeW = logoSize + textGap * 2 + maxTextW + badgeH * 0.3;
  const bx = canvas.width - badgeW - margin;
  const by = margin;
  const r = badgeH * 0.28;

  drawRoundedRect(ctx, bx, by, badgeW, badgeH, r);
  ctx.fillStyle = "rgba(10,14,46,0.88)";
  ctx.fill();

  const barW = badgeH * 0.1;
  ctx.save();
  drawRoundedRect(ctx, bx, by, barW + r, badgeH, r);
  ctx.clip();
  ctx.fillStyle = "#f5a623";
  ctx.fillRect(bx, by, barW + r, badgeH);
  ctx.restore();

  const logoPadding = badgeH * 0.13;
  const logoX = bx + barW + logoPadding;
  const logoY = by + (badgeH - logoSize) / 2;

  ctx.beginPath();
  ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#f5a623";
  ctx.fill();
  ctx.font = `900 ${logoSize * 0.58}px Arial, sans-serif`;
  ctx.fillStyle = "#0a0e2e";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Z", logoX + logoSize / 2, logoY + logoSize / 2 + 1);

  const tX = logoX + logoSize + textGap;
  ctx.font = `900 ${badgeH * 0.36}px Arial, sans-serif`;
  ctx.fillStyle = "#f5a623";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("ZONITE", tX, by + badgeH * 0.4);

  ctx.font = `600 ${badgeH * 0.26}px Arial, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText("MARKET", tX, by + badgeH * 0.74);
};

const drawUploadedLogoWatermark = (ctx, canvas, logoImg) => {
  const margin = canvas.width * 0.025;
  const badgeH = Math.max(60, canvas.height * 0.12);
  const accentW = badgeH * 0.08;
  const outerPad = badgeH * 0.12;
  const innerPad = badgeH * 0.1;
  const logoRatio = logoImg.naturalWidth / logoImg.naturalHeight || 2.4;

  const cardH = badgeH - outerPad * 2;
  const maxCardW = Math.min(canvas.width * 0.44, cardH * logoRatio);
  const minCardW = Math.max(cardH * 1.8, 130);
  const cardW = Math.max(minCardW, maxCardW);
  const badgeW = accentW + outerPad * 3 + cardW;

  const bx = canvas.width - badgeW - margin;
  const by = margin;
  const outerRadius = badgeH * 0.28;
  const cardX = bx + accentW + outerPad;
  const cardY = by + outerPad;
  const cardRadius = cardH * 0.18;

  drawRoundedRect(ctx, bx, by, badgeW, badgeH, outerRadius);
  ctx.fillStyle = "rgba(10,14,46,0.88)";
  ctx.fill();

  ctx.save();
  drawRoundedRect(ctx, bx, by, accentW + outerRadius, badgeH, outerRadius);
  ctx.clip();
  ctx.fillStyle = "#f5a623";
  ctx.fillRect(bx, by, accentW + outerRadius, badgeH);
  ctx.restore();

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, cardRadius);
  ctx.fillStyle = "rgba(255,255,255,0.98)";
  ctx.fill();

  const availableW = cardW - innerPad * 2;
  const availableH = cardH - innerPad * 2;
  const scale = Math.min(availableW / logoImg.naturalWidth, availableH / logoImg.naturalHeight);
  const drawW = logoImg.naturalWidth * scale;
  const drawH = logoImg.naturalHeight * scale;
  const drawX = cardX + (cardW - drawW) / 2;
  const drawY = cardY + (cardH - drawH) / 2;

  ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
};

export const addWatermark = async (imageUrl) => {
  return new Promise(async (resolve) => {
    try {
      const [productImg, logoImg] = await Promise.all([
        loadImage(imageUrl, true),
        loadBestLogo(),
      ]);

      const canvas = document.createElement("canvas");
      canvas.width = productImg.naturalWidth;
      canvas.height = productImg.naturalHeight;
      const ctx = canvas.getContext("2d");

      ctx.drawImage(productImg, 0, 0, canvas.width, canvas.height);

      if (logoImg) {
        drawUploadedLogoWatermark(ctx, canvas, logoImg);
      } else {
        drawFallbackWatermark(ctx, canvas);
      }

      canvas.toBlob(
        (blob) => resolve(blob || null),
        "image/jpeg",
        0.93,
      );
    } catch (err) {
      console.error("Watermark error:", err);
      resolve(null);
    }
  });
};

export const blobToFile = (blob, name) => {
  return new File([blob], name, { type: "image/jpeg" });
};
