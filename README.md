# Nettisivukone

Tekoälyavusteinen SaaS-nettisivukone pienyrityksille, yksinyrittäjille ja freelancereille.

## Kehitystila

- Vaihe 0: tekninen pohja ja CI:n korjauskierros ovat PR:ssä #1.
- Vaihe 1: kirjautumisen toteutus on PR:ssä #2. Älä merkitse kirjautumista tuotantovalmiiksi ennen kuin Supabase-projekti ja Google OAuth on määritetty ja rekisteröityminen, vahvistus, kirjautuminen sekä palautus testattu.

## Teknologia

- Next.js 16 App Router + TypeScript strict
- React 19 + Tailwind CSS 4
- Supabase Auth + PostgreSQL + RLS
- Supabase SSR -asiakkaat evästepohjaiselle palvelinistunnolle
- Vitest + GitHub Actions

## Käynnistys

Tarvitset Node.js 24+ ja pnpm 12+.

Asenna riippuvuudet ja käynnistä kehityspalvelin:

    pnpm install
    pnpm dev

Avaa http://localhost:3000.

## Ympäristömuuttujat

Kopioi .env.example-tiedosto nimelle .env.local. Lisää Supabasen projektin URL ja publishable key Supabasen Connect-näkymästä:

    NEXT_PUBLIC_SUPABASE_URL=
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

Älä lisää service role -avainta selaimeen tai GitHubiin. Sitä ei tarvita kirjautumisen MVP-toteutuksessa.

## Supabasen käyttöönotto (Vaihe 1)

1. Luo Supabase-projekti EU-alueelle.
2. Aseta projektin URL ja publishable key paikalliseen .env.local-tiedostoon.
3. Tarkasta ja aja repossa oleva migraatio Supabase CLI:llä vasta oikeaan projektiin linkityksen jälkeen.
4. Supabase Auth -asetuksissa salli sähköpostivahvistus.
5. Lisää paikallinen osoite sekä tuotantoympäristön callback-osoite Authin URL Configuration -sallittuihin osoitteisiin. Callback-reitti on /auth/callback.
6. Ota Google OAuth käyttöön Supabase Dashboardissa ja Google Cloud Consolessa. Google Client ID:tä tai Client Secret -avainta ei saa lisätä lähdekoodiin.

Google OAuth ja sähköpostin vahvistus eivät ole toiminnallisesti varmennettuja ennen kuin oikea Supabase-projekti on määritetty ja polut testattu.

## Laatutarkistukset

Aja jokaisen vaiheen jälkeen:

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build

GitHub Actions ajaa samat komennot PR:n tarkastuksessa. Vaihetta ei merkitä valmiiksi ennen kuin tarkistukset ovat onnistuneet. Lukitustiedosto lisätään versionhallintaan, kun pnpm-asennusympäristö voi generoida ja tarkistaa sen.

## Dokumentaatio

- AGENTS.md — koodausagentin työohje ja vaiheistus
- docs/DECISIONS.md — tekniset päätökset
- docs/DATA_MODEL.md — Postgres-tietomalli ja käyttöoikeudet
- docs/ROADMAP.md — toteutuksen eteneminen
