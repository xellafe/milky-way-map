# SKILL: tap-exoplanet-fetch

Scarica gli esopianeti dal **NASA Exoplanet Archive** (TAP) e produce
`exoplanets.json` con cross-match alle stelle (contratto in SPEC §5.2 / §5.3).

## Quando usarla
Milestone **M1**, parte esopianeti. Subagent `data-pipeline`.

## Query (TAP sincrono, tabella `pscomppars`)
```
https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=
 select pl_name,hostname,hd_name,hip_name,gaia_id,
        pl_orbper,pl_orbsmax,pl_rade,pl_bmasse,pl_orbeccen,pl_orbincl,
        discoverymethod,disc_year,pl_eqt,
        st_teff,st_lum,st_rad,ra,dec
 from pscomppars&format=json
```
- URL-encodare correttamente la query. Usare `pyvo` o `requests`.
- Recuperare e registrare il **DOI** della tabella in `NOTICE.md` (non inventarlo).

## Costruzione `exoplanets.json`
- Raggruppa per `hostname` → oggetto `hosts[host]` con campi stellari + array `planets`.
- Campi mancanti → `null` (es. `pl_orbincl: null` → orbita schematica 2D).

## Cross-match (SPEC §5.3) — priorità
1. ID catalogo: **Gaia → HD → HIP**.
2. Nome proprio normalizzato.
3. Coordinate (RA/Dec) entro tolleranza piccola.

Esito per host: `{ matchedIndex, matchedBy, matched }`. Se `matched=false`,
il sistema resta visitabile via ricerca per nome host ma è segnalato.
Per gli host agganciati, **setta il flag `hasExoplanets`** sulla stella corrispondente.

## Gotcha
- Il dataset è piccolo (qualche migliaio di righe): query sincrona ok, JSON statico.
- Normalizza i nomi (es. `Alpha Centauri` / `alf Cen` / `Rigil Kentaurus`) prima del match.
- Non assumere che ogni host abbia una controparte nella nuvola: molti sono lontani/deboli.

## Done
`exoplanets.json` valido + fixtures **TRAPPIST-1** (7 pianeti) e **Alpha Centauri** + test di cross-match verdi (M1 AC).
