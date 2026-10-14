"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PageContentSchema } from "@/blocks/schema";
import { createClient } from "@/lib/supabase/server";

export type EditorSaveResult = {
  ok: boolean;
  message: string;
};

const pageIdSchema = z.string().uuid();

export async function savePageContentAction(
  pageId: string,
  submittedBlocks: unknown,
): Promise<EditorSaveResult> {
  const parsedPageId = pageIdSchema.safeParse(pageId);
  if (!parsedPageId.success) {
    return { ok: false, message: "Sivun tunniste ei ole kelvollinen." };
  }

  const parsedContent = PageContentSchema.safeParse(submittedBlocks);
  if (!parsedContent.success) {
    return {
      ok: false,
      message: "Sisältöä ei tallennettu, koska se ei vastaa sallittuja lohkoskeemoja.",
    };
  }

  const serialized = JSON.stringify(parsedContent.data);
  if (serialized.length > 250_000) {
    return {
      ok: false,
      message: "Sivun sisältö on liian suuri. Jaa se pienempiin osiin.",
    };
  }

  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return { ok: false, message: "Kirjaudu sisään ennen sivun tallentamista." };
    }

    const { data: page, error: pageError } = await supabase
      .from("pages")
      .select("id")
      .eq("id", parsedPageId.data)
      .maybeSingle();

    if (pageError || !page) {
      return {
        ok: false,
        message: "Sivua ei löytynyt tai sinulla ei ole siihen tallennusoikeutta.",
      };
    }

    const { data: savedPage, error: saveError } = await supabase
      .from("pages")
      .update({ content: parsedContent.data })
      .eq("id", parsedPageId.data)
      .select("id")
      .maybeSingle();

    if (saveError || !savedPage) {
      return {
        ok: false,
        message: "Tallennus epäonnistui. Tarkista yhteys ja yritä uudelleen.",
      };
    }

    revalidatePath("/editor/" + parsedPageId.data);
    return { ok: true, message: "Muutokset tallennettiin." };
  } catch {
    return {
      ok: false,
      message: "Tallennus epäonnistui. Tarkista Supabasen asetukset ja yritä uudelleen.",
    };
  }
}
