# Understanding The Magnitude Of WWII

This project has the purpose of
narrating the events and evolution of the Second World War through
information visualization and interaction. This work was developed for the subject of Computational Design Laboratory of the Master of Design and Multimedia at the Faculty of Sciences and Technology of the University of Coimbra ([FCTUC]([#understanding-the-magnitude-of-wwii](https://www.uc.pt/fctuc/))).

## Getting Started
### Prerequisites

To run this project on your computer install Node.js 22.12 or newer.

- [Node.js](https://nodejs.org/en/download/)

### Installation
You can use the following command in the terminal to install all the depencencies for this project

```
npm ci
```

## Usage

After all the depencencies are installed, start the project by using the command:

```
npm run dev
```

This will start the project in a localhost, normaly it runs on the port 5173

### Contributors

- [José Antunes](https://github.com/ze-antunes) - design and development
- [Tiago Martins](https://github.com/tiagofmartins) - supervision
- [João M. Cunha](https://github.com) - supervision
- [Pedro Silva](https://github.com) - supervision
- [Penousal Machado](https://github.com) - supervision
- [Sérgio M. Rebelo](https://github.com/sergiomrebelo) - supervision

## Validation and publishing

```sh
npm run build
npm run preview
npm audit
```

The build is written to `dist/`. `npm run deploy` publishes that folder to GitHub Pages.

## Flight and reactive exploration

The experience starts behind the aircraft. The camera follows its heading, while events react to its position instead of teleporting the aircraft whenever a selection changes.

- A/D or left/right arrows: bank and coordinated turn. Q/E: rudder. W/up lowers the nose; S/down raises it. Shift/Ctrl increase/decrease throttle. Forward motion follows the aircraft's local nose direction.
- Space pauses the exploration; R explicitly resets to the selected event. M or a click on the minimap toggles the camera view. The on-screen arrow controls have been removed.
- The map retains the original grey country meshes and relief, black background, red four-band explosion shader and original `trees.glb` geometry. No grid is rendered.
- The original map is approximately twelve times wider than the earlier scene. A Natural Earth projection, calibrated against the original GLBs, aligns event coordinates with those shapes.
- Nearby records are grouped into deterministic spatial clusters. All 178 records are preserved exactly once; with all filters active there are 31 clusters. Uniform XYZ scale follows the cube root of record count, preserving the original proportions and relative volumes. It does not encode casualties or nuclear weapons.
- Entering a cluster's range reveals its events; leaving the range hides the card. Separate entry/exit distances prevent flickering. Within a cluster, the nearby event responds to aircraft position. Cycling records manually pauses exploration to allow reading.
- The header collects project information, nearby-event context, controls and shortcuts. Optional drawers contain aircraft choices, archive filters, expanded clusters and country summaries. Event information has a dedicated reading drawer. The aircraft remains the default means of navigation; the overview is optional.
- Outside a drawer, selecting a monthly timeline bar or archive entry plots an autopilot route. Within the reading drawer, the timeline changes the record without flying. It turns and flies there, then pauses on arrival. Manual steering cancels the route. The chronological tour flies between records and dwells for 18 seconds by default (30/45 seconds are selectable) at each arrival, stopping at the end.

The experience starts paused at speed 4.0 (abstract scene units); throttle ranges from 1 to 8. Event selection holds for at least six seconds before proximity can change it again. Explosion rotation, proximity pulse and camera transitions are slower. The monthly timeline histogram describes sample coverage, with an approximate selected date, previous/next navigation and a slow guided visit.

There is no attraction towards clusters. **Voo livre** keeps heading under manual control. **Seguir eventos** starts at the earliest filtered record and visits records chronologically, with reading stops and a red duration bar along the bottom of the header. Proximity cannot replace the selected record during a route. Manual steering cancels a route and returns to free flight. The current event year is displayed in bold above the minimap, at a compact size within its width.

Every filtered CSV record also has a red point at its projected geographic coordinate. Opening a cluster spreads selectable points and draws stems back to the real anchors; it does not change the saved coordinates. Clicking a point opens its event details. Countries have visible outlines and interactive hover/click areas, retaining the original GLB terrain. Country summaries count records contained by the current simplified reference polygons; 32 records are unassigned rather than guessed from the nearest country. These modern boundaries are not wartime boundaries.

See [data interpretation and proposed narratives](docs/LEITURAS_DOS_DADOS.md) for an audit of the report/CSV and suggested next steps.

The CSV is a partial archive, not a complete account of WWII. Decimal years are approximate, missing values stay missing, and potentially overlapping records are not summed into a war-wide casualty total. Aircraft selection is visual: the CSV does not associate an aircraft with each battle. The P-100 is presented as an extra, not a historically verified aircraft for these events.

## Reading drawer

Open **Ler evento** or **Leituras** from the header. Four tabs implement the safe priorities in the interpretation plan:

- **Confronto:** opposing forces, absolute strengths/casualties and within-record casualty/strength percentages.
- **Campanha:** chronological records grouped by campaign designation and year, so reused names remain distinguishable.
- **Comparar:** two records on common per-metric scales, with a default same-group scope and explicit opt-in for all records. A known-data pair can be suggested when the initial group is too small.
- **Amostra:** year distribution and completeness of the fields used, with sample limits explained.

Reading pauses the aircraft and pins the selected record. It does not infer a winner or sum potentially overlapping casualties. Missing values remain missing. Equipment and terrain interpretations still require documentation; see the implementation status in the [plan](docs/LEITURAS_DOS_DADOS.md).

The minimap and timeline share one aligned dock. Clicking the minimap replaces the former camera-toggle button. The map scale is now 1800, 50% larger than the preceding 1200; the original country shapes, borders, event projections and flight bounds grow together.

## Full-height drawer and continuous local rendering

Drawers cover the full page height and sit above both the header and timeline. A dimmed backdrop preserves the 3D scene underneath; clicking it or pressing Escape closes the drawer. Keyboard focus stays inside the active drawer. Light and dark drawer themes are available; the main map keeps its original grey/red identity.

In aircraft view, the original country geometry is drawn as nearby 36-unit sectors instead of the full merged map. `public/world/manifest.json` indexes 201 land chunks generated by `scripts/build-world-chunks.mjs`. Clipping preserves each source triangle inside its sector. Nearby assets are rendered and surrounding assets are prefetched; draw distance is selectable (48/84/120 scene units). The ground follows the aircraft and fog hides the outer draw limit. Overview still uses the original complete map.

Crossing a map boundary wraps the canonical coordinates while rebasing the camera. Adjacent geographic sectors, country outlines, points and clusters use the nearest periodic image. This reuses the existing geography; it does not invent terrain or duplicate CSV records. The continuity is a visual technique for this projected atlas, not a geodesic globe simulation.

## Assets and performance

`public/map-original.glb` merges the original country GLBs without changing their geometry. The originals remain in `public/Maps`. It avoids hundreds of network requests and fixed physics colliders.

The original explosion has 168,000 triangles. The active nearby cluster uses that exact geometry. Other clusters share instanced levels of detail derived from it: 41,338 triangles at medium distance, 1,115 at long distance. Instance counts are compacted each frame, so inactive detail levels do not submit hidden copies of every cluster. The original shader supports both regular and instanced meshes. Draco decoder assets are local.

To regenerate these derived assets after editing original models:

```sh
npm run build:assets
```

`npm test` validates CSV integrity, missing values, projection, deterministic clustering, proximity hysteresis, country containment and unassigned records, free heading without attraction, periodic seam wrapping, camera rebasing, chunk bounds and terrain clipping, nose-aligned motion, bank/pitch/throttle, pause and autopilot arrival. Browser checks cover all six aircraft, manual controls, filters, context details and mobile layout.

## Sources and model credits

- Event data: `src/WW2_LocationData_Clean - GeoBattleData_YZ.csv`, supplied with the original project. Column units and casualty composition should be checked against the original data dictionary before further statistical analysis.
- Locator minimap: [world-atlas 2.0.2](https://github.com/topojson/world-atlas), countries at 1:110m, derived from Natural Earth. The local file is `public/data/countries-110m.json`.
- Aircraft: original Sketchfab attribution and licence files are preserved in each `public/Airplanes/*/license.txt`; the active model's source, author and licence appear in the interface. Most are CC BY 4.0; the P-100 Avenger is CC BY-NC 4.0.
- Spitfire is approximately 35 MB; it only downloads when selected. The initial model is approximately 1 MB.

The altitude ceiling is 15.0. Reaching it triggers a 4.5-second half backward loop and half roll that reverse the heading by 180° below the ceiling, followed by a four-second descent that levels out at 13.0. Manual controls resume after recovery; pausing freezes the maneuver.

A heading tape below the header shows the aircraft heading (north at 000°, east at 090°). A red diamond points towards the active destination, including the shortest direction across map seams.

Aircraft effects: each model uses its original propeller geometry, extracted into local pivots without changing the source assets. The Henschel has two animated propellers and the low-poly bomber has four. A bounded 128-particle smoke trail fades over 3.2 seconds, follows maneuvers and wraps with the aircraft at world seams. Both effects freeze when the flight is paused.


## Responsive exploration

- Phones use a compact exploration menu and a collapsible timeline. The minimap stays on the left; a native event selector offers precise timeline selection by touch.
- Touch devices provide a proportional thumbstick (left/right turn, up climb, down descend) and hold-to-change throttle buttons. Two simultaneous touches work independently. Releasing, cancelling, changing orientation, opening a drawer or leaving the page clears held inputs. Touch controls can be hidden and appear only in free flight.
- Drawers keep their title, close action and reading footer reachable while the content scrolls independently. Phone drawers use the full width; landscape and tablet layouts preserve a portion of the 3D background. Focus stays within an open drawer and returns to a visible control after closing.
- Header and dock offsets are measured rather than inferred from fixed heights. Dynamic viewport height, safe-area insets and 16px touch inputs accommodate browser chrome, screen rotation and the on-screen keyboard.
- Keyboard flight shortcuts continue to work. The circular control is shown only on devices reporting touch input; it does not replace the desktop interface.


## Adjustable world and aircraft sound

The aircraft drawer includes independent map scale (100–400%) and cloud size controls. The suggested map is twice the previous horizontal dimensions (effective scale 3600). Original land chunks and geographic coordinates stay canonical; the world is rendered at the chosen scale, while aircraft movement is converted so actual flight speed and model size remain unchanged. Preferences are stored locally and can be reset.

Cloud detail follows projected screen coverage, with at most twelve medium-detail clouds plus the original nearby model. Clouds share a low base at 5.5 and scale uniformly in all three axes. Their tops vary naturally with cluster size; no vertical cap flattens the original geometry. Old saved height settings are ignored and height is no longer a user control. Cruise starts at 3.5 for underflights; the ceiling stays 15 and recovery at 13 permits overflight of smaller clouds; larger clusters may extend above the flight ceiling. The camera smoothly changes from a low following angle to a higher view above the layer.

A continuous camera-to-aircraft viewing pyramid uses the actual aircraft bounds, including wing tips, and transformed cloud bounds. Prediction is limited to 0.1 seconds and camera clearance to 0.15 units, so dissolution triggers closer to genuine obstruction. Any cloud obstructing that volume temporarily dissolves as a whole, anticipates motion, and restores when clear. Screen-door transparency preserves opaque depth without slicing cloud geometry or drawing the aircraft over opaque clouds. Invisible clouds do not intercept country/event selection. Map scale and geographic alignment remain unchanged.

“Ativar som” is an explicit user gesture that unlocks Web Audio. Each of the six aircraft has its own synthesized harmonic waveform, pitch range, filtering and airflow balance. Engine load reacts to bank, turn rate, pitch and climb rate; dives add wind, and stereo balance follows turns. One, two or four engine voices follow the selected model. Volume is adjustable. Pausing, opening a reading drawer, switching to overview or hiding the page fades the sound to silence; audio nodes are disposed when the experience unmounts. No external sound files are fetched.
