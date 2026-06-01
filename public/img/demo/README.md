# Landing reel demo photos

Drop activity photos here to fill the cards shown in the **02 / Review** demo reel
(and the Arrange/Finalize calendar). Each file is matched to an activity by name.

- Filename = the activity's id **without the `demo-` prefix**, `.jpg`.
- A missing file is harmless — the card falls back to the mountains placeholder
  (`activityImgHtml` has an `onerror` handler).
- Recommended: landscape, ~800×500+, optimized JPG (cards crop to a wide strip).
- `.jpg` is what the code points at. If you only have `.png`/`.webp`, either convert,
  or pass an explicit `imageUrl` on that activity in `landing-reel.js`.

## Filenames to add

| File | Activity |
|------|----------|
| `mezquita.jpg` | Mezquita-Catedral de Córdoba |
| `bodegas.jpg` | Lunch at Bodegas Mezquita |
| `alcazar-cor.jpg` | Alcázar de los Reyes Cristianos (Córdoba) |
| `juderia.jpg` | Judería Old-Town Wander |
| `patios.jpg` | Patios de San Basilio |
| `puente.jpg` | Puente Romano & Calahorra Tower |
| `realalcazar.jpg` | Real Alcázar de Sevilla |
| `flamenco.jpg` | Flamenco at La Carbonería |
| `plaza-espana.jpg` | Plaza de España |
| `patios-replacement.jpg` | Hammam Al Ándalus (the Replace swap result) |

The first six are the cards seen during the Review demo; the rest appear in the
Arrange/Finalize calendar and the faked Replace.
