# Tietomalli

Tämä dokumentti kuvaa Vaiheissa 1–8 käyttöön tulevan Postgres-mallin. Vaihe 0 lisää vain dokumentaation ja migraatiopohjan; authia tai dataa ei vielä kytketä sovellukseen.

## Yleiset säännöt

- Sovelluksen omissa tauluissa: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`.
- RLS otetaan käyttöön jokaisessa taulussa ennen Data API -käyttöä.
- Päivitysaikaleima ylläpidetään yhteisellä triggerillä.
- Käyttäjäkohtainen omistajuus kulkee `owner_id`/`user_id`-kentän kautta.

## `profiles`

- `id uuid primary key references auth.users(id) on delete cascade`
- `display_name text`
- `avatar_url text`
- `plan text not null default 'free'`
- `locale text not null default 'fi-FI'`

Profiili luodaan auth-käyttäjälle triggerillä. Profiilin `id` on sama kuin Auth-käyttäjän id.

## `sites`

- `id`
- `owner_id uuid references profiles(id) on delete cascade`
- `name text`
- `slug text`
- `theme jsonb not null default '{}'`
- `settings jsonb not null default '{}'`
- `status text check (status in ('draft','published'))`
- `published_at timestamptz`
- `custom_domain text` (myöhempi vaihe)

`slug` on uniikki vähintään sivuston omistajan näkökulmasta; MVP:n julkaisumallissa globaalisti uniikki slug yksinkertaistaa host-routingia.

## `pages`

- `id`
- `site_id uuid references sites(id) on delete cascade`
- `parent_id uuid references pages(id) on delete cascade`
- `title text`
- `slug text`
- `position int`
- `path text`
- `show_in_nav boolean not null default true`
- `is_home boolean not null default false`
- `status text check (status in ('draft','published'))`
- `seo jsonb not null default '{}'`
- `content jsonb not null default '[]'`
- `published_content jsonb not null default '[]'`

### Polut ja järjestys

`path` on materialisoitu polku, esimerkiksi `palvelut/korjaus/renkaat`. Se päivitetään sovelluslogiikassa transaktion sisällä aina, kun sivun slug tai parent muuttuu. Kaikki jälkeläiset päivitetään samalla kertaa.

Sisarusten slug on uniikki: `(site_id, parent_id, slug)`. PostgreSQL:n NULL-käyttäytymisen vuoksi juurisivujen uniikkius toteutetaan indeksillä, joka käyttää normalisoitua parent-avainta.

Sivua ei saa siirtää oman jälkeläisensä alle. Tarkistus tehdään sovelluksessa ja puolustava tietokantatrigger lisätään ennen Vaihetta 2.

Sivun poistaminen poistaa sen jälkeläiset (`on delete cascade`). UI:n pitää ennen poistoa näyttää selkeä varoitus ja sivuston omistajan on vahvistettava poistaminen.

## `media`

- `id`
- `site_id uuid references sites(id) on delete cascade`
- `owner_id uuid references profiles(id) on delete cascade`
- `storage_path text`
- `filename text`
- `mime text`
- `size_bytes bigint`
- `width int`
- `height int`
- `alt_text text`
- `folder_id uuid references media_folders(id) on delete set null`
- `tags text[] not null default '{}'`

Media tallennetaan Supabase Storageen, mutta sovelluksen sisällössä säilytetään `media_id`, ei pysyvää URL:ia.

## `media_folders`

- `id`
- `site_id uuid references sites(id) on delete cascade`
- `parent_id uuid references media_folders(id) on delete cascade`
- `name text`

Kansioiden syvyydelle ei aseteta tietokantarajoitetta, mutta käyttöliittymässä vältetään tarpeettoman syvää rakennetta.

## `forms_submissions`

- `id`
- `site_id uuid references sites(id) on delete cascade`
- `page_id uuid references pages(id) on delete set null`
- `data jsonb not null`
- `created_at`

Lomakevastaukset ovat henkilötietoja sisältävää dataa, joten käyttöoikeudet, säilytys ja poisto suunnitellaan ennen lomakelohkon käyttöönottoa.

## `ai_usage`

- `id`
- `user_id uuid references profiles(id) on delete cascade`
- `site_id uuid references sites(id) on delete cascade`
- `kind text`
- `tokens_in integer not null default 0`
- `tokens_out integer not null default 0`
- `credits numeric not null default 0`
- `created_at`

Tätä taulua käytetään AI-käytön seurantaan ja myöhempään käyttörajoitukseen.

## `redirects`

Lisätään julkaisu-/linkkivaiheessa:
- `id`
- `site_id`
- `from_path`
- `to_page_id`
- `created_at`

Tavoite on säilyttää vanha URL toimivana slug-muutoksen jälkeen. Redirectien tulee olla sivustokohtaisia ja RLS-suojattuja.

## `subscriptions`

Ei toteuteta MVP:ssä. Malli lisätään vasta maksuvaiheessa, jolloin Stripe/Paytrail, ALV ja laskutus päätetään erikseen.

## Lohkon sisältö

Sivun `content` ja `published_content` ovat versionoituja JSON-listoja. Jokaisella lohkolla on `id`, `type`, `version`, `props` ja tarvittaessa `children`. Lohkojen props validoidaan Zodilla ennen tallennusta ja julkaisua.

Rich text tallennetaan Tiptapin JSON-muodossa. Käyttäjän sisältöä ei oleteta luotettavaksi.


## Vaiheen 2 toteutussäännöt

- Sites- ja pages-muokkausoikeudet myönnetään authenticated-roolille, mutta jokainen operaatio rajautuu omistajan RLS-politiikoilla.
- Anonyymille roolille ei myönnetä sivujen luonnoskentän `content` lukuoikeutta; julkinen lukeminen käyttää myöhemmin erikseen julkaistavaa sisältöä.
- Sivun luonti, nimeäminen, siirto, alipuuston kopiointi ja sivuston luonti tapahtuvat RPC-funktioissa tietokantatransaktiossa.
- Polku muodostetaan sivun slugista ja vanhemman täydestä polusta. Slug-/vanhempimuutokset päivittävät jokaisen jälkeläisen polun samassa transaktiossa.
- Sivun kopiointi kopioi rekursiivisen alipuuston luonnokseksi: jokaiselle kopioidulle sivulle syntyy uusi UUID, sisäiset parent_id-viitteet mapataan uusiin tunnisteisiin ja published_content asetetaan tyhjäksi.
- Enimmäismäärä on kolme sivustoa käyttäjää kohti. Sivuraja tarkistetaan tietokannassa rinnakkaisten pyyntöjen estämiseksi.
