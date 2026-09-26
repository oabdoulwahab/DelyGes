// src/services/avatar.service.ts
// Upload d'avatars multi-appareils via Cloudflare Worker (presigned URL R2).
// Le mobile ne contient AUCUNE clé secrète R2 : simple PUT HTTP natif.

type SupportedExt = "jpg" | "jpeg" | "png" | "webp";

type PresignedUrlResponse = {
  uploadUrl: string;
  publicUrl: string;
  key?: string;
  contentType?: string;
  expiresIn?: number;
};

const RAW_WORKER_URL = (process.env.EXPO_PUBLIC_R2_WORKER_URL ?? "").trim();

function resolveWorkerBaseUrl(): string {
  if (!RAW_WORKER_URL) {
    throw new Error(
      "[Avatar] EXPO_PUBLIC_R2_WORKER_URL manquante dans .env " +
        "(ex: https://ton-worker.workers.dev)"
    );
  }
  // Tolère un .env sans préfixe https:// (erreur fréquente)
  const withScheme = /^https?:\/\//i.test(RAW_WORKER_URL)
    ? RAW_WORKER_URL
    : `https://${RAW_WORKER_URL}`;
  return withScheme.replace(/\/$/, "");
}

function inferExtAndContentType(localUri: string): {
  ext: SupportedExt;
  contentType: string;
} {
  const clean = localUri.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return { ext: "png", contentType: "image/png" };
  if (clean.endsWith(".webp")) return { ext: "webp", contentType: "image/webp" };
  if (clean.endsWith(".jpeg") || clean.endsWith(".jpg"))
    return { ext: "jpg", contentType: "image/jpeg" };
  // expo-image-picker (quality < 1, allowsEditing) renvoie du JPEG par défaut
  return { ext: "jpg", contentType: "image/jpeg" };
}

/** Retire le cache-buster (?t=...) avant persistance en DB. */
export function stripTimestamp(publicUrl: string): string {
  return publicUrl.split("?")[0];
}

async function fetchPresignedUrls(
  userId: string,
  ext: SupportedExt
): Promise<PresignedUrlResponse> {
  const baseUrl = resolveWorkerBaseUrl();
  const url =
    `${baseUrl}/get-upload-url` +
    `?userId=${encodeURIComponent(userId)}&ext=${encodeURIComponent(ext)}`;

  console.log(`[Avatar] 1/3 GET presigned URL -> ${url}`);

  let res: Response;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (e) {
    console.error("[Avatar] ❌ Worker injoignable (réseau/DNS):", e);
    throw new Error("Service d'upload injoignable. Vérifie ta connexion.");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "<illisible>");
    console.error(
      `[Avatar] ❌ Worker a répondu ${res.status}:`,
      body.slice(0, 500)
    );
    throw new Error(`Autorisation d'upload refusée (${res.status}).`);
  }

  let data: PresignedUrlResponse;
  try {
    data = (await res.json()) as PresignedUrlResponse;
  } catch (e) {
    console.error("[Avatar] ❌ Réponse Worker non-JSON:", e);
    throw new Error("Réponse du service d'upload invalide.");
  }

  if (!data.uploadUrl || !data.publicUrl) {
    console.error("[Avatar] ❌ Payload Worker incomplet:", data);
    throw new Error("URLs signées incomplètes reçues du Worker.");
  }

  console.log("[Avatar] 2/3 presigned OK, publicUrl =", data.publicUrl);
  return data;
}

/**
 * Upload un avatar local vers R2 via le Cloudflare Worker.
 * @param localUri URI temporaire expo-image-picker (file://, cache://, content://)
 * @param userId identifiant stable inter-appareils (firebase_uid de préférence)
 * @returns publicUrl pérenne (sans timestamp) à stocker en DB
 */
export async function uploadAvatarToR2(
  localUri: string,
  userId: string
): Promise<{ publicUrl: string }> {
  if (!localUri) throw new Error("[Avatar] localUri vide.");
  if (!userId) throw new Error("[Avatar] userId vide.");

  const { ext, contentType } = inferExtAndContentType(localUri);
  console.log(
    `[Avatar] Démarrage upload userId=${userId} ext=${ext} type=${contentType}`
  );

  // 1. Autorisation : récupère uploadUrl (5 min) + publicUrl
  const { uploadUrl, publicUrl } = await fetchPresignedUrls(userId, ext);

  // 2. Charge le fichier local en Blob (compatible RN/Hermes, sans SDK AWS)
  console.log("[Avatar] 3/3 lecture fichier local + PUT R2...");
  let blob: Blob | null = null;
  try {
    let localRes: Response;
    try {
      localRes = await fetch(localUri);
    } catch (e) {
      console.error("[Avatar] ❌ fetch(localUri) a échoué:", localUri, e);
      throw new Error("Impossible de lire l'image sélectionnée.");
    }
    if (!localRes.ok) {
      console.error("[Avatar] ❌ lecture locale statut:", localRes.status);
      throw new Error("Image locale illisible.");
    }

    try {
      blob = await localRes.blob();
    } catch (e) {
      console.error("[Avatar] ❌ conversion blob échouée:", e);
      throw new Error("Conversion de l'image impossible.");
    }
    console.log(
      `[Avatar] blob prêt (${blob.size} octets), PUT vers R2...`
    );

    // 3. PUT direct sur R2 (URL présignée, pas d'auth nécessaire)
    let putRes: Response;
    try {
      putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: blob as any,
        headers: { "Content-Type": contentType },
      });
    } catch (e) {
      console.error("[Avatar] ❌ PUT R2 (réseau) échoué:", e);
      throw new Error("Échec réseau pendant l'envoi vers R2.");
    }

    if (!putRes.ok) {
      const body = await putRes.text().catch(() => "<illisible>");
      console.error(
        `[Avatar] ❌ PUT R2 a répondu ${putRes.status}:`,
        body.slice(0, 500)
      );
      throw new Error(`Échec de l'envoi vers le stockage (${putRes.status}).`);
    }

    const cleanUrl = stripTimestamp(publicUrl);
    console.log("[Avatar] ✅ Upload réussi:", cleanUrl);
    return { publicUrl: cleanUrl };
  } finally {
    // Toujours libérer la mémoire native du Blob (important sur Android)
    try {
      (blob as any)?.close?.();
    } catch {
      // close() non supporté sur web : ignorer silencieusement
    }
  }
}
