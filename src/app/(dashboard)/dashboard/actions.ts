"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type ActionResult = {
  ok: boolean;
  message: string;
  id?: string;
};

const uuidSchema = z.string().uuid();
const siteNameSchema = z.string().trim().min(2).max(60);
const pageTitleSchema = z.string().trim().min(1).max(80);

function publicError(error: unknown): string {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" &&
            error !== null &&
            "message" in error
          ? String(error.message)
          : "";

  if (message.includes("NEXT_PUBLIC_SUPABASE")) {
    return "Tietokantayhteys puuttuu. Aseta Supabasen ympäristömuuttujat.";
  }
  if (/Authentication required|JWT|not authenticated/i.test(message)) {
    return "Kirjaudu sisään ja yritä uudelleen.";
  }
  if (/Site limit reached/i.test(message)) {
    return "Tilillä voi olla enintään kolme sivustoa.";
  }
  if (/Site not found|Page not found|Parent page not found/i.test(message)) {
    return "Kohdetta ei löytynyt tai sinulla ei ole siihen oikeutta.";
  }
  if (/descendant|own parent|cycle/i.test(message)) {
    return "Sivua ei voi siirtää oman alipuunsa alle.";
  }
  if (/between 1 and 80 characters/i.test(message)) {
    return "Sivun nimen pituuden pitää olla 1–80 merkkiä.";
  }
  if (/between 2 and 60 characters/i.test(message)) {
    return "Sivuston nimen pituuden pitää olla 2–60 merkkiä.";
  }
  return "Tallennus ei onnistunut. Tarkista yhteys ja yritä uudelleen.";
}

async function getAuthorizedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { supabase, userId: null };
  }

  return { supabase, userId: data.user.id };
}

async function getPageSiteId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pageId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("pages")
    .select("site_id")
    .eq("id", pageId)
    .maybeSingle();

  return error || !data ? null : data.site_id;
}

export async function createSiteAction(name: string): Promise<ActionResult> {
  const parsedName = siteNameSchema.safeParse(name);
  if (!parsedName.success) {
    return { ok: false, message: "Sivuston nimen pitää olla 2–60 merkkiä." };
  }

  try {
    const { supabase, userId } = await getAuthorizedClient();
    if (!userId) return { ok: false, message: "Kirjaudu sisään ennen sivuston luontia." };

    const { data, error } = await supabase.rpc("create_site", {
      p_name: parsedName.data,
    });
    if (error) return { ok: false, message: publicError(error) };
    if (typeof data !== "string") {
      return { ok: false, message: "Sivuston tunnistetta ei saatu. Yritä uudelleen." };
    }

    revalidatePath("/dashboard");
    return { ok: true, message: "Sivusto luotiin.", id: data };
  } catch (error) {
    return { ok: false, message: publicError(error) };
  }
}

export async function createPageAction(
  siteId: string,
  parentId: string | null,
  title: string,
): Promise<ActionResult> {
  const parsed = z
    .object({
      siteId: uuidSchema,
      parentId: uuidSchema.nullable(),
      title: pageTitleSchema,
    })
    .safeParse({ siteId, parentId, title });

  if (!parsed.success) {
    return { ok: false, message: "Tarkista sivun nimi ja tiedot." };
  }

  try {
    const { supabase, userId } = await getAuthorizedClient();
    if (!userId) return { ok: false, message: "Kirjaudu sisään ennen sivun luontia." };

    const { data, error } = await supabase.rpc("create_page", {
      p_site_id: parsed.data.siteId,
      p_parent_id: parsed.data.parentId,
      p_title: parsed.data.title,
    });
    if (error) return { ok: false, message: publicError(error) };
    if (typeof data !== "string") {
      return { ok: false, message: "Sivun tunnistetta ei saatu. Yritä uudelleen." };
    }

    revalidatePath("/dashboard/sites/" + parsed.data.siteId);
    return { ok: true, message: "Sivu luotiin.", id: data };
  } catch (error) {
    return { ok: false, message: publicError(error) };
  }
}

export async function renamePageAction(
  pageId: string,
  title: string,
): Promise<ActionResult> {
  const parsed = z
    .object({ pageId: uuidSchema, title: pageTitleSchema })
    .safeParse({ pageId, title });
  if (!parsed.success) {
    return { ok: false, message: "Sivun nimen pitää olla 1–80 merkkiä." };
  }

  try {
    const { supabase, userId } = await getAuthorizedClient();
    if (!userId) return { ok: false, message: "Kirjaudu sisään ennen sivun muokkausta." };

    const siteId = await getPageSiteId(supabase, parsed.data.pageId);
    if (!siteId) return { ok: false, message: "Sivua ei löytynyt tai siihen ei ole oikeutta." };

    const { error } = await supabase.rpc("rename_page", {
      p_page_id: parsed.data.pageId,
      p_title: parsed.data.title,
    });
    if (error) return { ok: false, message: publicError(error) };

    revalidatePath("/dashboard/sites/" + siteId);
    return { ok: true, message: "Sivun nimi päivitettiin." };
  } catch (error) {
    return { ok: false, message: publicError(error) };
  }
}

export async function movePageAction(
  pageId: string,
  parentId: string | null,
  position: number,
): Promise<ActionResult> {
  const parsed = z
    .object({
      pageId: uuidSchema,
      parentId: uuidSchema.nullable(),
      position: z.number().int().min(0).max(10000),
    })
    .safeParse({ pageId, parentId, position });

  if (!parsed.success) {
    return { ok: false, message: "Sivun siirtotiedot eivät ole kelvolliset." };
  }

  try {
    const { supabase, userId } = await getAuthorizedClient();
    if (!userId) return { ok: false, message: "Kirjaudu sisään ennen sivun siirtoa." };

    const siteId = await getPageSiteId(supabase, parsed.data.pageId);
    if (!siteId) return { ok: false, message: "Sivua ei löytynyt tai siihen ei ole oikeutta." };

    const { error } = await supabase.rpc("move_page", {
      p_page_id: parsed.data.pageId,
      p_parent_id: parsed.data.parentId,
      p_position: parsed.data.position,
    });
    if (error) return { ok: false, message: publicError(error) };

    revalidatePath("/dashboard/sites/" + siteId);
    return { ok: true, message: "Sivupuu päivitettiin." };
  } catch (error) {
    return { ok: false, message: publicError(error) };
  }
}

export async function copyPageAction(pageId: string): Promise<ActionResult> {
  const parsedId = uuidSchema.safeParse(pageId);
  if (!parsedId.success) {
    return { ok: false, message: "Sivun tunniste ei ole kelvollinen." };
  }

  try {
    const { supabase, userId } = await getAuthorizedClient();
    if (!userId) return { ok: false, message: "Kirjaudu sisään ennen sivun kopiointia." };

    const siteId = await getPageSiteId(supabase, parsedId.data);
    if (!siteId) return { ok: false, message: "Sivua ei löytynyt tai siihen ei ole oikeutta." };

    const { data, error } = await supabase.rpc("copy_page_subtree", {
      p_page_id: parsedId.data,
    });
    if (error) return { ok: false, message: publicError(error) };
    if (typeof data !== "string") {
      return { ok: false, message: "Sivun kopiointi ei palauttanut tunnistetta." };
    }

    revalidatePath("/dashboard/sites/" + siteId);
    return { ok: true, message: "Sivu ja sen alasivut kopioitiin luonnoksiksi.", id: data };
  } catch (error) {
    return { ok: false, message: publicError(error) };
  }
}

export async function setHomePageAction(pageId: string): Promise<ActionResult> {
  const parsedId = uuidSchema.safeParse(pageId);
  if (!parsedId.success) {
    return { ok: false, message: "Sivun tunniste ei ole kelvollinen." };
  }

  try {
    const { supabase, userId } = await getAuthorizedClient();
    if (!userId) return { ok: false, message: "Kirjaudu sisään ennen etusivun asettamista." };

    const siteId = await getPageSiteId(supabase, parsedId.data);
    if (!siteId) return { ok: false, message: "Sivua ei löytynyt tai siihen ei ole oikeutta." };

    const { error } = await supabase.rpc("set_home_page", {
      p_page_id: parsedId.data,
    });
    if (error) return { ok: false, message: publicError(error) };

    revalidatePath("/dashboard/sites/" + siteId);
    return { ok: true, message: "Etusivu päivitettiin." };
  } catch (error) {
    return { ok: false, message: publicError(error) };
  }
}

export async function deletePageAction(pageId: string): Promise<ActionResult> {
  const parsedId = uuidSchema.safeParse(pageId);
  if (!parsedId.success) {
    return { ok: false, message: "Sivun tunniste ei ole kelvollinen." };
  }

  try {
    const { supabase, userId } = await getAuthorizedClient();
    if (!userId) return { ok: false, message: "Kirjaudu sisään ennen sivun poistamista." };

    const siteId = await getPageSiteId(supabase, parsedId.data);
    if (!siteId) return { ok: false, message: "Sivua ei löytynyt tai siihen ei ole oikeutta." };

    const { data, error } = await supabase
      .from("pages")
      .delete()
      .eq("id", parsedId.data)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, message: publicError(error) };
    if (!data) return { ok: false, message: "Sivua ei löytynyt tai sitä ei voitu poistaa." };

    revalidatePath("/dashboard/sites/" + siteId);
    return { ok: true, message: "Sivu ja sen alasivut poistettiin." };
  } catch (error) {
    return { ok: false, message: publicError(error) };
  }
}
