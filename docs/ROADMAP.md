# Roadmap

## Vaihe 0 — Pohja
- [x] Next.js + TypeScript + Tailwind + shadcn-tyylinen UI-perusta
- [x] ESLint + Prettier + Vitest
- [x] README + env-example + päätös- ja tietomallidokumentaatio
- [x] GitHub Actions
- [x] Supabase-migraatiopohja
- [ ] CI:n neljän tarkistuksen vihreä tulos

## Vaihe 1 — Kirjautuminen (toteutus kesken PR:ssä #2)
- [ ] Supabase Auth -selain- ja palvelinasiakkaat
- [ ] Google OAuth
- [ ] sähköposti/salasana
- [ ] vahvistus, palautus ja logout
- [ ] suojatut dashboard/editor-reitit
- [ ] profiles + trigger
- [ ] Testaa kaikki kirjautumispolut oikeassa Supabase-projektissa

## Vaihe 2 — Sivustot ja sivupuu (toteutus kesken PR:ssä #3)
- [ ] Sivuston luonti ja käyttäjäkohtainen enintään 3 sivuston raja
- [ ] Sites/pages CRUD ja palvelinpuolen validointi
- [ ] Monitasoinen sivupuu
- [ ] Sivu, alasivu, nimeäminen, kopiointi ja poisto
- [ ] Vedä-ja-pudota-siirto sekä näppäimistöystävälliset järjestyspainikkeet
- [ ] Polkujen päivitys transaktionaalisilla RPC-funktioilla
- [ ] Sivupuun yksikkötestit ja kahden käyttäjän RLS-testit

## Vaihe 3 — Editori (toteutus kesken PR:ssä #4)
- [ ] Versioitu lohkorekisteri ja Zod-skeemat
- [ ] Hero-, teksti-, kuva-, painike- ja sarakelohkot
- [ ] Tiptap-pohjainen suora tekstimuokkaus
- [ ] Lisää, siirrä, poista ja valitse lohko
- [ ] Automaattitallennus ja tallennustila
- [ ] Undo/redo ja tekstin Ctrl+Z
- [ ] Mobiili-, tabletti- ja työpöytäesikatselu
- [ ] Testit lohkoskeemoille ja editorin tilalle
- [ ] Vahvista tietokantatallennus Supabase-projektissa

## Vaihe 4 — Media
- Supabase Storage
- monilataus
- metadata, alt-tekstit
- kansiot/tagit
- WebP-muunnokset
- käyttöseuranta

## Vaihe 5 — Linkit ja navigaatio
- page_id-linkit
- ulkoiset ja yhteystietolinkit
- automaattinen navigaatio
- breadcrumb
- redirects

## Vaihe 6 — Julkaisu
- teemat
- published_content
- host-based routing
- sitemap/robots/OG/404
- ISR ja revalidation

## Vaihe 7 — AI
- chat-first site generation
- structured output + Zod
- tekstin kirjoitus/parannus
- usage limits

## Vaihe 8 — Beta
- lomakkeet
- GDPR-työkalut
- accessibility/performance
- Playwright-kriittiset polut
- virheseuranta

## Beta jälkeen
- oma domain + SSL
- tilaukset ja krediitit
- kuvagenerointi
- SEO-automaatio
- visitor chat
- versiohistoria
- tiimit
- monikielisyys
- blogi
- verkkokauppa
- analytiikka
- reseller/agency
- white label
