# Päätökset

## 2026-10-14 – Vaihe 0

### Tekninen perusta
- Next.js 16.4.0 + App Router valittiin, koska se on toteutushetkellä uusin vakaa Next.js-julkaisu.
- React 19.3.0 valittiin Next.js 16.4:n kanssa.
- TypeScript pidetään strict-tilassa. Käytössä on toteutushetkellä vakaa TypeScript 6.0.3.
- Paketinhallinta on pnpm 12.10.0. Node-vaatimus on vähintään 24, joka vastaa uutta LTS-linjaa ja ESLintin tuettua ympäristöä.
- Tailwind CSS 4.3.3 otetaan käyttöön PostCSS-pluginilla.
- shadcn/ui:n komponenttityyli aloitetaan kevyellä `src/components/ui`-rakenteella; komponentit pidetään sovelluksen lähdekoodissa, jotta riippuvuuksia ei kasvateta turhaan.
- Vitest toimii yksikkötestien perustana. Playwright lisätään vasta kun ensimmäinen kriittinen käyttöpolku on olemassa.

### Supabase
- Supabasea ei vielä kytketä sovellukseen Vaiheessa 0, koska Supabase-projektin URL:ia tai avaimia ei ole tässä repossa.
- Kun auth toteutetaan, Next.js:n SSR-mallissa käytetään Supabasen ajantasaista cookie-pohjaista SSR-ratkaisua ja palvelinpuolen käyttäjän tarkistus tehdään ennen suojatun datan käsittelyä.
- Supabase-projekti sijoitetaan EU-alueelle.

### MVP:n rajaus
- Vaihe 0 ei toteuta kirjautumista, sivupuun CRUDia, editoria, media-arkistoa, julkaisualidomainia, AI-kutsuja tai maksuja.
- Myöhempien vaiheiden ominaisuuksia ei rakenneta etukäteen vain siksi, että arkkitehtuuri mahdollistaisi ne.

### Riippuvuudet
- Uusia riippuvuuksia lisätään vain kun ne palvelevat suoraan määriteltyä arkkitehtuuria. Versionumerot tarkistetaan ajantasaisista lähteistä ennen käyttöönottoa.
- Salaisuuksia ei versionhallita. `.env.example` sisältää vain muuttujanimet ja ohjeelliset tyhjät arvot.


## 2026-10-14 – Vaiheen 0 tarkastuskierros

- CI:n ensimmäinen esto johtui pnpm-lock.yaml-tiedoston puuttumisesta samalla kun actions/setup-node yritti alustaa pnpm-välimuistin. Välimuisti poistettiin käytöstä, kunnes lukitustiedosto on luotu ja versionhallintaan lisätty. CI asentaa riippuvuudet tällä välin ilman frozen-lockfile-tilaa; lukitustiedosto pitää lisätä heti kun asennusympäristö voi generoida ja tarkistaa sen.
- Julkisten sivujen tietokantaroolille annetaan vain julkaistussa renderöinnissä tarvittavien sarakkeiden lukuoikeus. RLS rajaa rivit, ja sarakeoikeudet estävät anonyymia roolia lukemasta luonnoskenttää pages.content tai omistajan tunnistetta.
- Profiilin haltija voi päivittää näyttönimen, avatarin ja käyttöliittymän kielen. plan-kenttä on sovelluksen hallitsema eikä sitä voi nostaa käyttäjän omalla SQL/API-pyynnöllä.
- Sivupuun tietokantatrigger tarkistaa sekä syklit että sen, että vanhempi kuuluu samaan sivustoon. Median trigger tarkistaa sivuston omistajan ja mediakansion sivustokohtaisuuden.


## 2026-10-14 – Vaihe 1: kirjautuminen

- Käytetään Supabasen SSR-pakettia @supabase/ssr 0.12.7 yhdessä @supabase/supabase-js 2.117.3:n kanssa. Versiot tarkistettiin npm:n julkaisutiedoista toteutushetkellä.
- Next.js 16:ssa käytetään proxy.ts-tiedostoa istunnon evästeiden päivitykseen, koska middleware-tiedostonimi on merkitty vanhentuneeksi.
- Suojatun dashboardin palvelinlayout tarkistaa käyttäjän Supabase Authin getUser()-kutsulla ennen sisältöön pääsyä. Proxy käsittelee istunnon päivityksen getClaims()-kutsulla.
- OAuth-callback hyväksyy vain sovelluksen sisäisiä polkuja uudelleenohjauksessa.
- Kirjautumisnäkymät voidaan buildata ilman paikallisia ympäristömuuttujia; ulkoiset kirjautumistoiminnot edellyttävät toimivaa Supabase-projektia ja sen Auth-asetuksia.


## 2026-10-14 – TypeScript- ja lint-yhteensopivuuden tarkistus

- CI todisti, että käytössä oleva typescript-eslint ei tue TypeScript 7.0.2:ta: lint pysähtyi virheeseen ennen muita tarkistuksia. TypeScript-työkalupaketin dokumentoitu tuettu alue on tällä hetkellä alle 6.1.0, joten projekti käyttää TypeScript 6.0.3:a tiukan tyypityksen säilyttäen. TypeScript 7 voidaan ottaa käyttöön vasta, kun lint- ja Next.js-työkalut tukevat sitä.


## 2026-10-14 – Vaihe 2: sivustot ja sivupuu

- Käytetään Zod 4.6.5:tä palvelinpuolen syötteiden validoimiseen ja @dnd-kit/react 0.5.0:aa nykyisen dnd-kit React -rajapinnan kautta.
- Sivuston luonti, sivupuun siirto, nimeäminen ja alipuuston kopiointi toteutetaan Postgres RPC -funktioina. Näin polkujen ja jälkeläisten päivitykset tapahtuvat yhdessä tietokantatransaktiossa eikä osittain onnistuneita polkupäivityksiä synny verkkopyyntöjen välissä.
- RPC-funktiot toimivat kutsujan oikeuksilla (SECURITY INVOKER), tarkistavat auth.uid()-omistajuuden ja ovat suoritettavissa vain authenticated-roolille. Taulujen RLS pysyy käytössä.
- Käyttäjällä voi olla enintään kolme sivustoa. Rajaa valvoo tietokantafunktio lukitsemalla käyttäjäkohtaisen advisory-lockin sivustoa luotaessa.
- Sivujen kopiointi kopioi koko alipuuston luonnoksiksi. Julkaistu sisältö ei kopioidu julkaistuksi, eikä kopio automaattisesti asetu etusivuksi.
