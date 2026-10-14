# Nettisivukone

Tekoälyavusteinen SaaS-nettisivukone pienyrityksille, yksinyrittäjille ja freelancereille.

## Kehitysvaihe

Projekti on **Vaiheessa 0 – Pohja**. Ominaisuudet rakennetaan pienissä vaiheissa ja jokainen vaihe toimitetaan omassa branchissaan ja pull requestissaan.

## Teknologia

- Next.js 16 + App Router
- React 19
- TypeScript strict
- Tailwind CSS
- shadcn/ui-tyyliset sovelluskomponentit
- Vitest
- GitHub Actions
- Supabase lisätään Vaiheessa 1

## Käynnistys

Tarvitset Node.js 24+ ja pnpm 12+.

```bash
pnpm install
pnpm dev
```

Avaa `http://localhost:3000`.

## Tarkistukset

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Kaikki neljä tarkistusta ajetaan jokaisen työvaiheen lopussa. Vaihetta ei merkitä valmiiksi ennen kuin kaikki ovat vihreitä.

## Ympäristömuuttujat

Kopioi `.env.example` nimelle `.env.local` ja täytä vain ne arvot, jotka kyseinen työvaihe tarvitsee. Älä koskaan commitoi `.env.local`-tiedostoa tai API-avaimia.

## Dokumentaatio

- `AGENTS.md` – koodaavan agentin työohje
- `docs/DECISIONS.md` – tehdyt tekniset päätökset
- `docs/DATA_MODEL.md` – suunniteltu Postgres-tietomalli
- `docs/ROADMAP.md` – vaiheistus

## Työtapa

Branchit nimetään työvaiheen mukaan. Commitit käyttävät Conventional Commits -muotoa, esimerkiksi `feat: add page tree` tai `fix: validate page path`.
