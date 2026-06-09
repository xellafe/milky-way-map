# SKILL: athyg-etl

Trasforma i cataloghi **HYG / AT-HYG** in `stars.bin` + `stars.manifest.json` +
`names.index.json` (contratto in SPEC §5.1).

## Quando usarla
Milestone **M1**, parte stelle. Subagent `data-pipeline`.

## Passi
1. **Download** AT-HYG (+ HYG per i nomi propri/ID mancanti) dalla fonte pinnata (Codeberg). Versiona l'URL e la data di download.
2. **Carica** con pandas; non assumere la presenza di tutte le colonne — gestisci gli assenti.
3. **Pulizia / filtri** (SPEC §1, §5.1):
   - escludi distanza sentinella HYG (`100000` pc) e valori non finiti/≤0;
   - converti **pc → ly** (`× 3.2616`).
4. **Colore** (SPEC §6.1): mappa classe spettrale/B–V → RGB-ancora → boost saturazione HSL `1.35` (clamp) + floor di luminosità. Stella senza spettro → `spectralClass=7`, bianco neutro.
5. **Dimensione**: derivata da magnitudine **assoluta** (clamp min/max).
6. **Flags** bitmask: variabile, multipla, hasExoplanets (quest'ultimo settato dopo il cross-match esopianeti).
7. **Pack SoA** little-endian secondo il manifest; scrivi `names.index.json` (proper, hd, hip, gaia, gl, tyc, constellation).
8. **Validazione**: `count` coerente; nessun NaN nelle posizioni; range plausibili. Logga il numero di voci escluse e perché.

## Gotcha
- Non confondere magnitudine apparente e assoluta (la dimensione usa l'**assoluta**).
- Mantieni l'ordine degli indici stabile: `names.index.json` e `stars.bin` sono allineati per indice.
- Output grandi → `data/` (gitignore/LFS). Le **fixtures** (~1000 stelle) vanno committate.

## Done
Artefatti generati + schema validato + unit test su conversioni e mappa colore verdi (M1 AC).
