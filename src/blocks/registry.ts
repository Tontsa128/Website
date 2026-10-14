import type { BlockType } from "./schema";

export type BlockDefinition = {
  type: BlockType;
  label: string;
  description: string;
  icon: string;
};

export const BLOCK_REGISTRY: Record<BlockType, BlockDefinition> = {
  hero: {
    type: "hero",
    label: "Hero-osio",
    description: "Sivun pääotsikko, kuvaus ja toimintakehote.",
    icon: "✦",
  },
  text: {
    type: "text",
    label: "Teksti",
    description: "Muokattava teksti, otsikot, listat ja linkit.",
    icon: "T",
  },
  image: {
    type: "image",
    label: "Kuva",
    description: "Kuvapaikkamerkki; mediakirjasto lisätään vaiheessa 4.",
    icon: "▧",
  },
  button: {
    type: "button",
    label: "Painike",
    description: "Toimintopainike turvallisella linkkikohteella.",
    icon: "↗",
  },
  columns: {
    type: "columns",
    label: "Sarakkeet",
    description: "Kaksi tai kolme erikseen muokattavaa tekstipalstaa.",
    icon: "▥",
  },
  gallery: {
    type: "gallery",
    label: "Kuvagalleria",
    description: "Useita kuva-arkiston kuvia samassa galleriassa.",
    icon: "▦",
  },
};

export const BLOCK_TYPES = Object.keys(BLOCK_REGISTRY) as BlockType[];
