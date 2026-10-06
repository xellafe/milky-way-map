# NOTICE — Attribuzioni e licenze dei dati

Il **codice** di Galaxy Map è rilasciato sotto licenza **MIT** (vedi `LICENSE`).
I **dati astronomici** bundlati o generati hanno licenze proprie, riportate qui.

---

## 1. HYG / AT-HYG Database

- **Autore:** astronexus (David Nash)
- **Licenza:** Creative Commons Attribution-ShareAlike 4.0 International (**CC BY-SA 4.0**)
- **Fonte:** https://www.astronexus.com/hyg — mirror su Codeberg
- **Obblighi:**
  - Attribuzione all'autore.
  - **Share-alike**: qualsiasi dataset derivato distribuito (incluso `stars.bin`
    e gli artefatti generati dalla pipeline) deve restare sotto CC BY-SA 4.0.

> Gli artefatti dati generati dalla pipeline (`data/`) sono opere derivate del
> database HYG/AT-HYG e quindi soggetti a CC BY-SA 4.0, **non** alla MIT.

## 2. NASA Exoplanet Archive

Acknowledgment standard da includere:

> This research has made use of the NASA Exoplanet Archive, which is operated by
> the California Institute of Technology, under contract with the National
> Aeronautics and Space Administration under the Exoplanet Exploration Program.

- **Tabella usata:** `pscomppars` (Planetary Systems Composite Parameters)
- **DOI:** [10.26133/NEA13](https://doi.org/10.26133/NEA13) — verificato sulla
  pagina ufficiale https://exoplanetarchive.ipac.caltech.edu/docs/doi.html
  ("Planetary Systems Composite Parameters Table") in data 2026-06-09, al
  momento del primo fetch dei dati (M1).

## 3. Dati linee costellazioni — Stellarium "modern" sky culture

- **Autori:** Stellarium's team
- **Licenza:** Creative Commons Attribution-ShareAlike 4.0 International (**CC BY-SA 4.0**)
  — dichiarata per "testo e dati" della sky culture nel relativo `description.md`.
  L'autore originale delle linee western ha inoltre concesso esplicitamente il
  riuso sotto MIT in https://github.com/Stellarium/stellarium/discussions/790.
- **Fonte (pinnata, M6 2026-06-10):** Stellarium release **v26.1**,
  `skycultures/modern/index.json`
  (https://raw.githubusercontent.com/Stellarium/stellarium/v26.1/skycultures/modern/index.json;
  sha256 in `data/raw/sources.json`).
- **Uso:** solo le definizioni delle linee (sequenze di id Hipparcos) e i nomi
  delle 88 costellazioni IAU, convertite in indici stella da
  `data-pipeline/build_constellations.py` → `data/constellations.json`.
  Le illustrazioni (Free Art License) **non** sono usate.
- **Obblighi:** attribuzione + share-alike: `constellations.json` è un derivato
  e resta sotto CC BY-SA 4.0 (come gli altri artefatti dati, vedi §1).

## 4. Musica di sottofondo

Questa sezione copre ogni file in `app/src/assets/musics/`. Ogni brano
aggiunto va elencato qui con autore e licenza.

- **File:** `app/src/assets/musics/01 - Colonna sonora di Galaxy Map.mp3` (fornito dall'utente, 2026-09-28).
- **Autore:** Federico Xella, titolare dei diritti; incluso nell'app per sua scelta.
- **Licenza:** tutti i diritti riservati all'autore. **Non** è coperto dalla
  licenza MIT del codice né dalla CC BY-SA dei dati.

## 5. Modelli massa-raggio — Zeng et al. 2019

- **Riferimento:** Li Zeng et al., "Growth model interpretation of planet size
  distribution", PNAS 116 (20), 9723–9728 (2019),
  [doi:10.1073/pnas.1812905116](https://doi.org/10.1073/pnas.1812905116).
- **Fonte:** tabelle dal sito dell'autore, https://lweb.cfa.harvard.edu/~lzeng/planetmodels.html
  (`massradiusEarthlikeRocky.txt` e `massradius_50percentH2O_300K_1mbar.txt`).
- **Licenza:** nessuna dichiarata dall'autore; punti usati con citazione.
- **Natura:** modello teorico, non dato osservativo.
- **Uso:** punti copiati in `app/src/lib/planetComposition.ts` per
  classificare i pianeti (roccioso / ricco d'acqua / gassoso).
