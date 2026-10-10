// Future missions (#44): confirmed, planned and proposed, plus the ones in flight to their targets
// and the cancelled or paused ones (said so). Curated from agency pages and reputable reporting;
// every entry carries its sources, and the whole list was last checked on 2026-10-10. Statuses
// change: re-check before relying on a date. `horizons` is the JPL Horizons id where a reference
// (often pre-launch planning) trajectory is published; `target` the app's body id; `ll2` a pattern
// that matches the mission in the Launch Library 2 events feed (#32) for live launch dates.
//
// Tiers: in-flight · confirmed (funded, scheduled) · planned (programme with dates, not fully
// committed) · proposed (concept / decadal recommendation / proposal; `notSelected` when a
// proposal lost its competition) · ended (cancelled, paused, failed or on hold).

export const CHECKED = '2026-10-10';

export const MISSION_TIERS = {
  'in-flight': { label: 'IN FLIGHT', hint: 'Launched; real positions come from JPL Horizons where published.' },
  confirmed: { label: 'CONFIRMED', hint: 'Funded and in build or scheduled, with a launch date.' },
  planned: { label: 'PLANNED', hint: 'An agency programme with dates, not yet fully committed.' },
  proposed: { label: 'PROPOSED', hint: 'A concept study, decadal-survey recommendation or proposal; not a mission yet.' },
  ended: { label: 'CANCELLED / PAUSED', hint: 'Cancelled, paused, on hold or failed.' },
};

/**
 * Provenance tier for a mission's path. Horizons tracks of craft in flight are COMPUTED (orbit
 * determination from tracking, predicted ahead); pre-launch reference trajectories and our own
 * window transfers are MODELLED. Nothing about a mission that has not flown is ever MEASURED.
 */
export const pathTier = (m, source) => (m.tier === 'in-flight' && source === 'horizons' ? 'computed' : 'modelled');
/** Tier of the mission card's facts: what an agency has announced is REPORTED; a proposal is MODELLED (a concept). */
export const factTier = (m) => (m.tier === 'proposed' ? 'modelled' : 'reported');

const jdOf = (s) => Date.parse(s) / 86400000 + 2440587.5;
/** First date a loose "2028-07", "2031", "2028/2029", "2026-11/2026-12 (…)" can mean, as JD; null if none. */
export function looseJd(s) {
  const m = /(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(s ?? '');
  return m ? jdOf(`${m[1]}-${m[2] ?? '01'}-${m[3] ?? '01'}T00:00:00Z`) : null;
}
export const FUTURE_MISSIONS = [
 {
  "id": "dragonfly",
  "name": "Dragonfly",
  "agency": "NASA",
  "partners": "Johns Hopkins APL (lead)",
  "tier": "confirmed",
  "target": "titan",
  "targetName": "Titan",
  "launch": "2028-07",
  "arrival": "2034-12",
  "goal": "Rotorcraft lander that flies between sites on Titan to study prebiotic chemistry and habitability.",
  "status": "In integration and test (I&T began Jan 2026); NASA lists launch NET July 2028 on Falcon Heavy, arrival late 2034, ~3.3-year surface mission.",
  "sources": [
   "https://science.nasa.gov/mission/dragonfly/",
   "https://www.jhuapl.edu/news/news-releases/240417-nasa-confirms-apl-led-dragonfly-mission-to-saturn-moon-titan",
   "https://www.nasa.gov/podcasts/small-steps-giant-leaps/episode-168-dragonfly-mission-to-titan/"
  ],
  "unverified": [
   "Specific window 2028-07-05..2028-07-25 is from a secondary outlet (glitchwire.com), not NASA.",
   "Arrival month 'December 2034' is from a NASA podcast transcript; mission page says 'late 2034'."
  ],
  "ll2": "Dragonfly"
 },
 {
  "id": "nancy-grace-roman",
  "name": "Nancy Grace Roman Space Telescope",
  "agency": "NASA",
  "partners": "GSFC (lead), JPL",
  "tier": "in-flight",
  "target": "se-l2",
  "targetName": "Sun-Earth L2",
  "launch": "2026-08-30",
  "goal": "2.4 m wide-field near-infrared survey telescope for dark energy, microlensing exoplanet census and galaxy surveys.",
  "status": "Launched 2026-08-30 11:26 UTC on Falcon Heavy from KSC LC-39A; in transfer/commissioning toward Sun-Earth L2; first images expected early 2027.",
  "sources": [
   "https://science.nasa.gov/mission/roman-space-telescope/",
   "https://space.com/space-exploration/launches-spacecraft/nasas-roman-space-telescope-is-ready-for-launch-aboard-spacex-falcon-heavy-rocket"
  ],
  "horizons": -211,
  "horizonsNote": "Horizons record revised 2026-10-07; post-launch GSFC FDF trajectory plus long-term prediction to 2028-10-04.",
  "unverified": [
   "Exact L2 orbit-insertion date not verified."
  ]
 },
 {
  "id": "neo-surveyor",
  "name": "NEO Surveyor",
  "agency": "NASA",
  "partners": "JPL (management), Univ. of Arizona (PI Amy Mainzer), BAE Systems/Ball",
  "tier": "confirmed",
  "target": "se-l1",
  "targetName": "Sun-Earth L1",
  "launch": "2027-09",
  "arrival": "2027-12",
  "goal": "50 cm thermal-infrared survey telescope to find at least two-thirds of near-Earth objects larger than 140 m.",
  "status": "In development; working toward a September 2027 Falcon 9 launch (formal commitment no later than June 2028, $1.2B); halo orbit insertion planned 2027-12-27.",
  "sources": [
   "https://en.wikipedia.org/wiki/NEO_Surveyor",
   "https://neos.arizona.edu/"
  ],
  "horizons": -33,
  "horizonsNote": "Pre-launch planning trajectory (JPL nav, generated 2026-06-23): launch 2027-09-13, HOI 2027-12-27. Will change at launch.",
  "unverified": [
   "Launch month taken from Horizons planning trajectory and Wikipedia; no 2026 NASA press release found confirming it."
  ],
  "ll2": "NEO Surveyor"
 },
 {
  "id": "veritas",
  "name": "VERITAS",
  "agency": "NASA",
  "partners": "JPL (lead); DLR, ASI, CNES contributions",
  "tier": "planned",
  "target": "venus",
  "targetName": "Venus",
  "launch": "2031-06",
  "goal": "Venus orbiter mapping surface topography and composition with radar and infrared emissivity to understand its geologic history.",
  "status": "Delayed in 2022 from 2027 to NET 2031 (June 2031 targeted, Nov 2032 fallback); FY2026 budget request proposed cancellation; Congress kept planetary funding but VERITAS is described as 'ramping up slowly' with minimal funding.",
  "sources": [
   "https://en.wikipedia.org/wiki/VERITAS_(spacecraft)",
   "https://space.com/space-exploration/missions/nasas-ambitious-decade-of-venus-exploration-may-bank-on-1-probe-not-everything-can-move-forward"
  ],
  "unverified": [
   "Current (Oct 2026) launch date unverified; no post-March-2026 source found."
  ]
 },
 {
  "id": "davinci",
  "name": "DAVINCI",
  "agency": "NASA",
  "partners": "GSFC (lead)",
  "tier": "planned",
  "target": "venus",
  "targetName": "Venus",
  "launch": "2030",
  "goal": "Venus flyby/orbiter plus descent probe measuring atmospheric chemistry and imaging Alpha Regio tesserae during descent.",
  "status": "Continuing in development: FY2026 appropriations provide $99M; NASA launch-schedule page lists 2030 (earlier plans: June 2029 launch, June 2031 probe descent).",
  "sources": [
   "https://www.nasa.gov/event/davinci",
   "https://space.com/space-exploration/missions/nasas-ambitious-decade-of-venus-exploration-may-bank-on-1-probe-not-everything-can-move-forward"
  ],
  "unverified": [
   "Launch year/arrival not firmly verified; tier set to 'planned' because of FY2026/FY2027 budget-request cancellation proposals."
  ]
 },
 {
  "id": "envision",
  "name": "EnVision",
  "agency": "ESA",
  "partners": "NASA (VenSAR radar, JPL), Thales Alenia Space (prime), OHB Space UK",
  "tier": "confirmed",
  "target": "venus",
  "targetName": "Venus",
  "launch": "2031",
  "arrival": "2034",
  "goal": "Venus orbiter to study the planet from inner core to upper atmosphere, with radar, spectrometers and subsurface sounder.",
  "status": "Adopted by ESA (Jan 2024); instruments passed PDRs; NASA's VenSAR funding uncertain and ESA studying European fallback; launch 2031 per ESA team (latest acceptable 2033 per ESA).",
  "sources": [
   "https://meetingorganizer.copernicus.org/EGU26/EGU26-4511.html",
   "https://space.com/astronomy/venus/will-budget-cuts-force-nasa-to-withdraw-from-europes-next-venus-mission",
   "https://sci.esa.int/web/cosmic-vision/-/esa-selects-revolutionary-venus-mission-envision"
  ],
  "unverified": [
   "Sources disagree on launch (2031 vs 2032/2033)."
  ]
 },
 {
  "id": "ariel",
  "name": "Ariel",
  "agency": "ESA",
  "partners": "UK Space Agency/UCL (consortium lead), NASA CASE contribution",
  "tier": "confirmed",
  "target": "se-l2",
  "targetName": "Sun-Earth L2",
  "launch": "2031",
  "goal": "Transit spectroscopy survey of the atmospheres of ~1000 exoplanets.",
  "status": "In development; a schedule review (reported Jan 2026) moved launch readiness to the second half of 2031, decoupling it from Comet Interceptor.",
  "sources": [
   "https://spacenews.com/esas-comet-interceptor-mission-moves-up-launch/",
   "https://www.esa.int/Science_Exploration/Space_Science/Ariel_moves_from_blueprint_to_reality"
  ]
 },
 {
  "id": "plato",
  "name": "PLATO",
  "agency": "ESA",
  "partners": "PLATO Mission Consortium (DLR lead for payload), OHB (prime)",
  "tier": "confirmed",
  "target": "se-l2",
  "targetName": "Sun-Earth L2",
  "launch": "2027",
  "goal": "26-camera space telescope to find and characterise Earth-like planets around Sun-like stars and study stellar oscillations.",
  "status": "Spacecraft assembled and in final testing; launch on Ariane 6 (6.2) slipped from December 2026 to early 2027 (Wikipedia/DLR give March 2027).",
  "sources": [
   "https://www.esa.int/ESA_Multimedia/Videos/2026/03/Plato_s_launch_on_Ariane_6",
   "https://www.dlr.de/en/research-and-transfer/projects-and-missions/plato",
   "https://en.wikipedia.org/wiki/PLATO_(spacecraft)"
  ],
  "unverified": [
   "Exact 2027 launch month unverified from a primary ESA page (ESA pages returned 403 to fetch)."
  ],
  "ll2": "PLATO"
 },
 {
  "id": "comet-interceptor",
  "name": "Comet Interceptor",
  "agency": "ESA",
  "partners": "JAXA (probe B1)",
  "tier": "confirmed",
  "target": "se-l2",
  "targetName": "Sun-Earth L2",
  "launch": "2028/2029",
  "goal": "Three-spacecraft mission that waits at L2 for a pristine long-period comet or interstellar object, then intercepts it for a multi-point flyby.",
  "status": "ESA SPC approved (Dec 2025) a separate launch as secondary payload on an Ariane 64 in an Aug 2028-Jul 2029 window, instead of waiting for Ariel (2031). Target comet not yet known.",
  "sources": [
   "https://spacenews.com/esas-comet-interceptor-mission-moves-up-launch/",
   "https://www.cosmos.esa.int/web/comet-interceptor/mission-status"
  ],
  "ll2": "Comet Interceptor"
 },
 {
  "id": "hera",
  "name": "Hera",
  "agency": "ESA",
  "partners": "JAXA (TIRI instrument); Juventas and Milani CubeSats",
  "tier": "in-flight",
  "target": "didymos",
  "targetName": "(65803) Didymos",
  "launch": "2024-10-07",
  "arrival": "2026-11",
  "goal": "Survey the Didymos-Dimorphos binary after NASA's DART impact to measure the deflection and Dimorphos' mass, structure and crater.",
  "status": "In final approach: first sighting of Didymos announced Oct 2026 (two years after launch); rendezvous manoeuvres Oct 2026; ESA targets arrival November 2026, with close proximity ops from ~December 2026; CubeSats ~6 weeks after arrival.",
  "sources": [
   "https://www.esa.int/Space_Safety/Hera/ESA_s_Hera_targets_early_arrival_at_Didymos_asteroids",
   "https://www.esa.int/ESA_Multimedia/Images/2026/10/Destination_sighted_Hera_s_first_glimpse_of_Didymos",
   "https://www.esa.int/Enabling_Support/Operations/Hera_operations"
  ],
  "horizons": -91,
  "horizonsNote": "Post-launch ESA trajectory through 2026-11-04 (Horizons revised 2026-09-30).",
  "unverified": [
   "Exact arrival day unverified: ESA says November 2026; some sources give orbit insertion 14 Dec 2026."
  ]
 },
 {
  "id": "lisa",
  "name": "LISA",
  "agency": "ESA",
  "partners": "NASA (lasers, telescopes, charge management - at risk)",
  "tier": "confirmed",
  "target": "sun",
  "targetName": "Sun (Earth-trailing heliocentric orbit)",
  "launch": "2035",
  "goal": "Three-spacecraft laser interferometer with 2.5-million-km arms to detect low-frequency gravitational waves.",
  "status": "Adopted by ESA 2024-01-25 for a 2035 Ariane 6 launch; Congress funded NASA's share in FY2026 ($80.5M) but the FY2027 request again proposes cutting it; ESA has begun contracting European replacements (e.g. telescopes to Thales Alenia Space).",
  "sources": [
   "https://pcos.gsfc.nasa.gov/news/2024/12_LISA_Adopted_by_ESA.php",
   "https://europeanspaceflight.com/?p=6457",
   "https://science.nasa.gov/lisa"
  ]
 },
 {
  "id": "mmx",
  "name": "Martian Moons eXploration (MMX)",
  "agency": "JAXA",
  "partners": "NASA (MEGANE spectrometer), CNES & DLR (IDEFIX rover), ESA",
  "tier": "confirmed",
  "target": "phobos",
  "targetName": "Phobos",
  "launch": "2026-10-19",
  "arrival": "2027-08",
  "goal": "Land on Phobos, return at least 10 g of surface material to Earth, and observe Deimos and Mars' climate.",
  "status": "Scheduled: H3 F10 from Tanegashima 2026-10-20 04:41:03 JST (2026-10-19 19:41 UTC), reserve period to 2026-11-07; Mars arrival Aug 2027; Earth return 2031.",
  "sources": [
   "https://global.jaxa.jp/press/2026/08/20260820-1_e.html",
   "https://www.mmx.jaxa.jp/en/mission/"
  ],
  "horizons": -239,
  "horizonsNote": "Pre-launch JAXA planning trajectory 20261019_20281231_MMX_V0.2 (Horizons revised 2026-10-07).",
  "ll2": "MMX|Martian Moons"
 },
 {
  "id": "tianwen-2",
  "name": "Tianwen-2",
  "agency": "CNSA",
  "tier": "in-flight",
  "targetName": "469219 Kamoʻoalewa",
  "launch": "2025-05-28",
  "arrival": "2026-07",
  "goal": "Sample return from near-Earth quasi-satellite Kamoʻoalewa, then a rendezvous with main-belt comet 311P/PANSTARRS.",
  "status": "At Kamoʻoalewa since mid-2026 (CNSA announced close-in to 20 km on 6 Jul 2026); sampling campaign planned through April 2027, capsule return to Earth ~Nov 2027, then on to 311P (~2035). No confirmed sample collection reported yet.",
  "sources": [
   "https://www.planetary.org/articles/chinas-tianwen-2-mission-has-probably-arrived-at-a-quasi-moon-of-earth",
   "https://www.astronomy.com/space-exploration/tianwen-2-arrives-at-target-asteroid-kamo%CA%BBoalewa/",
   "https://en.wikipedia.org/wiki/Tianwen-2"
  ],
  "unverified": [
   "Launch date 2025-05-28 (UTC) not re-verified in this session; check Wikipedia/CNSA.",
   "Arrival date conflicts: Planetary Society says ~7 Jun 2026, Wikipedia 4 Jul 2026.",
   "Return and 311P dates from Wikipedia."
  ]
 },
 {
  "id": "tianwen-3",
  "name": "Tianwen-3",
  "agency": "CNSA",
  "partners": "International payloads (5 selected projects)",
  "tier": "planned",
  "target": "mars",
  "targetName": "Mars",
  "launch": "2028",
  "arrival": "2029",
  "goal": "Mars sample return (~500-600 g) using two Long March 5 launches (lander+ascent vehicle; orbiter+return vehicle), prioritising search for biosignatures.",
  "status": "Moving into prototyping; officials say on track for ~2028 launch and ~2031 sample return.",
  "sources": [
   "https://www.space.com/astronomy/mars/china-on-track-to-launch-mars-sample-return-mission-in-2028-if-accurate-this-represents-a-sputnik-moment",
   "https://en.wikipedia.org/wiki/Tianwen-3"
  ],
  "unverified": [
   "Arrival year 2029 inferred from Mars transfer (~2028 launch window), not from an official source."
  ],
  "ll2": "Tianwen-3"
 },
 {
  "id": "artemis-ii",
  "name": "Artemis II",
  "agency": "NASA",
  "partners": "CSA (crew), ESA (European Service Module)",
  "tier": "in-flight",
  "target": "moon",
  "targetName": "Moon",
  "launch": "2026-04-01",
  "arrival": "2026-04-06",
  "goal": "First crewed Orion/SLS flight: lunar free-return flyby with Wiseman, Glover, Koch and Hansen.",
  "status": "Flown: launched 2026-04-01 22:35:12 UTC from LC-39B; lunar flyby ~Apr 6; splashdown off Baja California 2026-04-11 ~00:07 UTC.",
  "sources": [
   "https://www.nasa.gov/mission/artemis-ii/",
   "https://www.nasa.gov/artemis-ii-press-kit/"
  ],
  "horizons": -1024,
  "horizonsNote": "Orion 'Integrity' (2026-069A); Horizons revised 2026-04-20.",
  "unverified": [
   "'arrival' = lunar sphere-of-influence entry 2026-04-06 per Horizons timeline; exact closest-approach time not recorded here."
  ]
 },
 {
  "id": "artemis-iii",
  "name": "Artemis III",
  "agency": "NASA",
  "partners": "SpaceX (Starship HLS), Blue Origin (Blue Moon), ESA (ESM)",
  "tier": "confirmed",
  "target": "earth",
  "targetName": "Earth orbit (LEO)",
  "launch": "2027",
  "goal": "Redesignated (Feb 2026) from a landing to a crewed low-Earth-orbit rendezvous/docking test of Orion with one or both commercial lunar landers.",
  "status": "Sep 2026 Isaacman memo (reported via NASA Watch) says ~90 days behind; best case summer 2027 launch; other statements say late 2027.",
  "sources": [
   "https://www.nasa.gov/mission/artemis-iii/",
   "https://www.fox35orlando.com/news/nasa-workforce-memo-details-artemis-iii-launch-delays",
   "https://www.theregister.com/2026/05/01/artemis_iii_aims_for_late/"
  ],
  "unverified": [
   "Launch month unverified (mid- vs late-2027)."
  ],
  "ll2": "Artemis III"
 },
 {
  "id": "artemis-iv",
  "name": "Artemis IV",
  "agency": "NASA",
  "partners": "SpaceX / Blue Origin landers",
  "tier": "planned",
  "target": "moon",
  "targetName": "Moon",
  "launch": "2028",
  "goal": "First crewed lunar landing of the Artemis program after the Artemis III redesignation.",
  "status": "NASA plans Artemis IV landing in 2028 (early 2028 cited); Sep 2026 memo keeps 'up to two lunar landing attempts in 2028' as best case.",
  "sources": [
   "https://x.com/NASAAdmin/status/2043668520752300151",
   "https://www.newsnationnow.com/space/artemis-iii-iv-v-missions-future-nasa/"
  ],
  "ll2": "Artemis IV"
 },
 {
  "id": "artemis-v",
  "name": "Artemis V",
  "agency": "NASA",
  "partners": "SpaceX / Blue Origin landers",
  "tier": "planned",
  "target": "moon",
  "targetName": "Moon",
  "launch": "2028",
  "goal": "Second crewed landing attempt, supporting the planned south-pole Moon Base.",
  "status": "Slated for late 2028 in NASA's revised cadence; contingent on Artemis III/IV schedule.",
  "sources": [
   "https://www.newsnationnow.com/space/artemis-iii-iv-v-missions-future-nasa/",
   "https://www.cbsnews.com/news/nasa-moon-base-plan-lunar-south-pole/"
  ],
  "unverified": [
   "Artemis V 2028 date is from secondary news coverage."
  ]
 },
 {
  "id": "clps-griffin-1",
  "name": "Griffin Mission One (CLPS)",
  "agency": "NASA CLPS",
  "partners": "Astrobotic (now Voyager Technologies company)",
  "tier": "confirmed",
  "target": "moon",
  "targetName": "Moon",
  "launch": "2026-11",
  "goal": "Astrobotic Griffin lander delivery to the lunar south-polar region (VIPER no longer aboard).",
  "status": "Only lunar launch NASA expects in 2026: NET November 2026 (NASA Moon Base manager, 15 Sep 2026, via Aerospace America); some schedules list Dec 2026.",
  "sources": [
   "https://spacenexus.us/programs/clps",
   "https://www.space.com/astronomy/moon/moon-rush-these-private-spacecraft-will-attempt-lunar-landings-in-2026"
  ],
  "unverified": [
   "Date via a secondary CLPS tracker citing NASA/Aerospace America; primary not fetched."
  ],
  "ll2": "Griffin"
 },
 {
  "id": "clps-blue-moon-mk1",
  "name": "Blue Moon MK1 'Endurance' pathfinder",
  "agency": "Blue Origin (NASA CLPS payloads)",
  "partners": "NASA",
  "tier": "confirmed",
  "target": "moon",
  "targetName": "Moon",
  "launch": "2027",
  "goal": "Uncrewed cargo-lander pathfinder for Blue Origin's lunar landing system, landing near the south pole.",
  "status": "Slipped from 'NET fall 2026' to 'first part of 2027' (NASA, 15 Sep 2026). A second MK1 is to carry NASA's VIPER rover, conditionally late 2027.",
  "sources": [
   "https://spacenexus.us/programs/clps",
   "https://spacepolicyonline.com/news/nasa-awards-initial-moon-base-rover-and-lander-contracts/"
  ],
  "unverified": [
   "Reported link of the delay to a 28 May 2026 New Glenn pad incident is from a single secondary source."
  ],
  "ll2": "Blue Moon"
 },
 {
  "id": "clps-im-3",
  "name": "IM-3 (Nova-C 'Trinity')",
  "agency": "Intuitive Machines (NASA CLPS)",
  "partners": "NASA",
  "tier": "confirmed",
  "target": "moon",
  "targetName": "Moon",
  "launch": "2027",
  "goal": "Nova-C landing at Reiner Gamma swirl to study lunar magnetic anomalies.",
  "status": "Moved to first part of 2027 (NASA; IM CEO says Q1 2027).",
  "sources": [
   "https://spacenexus.us/programs/clps",
   "https://newspaceeconomy.ca/2026/01/16/commercial-lunar-payload-services-clps-missions-2024-to-2027/"
  ],
  "ll2": "IM-3"
 },
 {
  "id": "clps-blue-ghost-2",
  "name": "Blue Ghost Mission 2",
  "agency": "Firefly Aerospace (NASA CLPS)",
  "partners": "ESA (Lunar Pathfinder relay)",
  "tier": "confirmed",
  "target": "moon",
  "targetName": "Moon",
  "launch": "2027",
  "goal": "First CLPS far-side landing (Mare Moscoviense area) plus ESA's Lunar Pathfinder relay orbiter.",
  "status": "Slipped to 'later in 2027' (NASA, 15 Sep 2026); Firefly says NET 2027.",
  "sources": [
   "https://en.wikipedia.org/wiki/Blue_Ghost_Mission_2",
   "https://spacenexus.us/programs/clps"
  ],
  "unverified": [
   "Landing site name from general knowledge of the CP-12 task order; verify."
  ],
  "ll2": "Blue Ghost"
 },
 {
  "id": "mars-sample-return",
  "name": "Mars Sample Return (NASA/ESA)",
  "agency": "NASA",
  "partners": "ESA",
  "tier": "ended",
  "target": "mars",
  "targetName": "Mars",
  "goal": "Retrieve Perseverance's cached Mars samples to Earth.",
  "status": "Effectively cancelled: FY2026 appropriations (passed Jan 2026) provided no MSR funding, redirecting ~$110M to a 'Mars Future Missions' technology line.",
  "sources": [
   "https://www.theregister.com/2026/01/16/nasa_science_budget/",
   "https://livescience.com/space/mars/nasas-mars-sample-return-is-dead-leaving-china-to-retrieve-signs-of-life-from-the-red-planet"
  ],
  "unverified": [
   "Claims that ESA formally withdrew in March 2026 come from a low-reliability site."
  ]
 },
 {
  "id": "lunar-gateway",
  "name": "Lunar Gateway",
  "agency": "NASA",
  "partners": "ESA, JAXA, CSA, MBRSC",
  "tier": "ended",
  "target": "moon",
  "targetName": "Moon (near-rectilinear halo orbit)",
  "goal": "Crew-tended station in lunar NRHO supporting Artemis.",
  "status": "Paused 'in its current form' at NASA's 'Ignition' event (24 Mar 2026); funding and staff redirected to a south-pole Moon Base; NASA frames it as deferred, not permanently cancelled; elements may be repurposed.",
  "sources": [
   "https://www.nasaspaceflight.com/2026/03/nasa-moon-base-pivots-gateway/",
   "https://www.space.com/space-exploration/artemis/nasas-lunar-gateway-space-station-is-out-moon-bases-are-in"
  ],
  "unverified": [
   "Tier 'cancelled' is a simplification of 'paused/deferred'."
  ]
 },
 {
  "id": "china-crewed-lunar-landing",
  "name": "China crewed lunar landing (Mengzhou + Lanyue)",
  "agency": "CMSA",
  "tier": "planned",
  "target": "moon",
  "targetName": "Moon",
  "launch": "2029/2030",
  "arrival": "2030",
  "goal": "Land two taikonauts on the Moon before 2030 using Long March 10, Mengzhou crew ship and Lanyue lander.",
  "status": "Official target 'before 2030'; Mengzhou max-Q abort test flown 11 Feb 2026; uncrewed Mengzhou-1 orbital test planned late 2026; Lanyue flight test status unverified.",
  "sources": [
   "https://news.cgtn.com/news/2025-10-30/China-targets-manned-moon-landing-by-2030-1HT7bZFlhxS/share_amp.html",
   "https://en.wikipedia.org/wiki/Mengzhou_(spacecraft)"
  ],
  "unverified": [
   "Mengzhou-1 timing and Lanyue status from secondary sources."
  ]
 },
 {
  "id": "starship-mars-cargo",
  "name": "SpaceX Starship uncrewed Mars flights",
  "agency": "SpaceX",
  "tier": "proposed",
  "target": "mars",
  "targetName": "Mars",
  "launch": "2026-11/2026-12 (window not used)",
  "goal": "Uncrewed Starship landings on Mars as precursors to crewed flights.",
  "status": "In Feb 2026 Musk said SpaceX shifted focus to a Moon city; reporting says the late-2026 Mars window will pass without a SpaceX attempt. Mars flights now notionally 'in 5-7 years'.",
  "sources": [
   "https://www.cnn.com/2026/02/08/science/elon-musk-spacex-priorities-moon-intl-hnk",
   "https://euronews.com/2026/02/11/spacex-puts-mars-mission-plans-on-ice-and-u-turns-for-moon-city-instead"
  ],
  "unverified": [
   "No future window formally announced by SpaceX."
  ]
 },
 {
  "id": "escapade",
  "name": "ESCAPADE (Blue & Gold)",
  "agency": "NASA",
  "partners": "UC Berkeley SSL (lead), Rocket Lab, Advanced Space, Blue Origin",
  "tier": "in-flight",
  "target": "mars",
  "targetName": "Mars",
  "launch": "2025-11-13",
  "arrival": "2027",
  "goal": "Twin smallsats measuring how the solar wind strips Mars' atmosphere via its hybrid magnetosphere.",
  "status": "Launched on New Glenn 2025-11-13 to Sun-Earth L2 loiter; trans-Mars injection burn planned November 2026 followed by ~11-month cruise.",
  "sources": [
   "https://escapade.ssl.berkeley.edu/"
  ],
  "horizons": -9,
  "horizonsNote": "Two spacecraft: ESCAPADE-Blue -9, ESCAPADE-Gold -10 (Horizons revised 2026-10-07).",
  "unverified": [
   "Mars arrival month (~late 2027) inferred from 11-month cruise after Nov 2026 TMI."
  ]
 },
 {
  "id": "uranus-orbiter-probe",
  "name": "Uranus Orbiter and Probe",
  "agency": "NASA",
  "tier": "proposed",
  "target": "uranus",
  "targetName": "Uranus",
  "launch": "2031/2032",
  "arrival": "2044",
  "goal": "Flagship orbiter plus atmospheric probe to study Uranus' interior, atmosphere, rings, moons and magnetosphere.",
  "status": "Top new-flagship priority of the 2023-2032 planetary decadal survey; no new start funded as of 2026.",
  "sources": [
   "https://nap.nationalacademies.org/read/27209/chapter/9"
  ],
  "unverified": [
   "Launch/arrival years are planning numbers from news coverage, not a program baseline."
  ]
 },
 {
  "id": "enceladus-orbilander",
  "name": "Enceladus Orbilander",
  "agency": "NASA",
  "tier": "proposed",
  "target": "enceladus",
  "targetName": "Enceladus",
  "launch": "2038",
  "arrival": "2050s",
  "goal": "Orbit then land on Enceladus to sample plume material and search for evidence of life.",
  "status": "Second-priority flagship in the 2023-2032 decadal survey; concept studies only (launch opportunities 2037/2038).",
  "sources": [
   "https://nap.nationalacademies.org/read/27209/chapter/9",
   "https://en.wikipedia.org/wiki/Enceladus_Orbilander"
  ]
 },
 {
  "id": "interstellar-probe",
  "name": "Interstellar Probe",
  "agency": "NASA (concept by JHU APL)",
  "tier": "proposed",
  "targetName": "Interstellar medium (heliosphere boundary)",
  "launch": "2036",
  "arrival": "2048+",
  "goal": "Fly through the heliosphere to the very local interstellar medium (>350 au over ~50 years).",
  "status": "APL concept study completed April 2022; supported in the 2024 heliophysics decadal survey; not selected or funded.",
  "sources": [
   "https://en.wikipedia.org/wiki/Interstellar_Probe_(spacecraft)",
   "https://www.frontiersin.org/journals/astronomy-and-space-sciences/articles/10.3389/fspas.2023.1061969/text"
  ],
  "unverified": [
   "Arrival at VLISM 12-24 years after launch per study; '2048+' is derived."
  ]
 },
 {
  "id": "solar-gravitational-lens",
  "name": "Solar Gravitational Lens mission",
  "agency": "NASA NIAC (JPL, PI Slava Turyshev)",
  "partners": "The Aerospace Corporation",
  "tier": "proposed",
  "targetName": "Solar gravitational lens focal region (>547 au)",
  "goal": "Place a meter-class telescope beyond ~550 au to use the Sun's gravitational lens to image an exoplanet.",
  "status": "NIAC Phase III study (2020) only; no flight mission approved.",
  "sources": [
   "https://www.nasa.gov/news-release/nasa-selects-early-stage-technology-concepts-for-new-continued-study/"
  ]
 },
 {
  "id": "breakthrough-starshot",
  "name": "Breakthrough Starshot",
  "agency": "Breakthrough Initiatives (private)",
  "tier": "ended",
  "targetName": "Alpha Centauri",
  "goal": "Laser-propelled gram-scale lightsail probes to Alpha Centauri at ~20% of light speed.",
  "status": "On hold: executive director Pete Worden told Scientific American 'We have put the program on hold and are working to transition portions to others'; no funding or meetings.",
  "sources": [
   "https://www.scientificamerican.com/article/the-quiet-demise-of-breakthrough-starshot-a-billionaires-interstellar/"
  ],
  "unverified": [
   "'cancelled' simplifies 'on indefinite hold'."
  ]
 },
 {
  "id": "trident",
  "name": "Trident",
  "agency": "NASA Discovery proposal",
  "partners": "JPL",
  "tier": "proposed",
  "target": "triton",
  "targetName": "Triton",
  "goal": "Single flyby of Neptune's moon Triton to study its plumes, surface and possible ocean.",
  "status": "Discovery finalist (2020) but NOT selected on 2021-06-02 (DAVINCI and VERITAS chosen); not under development.",
  "sources": [
   "https://en.wikipedia.org/wiki/Trident_(spacecraft)",
   "https://www.bostonglobe.com/2021/06/02/nation/new-nasa-missions-will-study-venus-world-overlooked-decades"
  ],
  "notSelected": true
 },
 {
  "id": "europa-clipper",
  "name": "Europa Clipper",
  "agency": "NASA",
  "partners": "JPL, APL",
  "tier": "in-flight",
  "target": "europa",
  "targetName": "Europa",
  "launch": "2024-10-14",
  "arrival": "2030-04-11",
  "goal": "Assess Europa's habitability through 49 close flybys while in Jupiter orbit.",
  "status": "In cruise: Mars gravity assist 2025-03-01; Earth gravity assist 2026-12-03; Jupiter arrival 2030-04-11.",
  "sources": [
   "https://science.nasa.gov/mission/europa-clipper/"
  ],
  "horizons": -159,
  "horizonsNote": "Tracking data through 2026-09-22, predicted thereafter.",
  "craft": "europa-clipper"
 },
 {
  "id": "juice",
  "name": "JUICE",
  "agency": "ESA",
  "partners": "NASA, JAXA, ISA instrument contributions",
  "tier": "in-flight",
  "target": "ganymede",
  "targetName": "Ganymede",
  "launch": "2023-04-14",
  "arrival": "2031-07",
  "goal": "Study Jupiter's icy moons, especially Ganymede (orbit insertion Dec 2034), plus Europa and Callisto.",
  "status": "In cruise: Earth flyby #2 on 2026-09-28; Earth #3 Jan 2029; Jupiter arrival July 2031.",
  "sources": [
   "https://sci.esa.int/web/juice"
  ],
  "horizons": -28,
  "horizonsNote": "Horizons revised 2026-09-27.",
  "craft": "juice"
 },
 {
  "id": "psyche",
  "name": "Psyche",
  "agency": "NASA",
  "partners": "JPL, ASU",
  "tier": "in-flight",
  "targetName": "(16) Psyche",
  "launch": "2023-10-13",
  "arrival": "2029-07",
  "goal": "Orbit and map metal-rich asteroid 16 Psyche.",
  "status": "Completed Mars gravity assist 2026-05-15 (~4,609 km altitude); on course for capture at Psyche late July 2029, science from August 2029.",
  "sources": [
   "https://www.jpl.nasa.gov/news/nasas-psyche-mission-aces-mars-flyby-targets-metal-rich-asteroid/",
   "https://www.nasa.gov/psyche"
  ],
  "horizons": -255,
  "horizonsNote": "Target asteroid is Horizons 2000016.",
  "craft": "psyche"
 },
 {
  "id": "lucy",
  "name": "Lucy",
  "agency": "NASA",
  "partners": "SwRI, GSFC",
  "tier": "in-flight",
  "target": "eurybates",
  "targetName": "(3548) Eurybates",
  "launch": "2021-10-16",
  "arrival": "2027-08-11",
  "goal": "Fly by multiple Jupiter Trojan asteroids (plus main-belt targets).",
  "status": "In cruise after Donaldjohanson flyby (2025-04-20); next Eurybates 2027-08-11, Polymele 2027-09-15, Leucus 2028-04-18, Orus 2028-11-11, Patroclus-Menoetius 2033-03-03.",
  "sources": [
   "https://science.nasa.gov/mission/lucy/",
   "https://lucy.swri.edu/"
  ],
  "horizons": -49,
  "horizonsNote": "Horizons record revised 2025-10-25.",
  "craft": "lucy"
 },
 {
  "id": "smile",
  "name": "SMILE",
  "agency": "ESA / Chinese Academy of Sciences",
  "tier": "in-flight",
  "target": "earth",
  "targetName": "Earth (high elliptical orbit)",
  "launch": "2026-05-19",
  "goal": "Image Earth's magnetosphere in soft X-rays and UV to study solar wind coupling.",
  "status": "Launched 2026-05-19 on Vega C from Kourou; operating in 5,000 x 121,000 km orbit.",
  "sources": [
   "https://www.esa.int/Science_Exploration/Space_Science/Smile"
  ],
  "horizons": -463,
  "horizonsNote": "COSPAR 2026-109A."
 },
 {
  "id": "change-7",
  "name": "Chang'e-7",
  "agency": "CNSA",
  "partners": "International payloads from 7 countries",
  "tier": "confirmed",
  "target": "moon",
  "targetName": "Moon",
  "launch": "2027",
  "goal": "Orbiter, lander, rover and hopper to search for water ice near Shackleton crater at the lunar south pole.",
  "status": "Rolled out for an Aug 2026 launch, then reportedly postponed to 2027 (weather/Typhoon cited by Wikipedia).",
  "sources": [
   "https://www.planetary.org/space-missions/change-7",
   "https://en.wikipedia.org/wiki/Chang'e_7"
  ],
  "unverified": [
   "Postponement to 2027 from Wikipedia/NextSpaceflight; not confirmed by CNSA in sources found."
  ],
  "ll2": "Chang'e[- ]7"
 },
 {
  "id": "ramses",
  "name": "Ramses",
  "agency": "ESA",
  "partners": "JAXA",
  "tier": "confirmed",
  "target": "apophis",
  "targetName": "(99942) Apophis",
  "launch": "2028",
  "arrival": "2029-02",
  "goal": "Rendezvous with Apophis before its 13 April 2029 close Earth approach and observe how the encounter changes it.",
  "status": "Funded at ESA's Nov 2025 ministerial; launch window in 2028.",
  "sources": [
   "https://www.esa.int/Space_in_Member_States/Germany/Finanzspritze_erweitert_Weltraumsicherheitsprogramm"
  ],
  "unverified": [
   "Arrival month (Feb 2029) is the published plan from earlier ESA material; unverified in 2026 sources."
  ],
  "ll2": "Ramses"
 },
 {
  "id": "vigil",
  "name": "Vigil",
  "agency": "ESA",
  "tier": "confirmed",
  "target": "se-l5",
  "targetName": "Sun-Earth L5",
  "launch": "2031",
  "goal": "Space-weather monitor viewing the Sun-Earth line from the side at L5.",
  "status": "In development; ESA lists planned launch 2031 (Q3 2031 per Wikipedia), funding secured.",
  "sources": [
   "https://www.esa.int/Space_Safety/Vigil"
  ]
 },
 {
  "id": "argonaut",
  "name": "Argonaut",
  "agency": "ESA",
  "tier": "planned",
  "target": "moon",
  "targetName": "Moon",
  "launch": "2030/2031",
  "goal": "European autonomous cargo lander (up to ~1.8 t) for logistics to the lunar surface.",
  "status": "In development studies; first mission targeted 2030-2031 on Ariane 64.",
  "sources": [
   "https://www.space.com/esa-2031-first-argonaut-moon-lander-mission",
   "https://en.wikipedia.org/wiki/Argonaut_(lunar_lander)"
  ],
  "unverified": [
   "First-launch year unverified (2030 vs 2031)."
  ]
 },
 {
  "id": "lunar-trailblazer",
  "name": "Lunar Trailblazer",
  "agency": "NASA (SIMPLEx)",
  "partners": "Caltech (PI), Lockheed Martin",
  "tier": "ended",
  "target": "moon",
  "targetName": "Moon",
  "launch": "2025-02-27",
  "goal": "Small orbiter to map lunar water.",
  "status": "Lost contact shortly after launch (2025-02-27); mission formally ended 2025-07-31 (solar arrays mis-oriented, batteries depleted).",
  "sources": [
   "https://www.jpl.nasa.gov/news/nasas-lunar-trailblazer-moon-mission-ends/"
  ],
  "horizons": -242,
  "horizonsNote": "Final reconstruction; drifting in heliocentric orbit.",
  "unverified": [
   "Tier 'cancelled' used for 'failed/ended'."
  ]
 }
];
