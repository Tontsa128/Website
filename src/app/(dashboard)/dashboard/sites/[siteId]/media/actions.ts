"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  countMediaUsageByPage,
  sanitizeOriginalFilename,
} from "@/lib/media/validation";
import { createClient } from "@/lib/supabase/server";

export type MediaActionResult = {
  ok: boolean;
  message: string;
  id?: string;
};

const uuid = z.string().uuid();
const folderNameSchema = z.string().trim().min(1).max(50);
const altTextSchema = z.string().max(500);
const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(10);

function actionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/NEXT_PUBLIC_SUPABASE/.test(message)) {
    return "Supabase-yhteys puuttuu. Lisää ympäristömuuttujat.";
  }
  if (/duplicate key|already exists|unique/i.test(message)) {
    return "Samanniminen kohde on jo olemassa.";
  }
  return "Toiminto epäonnistui. Tarkista tiedot ja yritä uudelleen.";
}

async function ownedSite(siteId: string) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return { supabase, userId: null, siteId: null };

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .maybeSingle();

  return {
    supabase,
    userId: auth.user.id,
    siteId: siteError || !site ? null : site.id,
  };
}

function refreshMedia(siteId: string): void {
  revalidatePath("/dashboard/sites/" + siteId + "/media");
  revalidatePath("/dashboard/sites/" + siteId);
}

export async function createMediaFolderAction(
  siteId: string,
  name: string,
): Promise<MediaActionResult> {
  const parsed = z.object({ siteId: uuid, name: folderNameSchema }).safeParse({ siteId, name });
  if (!parsed.success) {
    return { ok: false, message: "Kansion nimen pitää olla 1–50 merkkiä." };
  }

  try {
    const { supabase, userId, siteId: ownedId } = await ownedSite(parsed.data.siteId);
    if (!userId || !ownedId) return { ok: false, message: "Sivustoa ei löytynyt tai et ole kirjautunut." };

    const { data, error } = await supabase
      .from("media_folders")
      .insert({ site_id: ownedId, name: parsed.data.name })
      .select("id")
      .single();

    if (error || !data) return { ok: false, message: actionErrorMessage(error) };
    refreshMedia(ownedId);
    return { ok: true, message: "Kansio luotiin.", id: data.id };
  } catch (error) {
    return { ok: false, message: actionErrorMessage(error) };
  }
}

export async function renameMediaFolderAction(
  folderId: string,
  name: string,
): Promise<MediaActionResult> {
  const parsed = z.object({ folderId: uuid, name: folderNameSchema }).safeParse({ folderId, name });
  if (!parsed.success) return { ok: false, message: "Tarkista kansion nimi." };

  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, message: "Kirjaudu sisään." };

    const { data: folder, error: folderError } = await supabase
      .from("media_folders")
      .select("id,site_id")
      .eq("id", parsed.data.folderId)
      .maybeSingle();

    if (folderError || !folder) return { ok: false, message: "Kansiota ei löytynyt." };

    const { error } = await supabase
      .from("media_folders")
      .update({ name: parsed.data.name })
      .eq("id", folder.id);

    if (error) return { ok: false, message: actionErrorMessage(error) };
    refreshMedia(folder.site_id);
    return { ok: true, message: "Kansion nimi päivitettiin." };
  } catch (error) {
    return { ok: false, message: actionErrorMessage(error) };
  }
}

export async function deleteMediaFolderAction(
  folderId: string,
): Promise<MediaActionResult> {
  const parsedId = uuid.safeParse(folderId);
  if (!parsedId.success) return { ok: false, message: "Kansion tunniste ei ole kelvollinen." };

  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, message: "Kirjaudu sisään." };

    const { data: folder, error: folderError } = await supabase
      .from("media_folders")
      .select("id,site_id")
      .eq("id", parsedId.data)
      .maybeSingle();

    if (folderError || !folder) return { ok: false, message: "Kansiota ei löytynyt." };

    const { error } = await supabase
      .from("media_folders")
      .delete()
      .eq("id", folder.id)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, message: actionErrorMessage(error) };
    refreshMedia(folder.site_id);
    return { ok: true, message: "Kansio poistettiin. Kansion kuvat säilyivät kuva-arkistossa." };
  } catch (error) {
    return { ok: false, message: actionErrorMessage(error) };
  }
}

export async function updateMediaMetadataAction(
  mediaId: string,
  altText: string,
  folderId: string | null,
  tags: string[],
): Promise<MediaActionResult> {
  const parsed = z.object({
    mediaId: uuid,
    altText: altTextSchema,
    folderId: uuid.nullable(),
    tags: tagsSchema,
  }).safeParse({ mediaId, altText, folderId, tags });

  if (!parsed.success) {
    return { ok: false, message: "Alt-teksti tai tunnisteet eivät ole kelvollisia." };
  }

  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, message: "Kirjaudu sisään." };

    const { data: media, error: mediaError } = await supabase
      .from("media")
      .select("id,site_id")
      .eq("id", parsed.data.mediaId)
      .maybeSingle();

    if (mediaError || !media) return { ok: false, message: "Kuvaa ei löytynyt." };

    if (parsed.data.folderId) {
      const { data: folder, error: folderError } = await supabase
        .from("media_folders")
        .select("id")
        .eq("id", parsed.data.folderId)
        .eq("site_id", media.site_id)
        .maybeSingle();

      if (folderError || !folder) return { ok: false, message: "Valitse saman sivuston kansio." };
    }

    const uniqueTags = [...new Set(parsed.data.tags.map((tag) => tag.trim()).filter(Boolean))];
    const { error } = await supabase
      .from("media")
      .update({
        alt_text: parsed.data.altText.trim(),
        folder_id: parsed.data.folderId,
        tags: uniqueTags,
      })
      .eq("id", media.id);

    if (error) return { ok: false, message: actionErrorMessage(error) };
    refreshMedia(media.site_id);
    return { ok: true, message: "Kuvan tiedot tallennettiin." };
  } catch (error) {
    return { ok: false, message: actionErrorMessage(error) };
  }
}

export async function deleteMediaAction(mediaId: string): Promise<MediaActionResult> {
  const parsedId = uuid.safeParse(mediaId);
  if (!parsedId.success) return { ok: false, message: "Kuvan tunniste ei ole kelvollinen." };

  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, message: "Kirjaudu sisään." };

    const { data: media, error: mediaError } = await supabase
      .from("media")
      .select("id,site_id,storage_path,filename")
      .eq("id", parsedId.data)
      .maybeSingle();

    if (mediaError || !media) return { ok: false, message: "Kuvaa ei löytynyt." };

    const { data: pages, error: pagesError } = await supabase
      .from("pages")
      .select("id,content,published_content")
      .eq("site_id", media.site_id);

    if (pagesError || !pages) {
      return { ok: false, message: "Kuvan käyttökohteita ei voitu tarkistaa; kuvaa ei poistettu." };
    }

    const usageCount = countMediaUsageByPage(pages, media.id);
    if (usageCount > 0) {
      return {
        ok: false,
        message: "Kuva on käytössä " + usageCount + " sivulla. Vaihda tai poista kuvan viittaukset ennen poistamista.",
      };
    }

    const { error: storageError } = await supabase.storage
      .from("site-media")
      .remove([media.storage_path]);

    if (storageError) {
      return { ok: false, message: "Tiedostoa ei voitu poistaa tallennuksesta. Kuva säilytettiin arkistossa." };
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("media")
      .delete()
      .eq("id", media.id)
      .select("id")
      .maybeSingle();

    if (deleteError || !deleted) {
      return {
        ok: false,
        message: "Tiedosto poistettiin, mutta tietueen poisto epäonnistui. Ota yhteys ylläpitoon.",
      };
    }

    refreshMedia(media.site_id);
    return { ok: true, message: "Kuva poistettiin." };
  } catch (error) {
    return { ok: false, message: actionErrorMessage(error) };
  }
}
