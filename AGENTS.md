# AGENTS.md – Nettisivukone (tekoälyavusteinen sivurakentaja, SaaS)

Tämä tiedosto on ohje koodaavalle tekoälyagentille (Claude Code, Codex, Cursor tms.). Lue koko tiedosto ennen kuin kirjoitat koodia. Pidä tiedosto repon juuressa ja päivitä sitä, kun päätökset muuttuvat.

## 0. Toimintatapa

1. Työskentele pienissä vaiheissa. Yksi vaihe = yksi branch = yksi pull request.
2. Ennen jokaista vaihetta kirjoita lyhyt suunnitelma (tiedostot ja taulut). Sen jälkeen koodaa.
3. Jokaisen vaiheen jälkeen aja `pnpm lint`, `pnpm typecheck`, `pnpm test` ja `pnpm build`. Vaihetta ei merkitä valmiiksi, jos jokin epäonnistuu.
4. Tarkista ajantasaiset versiot ja dokumentaatio ennen Next.js-, Supabase-, Tiptap- tai Stripe-APIen käyttöä. Älä luota pelkkään muistiin.
5. Älä kirjoita salaisuuksia koodiin tai git-repoon. Käytä `.env.local` ja `.env.example` ilman arvoja.
6. Kysy käyttäjältä vain peruuttamattomista tai liiketoiminnallisista päätöksistä. Muut järkevät oletukset kirjataan `docs/DECISIONS.md`:ään.
7. Käyttäjä on yksinkehittäjä ja työskentelee osin puhelimella. README, komennot ja PR-kuvaukset ovat selkeää suomea. Koodi, muuttujat ja commit-viestit ovat englantia.

## 1. Tuote

Selainpohjainen nettisivukone pienyrityksille, yksinyrittäjille ja freelancereille. Käyttäjä kirjautuu, luo sivuston, muokkaa sitä visuaalisesti, kirjoittaa tekstit suoraan sivulle, lisää kuvia kuva-arkistosta, tekee linkkejä sekä alasivuja ja julkaisee. Tekoäly auttaa tekstien, rakenteen ja SEO:n kanssa.

### MVP:n pakolliset ominaisuudet
- Google- ja sähköposti/salasana-kirjautuminen, vahvistus, palautus ja uloskirjautuminen.
- Useita sivustoja käyttäjää kohti, aluksi rajoitettu määrä.
- Rajattoman syvyyden sivupuu, UI:ssa suositus enintään 4 tasoa; järjestely, nimeäminen, kopiointi, poisto ja siirto.
- Lohkopohjainen WYSIWYG-editori Tiptapilla.
- Lohkot: Hero, teksti, kuva, galleria, painike, 2/3 saraketta, lomake, kortit/lista, kartta/yhteystiedot, YouTube-upotus, yläpalkki ja jalkaosa.
- Media library: lataus, kansiot/tagit, esikatselu, alt-teksti, poisto, käyttöseuranta, koonmuunnokset ja WebP.
- Sisäiset, ulkoiset, sähköposti-, puhelin- ja ankkurilinkit.
- Sivupuusta muodostuva navigaatio ja alasivujen pudotusvalikot.
- 3–5 aloitusteemaa sekä värit, fontit ja logo.
- Esikatselu mobiili/tabletti/desktop, luonnos/julkaistu sekä julkaisu alidomainiin.
- AI: chat-first "Luo sivusto kuvauksesta" sekä "Kirjoita / paranna teksti".

### Myöhemmin, ei MVP:ssä
Oma verkkotunnus + SSL, Stripe-tilaukset/krediitit, kuvien generointi, SEO-automaatiot, kävijä-chat, versiohistoria, tiimit/roolit, monikielisyys, blogi, verkkokauppa, analytiikka, jälleenmyyjätila ja white label.

## 2. Teknologiat

- Next.js App Router + TypeScript strict
- Tailwind CSS + shadcn/ui
- Supabase PostgreSQL + Auth + Storage + RLS
- Oma lohkoeditori + Tiptap + dnd-kit
- Zod validointiin
- Zustand editorin tilaan + TanStack Query palvelindataan
- Vitest + Playwright
- Anthropic API palvelinpuolella
- Vercel
- GitHub Actions
- Paketinhallinta `pnpm`, Node uusin LTS

Versiot valitaan toteutushetkellä ajantasaisen dokumentaation perusteella ja kirjataan päätöksiin.

## 3. Arkkitehtuuri

### 3.1 Sovellukset samassa repossa
1. Dashboard + editori: kirjautuneille.
2. Julkaistut sivustot: julkinen renderöinti hostin perusteella.

Sama lohkomäärittely ja renderöijä käytetään editorissa ja julkaistussa sivustossa, jotta esikatselu vastaa tuotosta.

### 3.2 Kansiorakenne
```text
/
├─ AGENTS.md
├─ README.md
├─ docs/
│  ├─ DECISIONS.md
│  ├─ DATA_MODEL.md
│  └─ ROADMAP.md
├─ supabase/
│  ├─ migrations/
│  └─ seed.sql
├─ src/
│  ├─ app/
│  │  ├─ (marketing)/
│  │  ├─ (auth)/
│  │  ├─ (dashboard)/
│  │  ├─ editor/[siteId]/
│  │  ├─ (sites)/
│  │  └─ api/
│  ├─ blocks/
│  ├─ components/
│  ├─ lib/
│  │  ├─ supabase/
│  │  ├─ pages/
│  │  ├─ links/
│  │  ├─ ai/
│  │  └─ seo/
│  ├─ themes/
│  └─ types/
└─ tests/
```

### 3.3 Tietomalli
Kaikissa sovelluksen omissa tauluissa käytetään UUID-tunnistetta sekä `created_at` ja `updated_at` -aikaleimoja. RLS on päällä jokaisessa taulussa.

- `profiles`: auth.users.id, display_name, avatar_url, plan, locale
- `sites`: owner_id, name, slug, theme jsonb, settings jsonb, status draft/published, published_at, custom_domain
- `pages`: site_id, parent_id, title, slug, position, materialisoitu path, show_in_nav, is_home, status, seo jsonb, content jsonb, published_content jsonb; uniikit polut ja sisarusten slugit
- `media`: site_id, owner_id, storage_path, filename, mime, size_bytes, width, height, alt_text, folder_id, tags
- `media_folders`: site_id, parent_id, name
- `forms_submissions`: site_id, page_id, data jsonb, created_at
- `ai_usage`: user_id, site_id, kind, tokens_in, tokens_out, credits, created_at
- `subscriptions`: myöhemmin
- `redirects`: slug-muutosten uudelleenohjaukset

Sivujen siirrossa estetään syklit. Polut päivitetään parent- tai slug-muutoksen yhteydessä lapsiin asti. Sisäiset linkit viittaavat `page_id`:hen, eivät URL-polkuun. Kuvaviitteet käyttävät `media_id`:tä.

### 3.4 Lohkot
```ts
type Block = {
  id: string;
  type: 'hero' | 'text' | 'image' | 'gallery' | 'button' | 'columns' | 'form' | 'cards' | 'embed' | 'map' | 'header' | 'footer';
  version: number;
  props: Record<string, unknown>;
  children?: Block[];
};
```

Jokaisella lohkotyypillä on skeema, editori, renderöijä, oletukset ja kuvake. Rekisteri mahdollistaa uuden lohkon lisäämisen ilman editorin ytimen muuttamista. Rich text tallennetaan Tiptapin JSONina. Käyttäjäsisältöä ei renderöidä raak HTML:nä ilman sanitointia.

### 3.5 Julkaisu
Luonnos ja julkaistu sisältö pidetään erillään. Julkaisu kopioi validoidun luonnoksen `published_content`-kenttään ja revalidioi välimuistin. Julkinen sivu käyttää palvelinrenderöintiä, ISR:ää/välimuistia sekä sitemapia, robots.txt:tä, canonicalia, OG-metatietoja ja 404-sivua.

## 4. Kirjautuminen ja turvallisuus

Supabase Auth: Google OAuth sekä sähköposti/salasana. Vahvistus ja salasanan palautus kuuluvat MVP:hen. Suojatut reitit tarkistavat käyttäjän palvelinpuolella. RLS varmistaa, että käyttäjä voi lukea ja muokata vain omia sivustojaan, sivujaan ja medioitaan. Julkisesti luetaan vain julkaistua sisältöä.

Service role -avain on vain palvelimella ja vain välttämättömissä tapauksissa. Latauksissa tarkistetaan MIME ja koko palvelimella; alkuun esimerkiksi 10 MB ja JPG/PNG/WebP/GIF, SVG vain sanitoinnin kanssa tai myöhemmin. Tiedostot nimetään satunnaisesti. AI- ja lomakerajapinnoissa on rate limiting. Käyttäjäsisältö validoidaan Zodilla palvelimella.

## 5. Editorin UX

Mobile-first, kosketuskäyttö, suora tekstieditointi, kelluva tekstityökalupalkki, lohkojen lisäys/siirto/kopiointi/poisto/piilotus, sivupuu, lohkoasetukset, SEO-paneeli, media- ja linkkivalitsimet, debounce-automaattitallennus, undo/redo ja tallennustila. Poistoista varoitetaan, jos kohteeseen viitataan. WCAG 2.1 AA on tavoitetaso.

## 6. Tekoäly

AI-kutsut kulkevat palvelimen kautta. API-avain ei koskaan selaimeen.

1. Sivuston luonti kuvauksesta: 3–5 kysymystä, rakenteinen JSON, Zod-validointi ja enintään yksi uusi yritys virheessä.
2. Tekstin kirjoitus/parannus: kirjoita, lyhennä, pidennä, paranna ja käännä; käyttäjä hyväksyy tai hylkää.
3. SEO-ehdotukset myöhemmin.
4. `ai_usage` kirjaa kutsut ja käyttörajat.
5. Prompt injection torjutaan käsittelemällä sivuston sisältöä datana, ei ohjeina.
6. AI-sisältö merkitään käyttöliittymässä ja käyttäjälle kerrotaan julkaisuvelvollisuudesta.

## 7. Laki ja kaupallisuus

GDPR: tietosuoja, evästebanneri, tietojen vienti ja poisto. Supabase sijoitetaan EU-alueelle. Käyttöehdot, tietosuojaseloste ja saavutettavuusseloste tehdään käyttäjän/juristin sisällön pohjalta; lakitekstiä ei keksitä. Kuvien oikeuksista varoitetaan. Verkosta ei haeta kuvia ilman lisenssitietoa.

## 8. Laatu

TypeScript strict, ei perusteetonta `any`-tyyppiä. Julkisten sivujen tavoite Lighthouse ≥ 90. Käytetään `next/image`-optimointia. Semanttinen HTML, yksi H1, meta-tagit ja myöhemmin LocalBusiness structured data. Virheilmoitukset ovat selkeitä ja suomeksi. Testataan sivupuu, lohkoskeemat, RLS ja kriittiset Playwright-polut.

Commitit: Conventional Commits (`feat:`, `fix:`, `chore:`).

## 9. Työvaiheet

**Vaihe 0 – Pohja**: repo-rakenne, Next.js + TS + Tailwind + shadcn/ui, ESLint, Prettier, Vitest, GitHub Actions, README, env-example, päätökset, Supabase CLI/migraatiopohja. Valmis kun dev ja CI:n lint/typecheck/test/build toimivat.

**Vaihe 1 – Kirjautuminen**: Supabase Auth, Google, sähköposti, palautus, suojaus, profiles.

**Vaihe 2 – Sivustot ja sivupuu**: sites/pages, RLS, dashboard, syvä sivupuu, järjestely ja testit.

**Vaihe 3 – Editori**: lohkorekisteri, peruslohkot, Tiptap, automaattitallennus, undo/redo ja esikatselu.

**Vaihe 4 – Kuva-arkisto**: Storage, lataus, WebP, kansiot/tagit, alt-tekstit, galleria ja käyttöseuranta.

**Vaihe 5 – Linkit ja navigaatio**: page_id-linkit, ulkoiset yhteydet, valikko, breadcrumb ja redirectit.

**Vaihe 6 – Julkaisu**: teemat, published_content, julkinen renderöinti, sitemap, robots, OG, cache/revalidation.

**Vaihe 7 – Tekoäly**: sivuston luonti, tekstin kirjoitus/parannus, käyttörajat.

**Vaihe 8 – Beta**: lomakkeet, GDPR-työkalut, saavutettavuus, suorituskyky, Playwright, virheseuranta.

**Vaihe 9+**: domainit, maksut, kuvagenerointi, SEO-automaatio, kävijä-chat, versiohistoria, tiimit, monikielisyys, blogi, verkkokauppa ja white label.

## 10. Työjärjestys

Ensimmäisenä luodaan `docs/DECISIONS.md` ja `docs/DATA_MODEL.md`, sen jälkeen toteutetaan Vaihe 0 omaan branchiin ja avataan yksi PR. Vaiheen jälkeen pysähdytään odottamaan hyväksyntää ennen Vaihetta 1.

## 11. Kiellot

- Älä ohita tai poista RLS:ää.
- Älä tallenna salaisuuksia repoon.
- Älä renderöi raakaa käyttäjä-HTML:ää ilman sanitointia.
- Älä lisää suuria riippuvuuksia ilman perustelua päätöksiin.
- Älä rakenna myöhempien vaiheiden ominaisuuksia MVP:n aikana.
- Älä keksi lakitekstejä, hintoja tai tilastoja.
