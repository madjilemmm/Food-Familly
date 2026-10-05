/**
 * Réduit une photo (souvent 4 à 8 Mo sur iPhone) à 1200 px max en JPEG,
 * pour un envoi rapide et un stockage léger.
 */
export async function resizeImage(file: File, maxSize = 1200, quality = 0.82): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Conversion impossible"))), "image/jpeg", quality),
  );
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}
