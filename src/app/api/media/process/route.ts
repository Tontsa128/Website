import { Buffer } from "node:buffer";
import sharp from "sharp";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  getExpectedImageFormat,
  isValidInboxObjectPath,
  MAX_MEDIA_PIXELS,
  MAX_MEDIA_UPLOAD_BYTES,
  MAX_MEDIA_EDGE,
  sanitizeOriginalFilename,
} from "@/lib/media/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const processRequestSchema = z.object({
  siteId: z.string().uuid(),
  uploadPath: z.string().min(1).max(180),
  sourceMime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  originalFilename: z.string().min(1).max(255),
  folderId: z.string().uuid().nullable().optional(),
  altText: z.string().max(500).optional().default(""),
}).strict();

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let inboxPathToClean: string | null = null;
  let finalPathToClean: string | null = null;
  let storageClient: Awaited<ReturnType<typeof createClient>> | null = null;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("Pyyntö ei ole kelvollista JSON-muotoa.", 400);
    }

    const parsed = processRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Kuvan käsittelyn tiedot eivät ole kelvollisia.", 400);
    }

    const input = parsed.data;
    const expectedFormat = getExpectedImageFormat(input.sourceMime);
    if (!expectedFormat || !isValidInboxObjectPath(input.siteId, input.uploadPath)) {
      return jsonError("Kuvan tiedostopolku tai tyyppi ei ole sallittu.", 400);
    }

    const pathExtension = input.uploadPath.split("/").at(-1)?.split(".").at(-1)?.toLowerCase();
    const extensionMatches =
      expectedFormat === "jpeg"
        ? pathExtension === "jpg" || pathExtension === "jpeg"
        : expectedFormat === pathExtension;

    if (!extensionMatches) {
      return jsonError("Kuvatiedoston pääte ja ilmoitettu tyyppi eivät täsmää.", 400);
    }

    const supabase = await createClient();
    storageClient = supabase;
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return jsonError("Kirjaudu sisään ennen kuvan lataamista.", 401);
    }

    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("id")
      .eq("id", input.siteId)
      .maybeSingle();

    if (siteError || !site) {
      return jsonError("Sivustoa ei löytynyt tai siihen ei ole latausoikeutta.", 404);
    }

    // Only now, after authentication, ownership and strict path checks, allow cleanup.
    inboxPathToClean = input.uploadPath;

    if (input.folderId) {
      const { data: folder, error: folderError } = await supabase
        .from("media_folders")
        .select("id")
        .eq("id", input.folderId)
        .eq("site_id", input.siteId)
        .maybeSingle();

      if (folderError || !folder) {
        return jsonError("Kuvakansiota ei löytynyt tästä sivustosta.", 400);
      }
    }

    const { data: download, error: downloadError } = await supabase
      .storage
      .from("site-media-inbox")
      .download(input.uploadPath);

    if (downloadError || !download) {
      return jsonError("Alkuperäistä kuvaa ei löytynyt latausalueelta.", 400);
    }

    const inputBuffer = Buffer.from(await download.arrayBuffer());
    if (inputBuffer.byteLength === 0 || inputBuffer.byteLength > MAX_MEDIA_UPLOAD_BYTES) {
      return jsonError("Kuvan koko saa olla enintään 10 MB.", 413);
    }

    const sourceImage = sharp(inputBuffer, {
      limitInputPixels: MAX_MEDIA_PIXELS,
      failOn: "warning",
      animated: false,
    });
    const metadata = await sourceImage.metadata();

    if (metadata.format !== expectedFormat) {
      return jsonError("Tiedoston sisältö ei vastaa sallittua kuvatyyppiä.", 415);
    }
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width * metadata.height > MAX_MEDIA_PIXELS ||
      (metadata.pages !== undefined && metadata.pages > 1)
    ) {
      return jsonError("Kuva on liian suuri tai animoitu. Lataa yksisivuinen kuva.", 415);
    }

    const { data: webp, info } = await sharp(inputBuffer, {
      limitInputPixels: MAX_MEDIA_PIXELS,
      failOn: "warning",
      animated: false,
    })
      .rotate()
      .resize({
        width: MAX_MEDIA_EDGE,
        height: MAX_MEDIA_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (webp.byteLength === 0 || webp.byteLength > MAX_MEDIA_UPLOAD_BYTES) {
      return jsonError("Kuvaa ei voitu pakata sallitun kokoiseksi.", 413);
    }

    const storagePath = input.siteId + "/" + crypto.randomUUID() + ".webp";
    finalPathToClean = storagePath;

    const { error: uploadError } = await supabase.storage
      .from("site-media")
      .upload(storagePath, webp, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return jsonError("Kuvan tallennus epäonnistui. Tarkista Storage-asetukset.", 500);
    }

    const { data: media, error: insertError } = await supabase
      .from("media")
      .insert({
        site_id: input.siteId,
        owner_id: authData.user.id,
        storage_path: storagePath,
        filename: sanitizeOriginalFilename(input.originalFilename),
        mime: "image/webp",
        size_bytes: info.size,
        width: info.width,
        height: info.height,
        alt_text: input.altText.trim(),
        folder_id: input.folderId ?? null,
        tags: [],
      })
      .select("id,site_id,storage_path,filename,mime,size_bytes,width,height,alt_text,folder_id,tags,created_at")
      .single();

    if (insertError || !media) {
      return jsonError("Kuvan tiedot eivät tallentuneet. Yritä uudelleen.", 500);
    }

    // Storage asset and metadata are now paired. Keep the final object.
    finalPathToClean = null;

    const { data: signed, error: signedError } = await supabase.storage
      .from("site-media")
      .createSignedUrl(storagePath, 3600);

    return Response.json({
      media,
      signedUrl: signedError ? null : signed?.signedUrl ?? null,
    });
  } catch {
    return jsonError("Kuvan käsittely epäonnistui. Tarkista tiedosto ja yritä uudelleen.", 400);
  } finally {
    if (storageClient && inboxPathToClean) {
      await storageClient.storage.from("site-media-inbox").remove([inboxPathToClean]).catch(() => undefined);
    }
    if (storageClient && finalPathToClean) {
      await storageClient.storage.from("site-media").remove([finalPathToClean]).catch(() => undefined);
    }
  }
}
