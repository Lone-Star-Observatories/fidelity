// The Mac App Store build (#51): `VITE_FIDELITY_APP_STORE=1 npm run build:standalone`.
// It leaves out franchise-branded extras (the Star Trek layer of #25/#41, held off in settings.js and
// trek.js, and the STAR TREK postcard style) that App Review would treat as third-party trademarks
// (guideline 5.2).
export const APP_STORE = import.meta.env?.VITE_FIDELITY_APP_STORE === '1';
