// No-op watermark — returns the original image unchanged
export const addWatermark = async (imageUrl) => {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return blob;
  } catch {
    return null;
  }
};

export const blobToFile = (blob, name) => {
  return new File([blob], name, { type: 'image/jpeg' });
};
