export const pendingPhotoKey = "ouahid:pending-patient-photo";
export const photoIdentity = (firstName: string, lastName: string, phone: string, birthDate: string | null) => JSON.stringify([firstName.trim(), lastName.trim(), phone.trim(), birthDate || ""]);

export async function resizePatientPhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choisissez une image JPG, PNG ou WebP.");
  if (file.size > 10 * 1024 * 1024) throw new Error("La photo doit faire moins de 10 Mo.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    const ratio = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Impossible de préparer cette photo.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", .85);
  } finally { URL.revokeObjectURL(url); }
}
