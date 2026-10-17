# Space Comm Virtual Lab — PH035IU

Interactive simulations for **Introduction to Space Communication**, International University.
Six modules cover all thirteen lectures; each module bundles two or three lectures into one live model.

| Module | Lectures | Simulations |
|---|---|---|
| 1 — Orbits, Coverage and Look Angles | 1, 2, 3 | Orbit explorer (Kepler's third law, coverage, pass length); GEO look angles with the full sky arc |
| 2 — Propagation, Rain Fade and Polarization | 4, 9 | ITU-R P.618 rain procedure step by step; polarization mismatch, XPD and Faraday rotation |
| 3 — Antennas, Beams and Free-Space Loss | 5, 10 | Parabolic reflector pattern with mispointing; phased-array beam steering and grating lobes |
| 4 — The Space Link Budget | 6, 10 | Uplink/downlink/combined budget, waterfall, noise-temperature cascade, rain double penalty |
| 5 — Digital Signals, Modulation and Coding | 7, 8 | Live constellation under AWGN; BER curves and coding gain; eye diagram; Hamming (7,4) |
| 6 — Multiple Access, Networks and Services | 11, 12, 13 | FDMA/TDMA/CDMA; TCP over a long hop; GNSS geometry and DOP; digital-TV bit rates |

## Running it

Open `index.html` in any modern browser. No build step, no server, no network required after the
fonts have loaded once. Each module is deep-linkable: `index.html#m4` opens the link budget directly.

Keyboard-free, projector-friendly. A **Light** / **Dark** button sits in the top bar — dark is the
default for a darkened lecture hall, light reads better on a bright projector.

## Live site

**https://nntminh1983.github.io/spacecomm-virtual-lab/**

Served from branch `main`, folder `/ (root)`. The `.nojekyll` file at the root stops GitHub
from running Jekyll over `assets/`.

Deep links work for every module, so a lecture can jump straight in:

| Module | Link |
|---|---|
| 1 Orbits and look angles | `…/spacecomm-virtual-lab/#m1` |
| 2 Rain fade and polarization | `…/#m2` |
| 3 Antennas and beams | `…/#m3` |
| 4 Link budget | `…/#m4` |
| 5 Modulation and coding | `…/#m5` |
| 6 Access and networks | `…/#m6` |

### Updating it

Edit the files, then:

```bash
git add -A && git commit -m "describe the change" && git push
```

Pages rebuilds in under a minute. Hard-refresh (Ctrl-F5) to bypass the browser cache.

## Presets built in

The default state of each module is a case already used in the lectures, so the readout matches
the slide before anything is touched:

- **Ho Chi Minh City → VINASAT-1 at 132° E** — Example 3.4. Reads Az 111.6°, El 58.0°, range 36 622 km.
- **Ka-band rain in Ho Chi Minh City** — the in-class case from Lecture 4. About 35 dB at 0.01 % of the year.
- **C-band GEO trunk** — a Roddy-style downlink budget closing with roughly 6 dB of margin at 36 Mbit/s.
- **550 km LEO** — about a 96-minute period and an eight-minute usable pass above a 10° mask.

## Sources for the numbers

- Kepler and look angles: Roddy, *Satellite Communications*, chapters 2–3. μ = 398 600 km³/s², Rᴇ = 6378.14 km, a_GSO = 42 164 km.
- Rain: ITU-R P.838-3 for k and α (log-log interpolated), ITU-R P.618 for the horizontal reduction
  factor, vertical adjustment and the time-percentage scaling. The scaling exponent β uses
  |φ| = 10.82° (Ho Chi Minh City).
- Antennas: uniformly illuminated circular aperture, |2J₁(u)/u|²; θ₃dB ≈ 70λ/D as in Roddy.
- Link budget: Roddy chapter 12. Boltzmann −228.6 dBW/K/Hz, rain medium temperature 275 K.
  Sky noise uses a simple zenith-opacity model, not a full ITU-R P.676 line-by-line calculation.
- Modulation and coding: Gray-mapped constellations with theoretical BER from the Q-function;
  coding gains at BER 10⁻⁵ as quoted in Lecture 8.
- Networks: Mathis throughput bound; GDOP from the geometry matrix; studio rates per ITU-R BT.601/BT.709.

## Known simplifications

These are deliberate, so they can be stated in class rather than discovered by a student:

- Orbits are circular and the Earth is spherical. No J2, no drag, no Earth rotation in the pass-length figure.
- The MEO and GEO "usable pass" figures ignore Earth rotation; for GEO the lab reports *continuous* instead.
- Above about 65° elevation the ITU rain model predicts a slight *increase* in fade, because a short
  near-zenith path lies entirely inside the intense core of the rain cell. This is the published
  model's behaviour, not a coding error, and is worth discussing.
- Uplink rain is held at zero; the rain slider acts on the downlink only.
- The CDMA panel shows interference-limited capacity with a fixed processing gain of 31.

## Files

```
index.html          all six modules, markup and copy
assets/style.css    design tokens, layout, light and dark palettes
assets/app.js       physics, numerics and every canvas drawing
```
