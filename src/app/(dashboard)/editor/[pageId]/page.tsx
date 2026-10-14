import { notFound } from "next/navigation";

import { PageContentSchema } from "@/blocks/schema";
import { createDefaultPageContent } from "@/blocks/defaults";
import { EditorWorkspace } from "@/components/editor/EditorWorkspace";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PageEditorPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  const supabase = await createClient();

  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("id, site_id, title, content")
    .eq("id", pageId)
    .maybeSingle();

  if (pageError || !page) notFound();

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, name")
    .eq("id", page.site_id)
    .maybeSingle();

  if (siteError || !site) notFound();

  const parsed = PageContentSchema.safeParse(page.content);
  const savedBlocks = parsed.success ? parsed.data : [];
  const initialBlocks =
    savedBlocks.length > 0 ? savedBlocks : createDefaultPageContent();

  return (
    <EditorWorkspace
      pageId={page.id}
      siteId={site.id}
      pageTitle={page.title}
      siteName={site.name}
      initialBlocks={initialBlocks}
      savedContentFingerprint={JSON.stringify(savedBlocks)}
    />
  );
}
