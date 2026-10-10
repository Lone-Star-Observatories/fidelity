// Backend URLs for spacecraft ephemerides (shared by the client and the standalone build,
// which keys its bundled snapshot by these exact URLs).
const isoDay = (jd) => new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 10);

export const monthUrl = (hz, jd) => `/api/horizons/vectors?body=${hz}&month=${isoDay(jd).slice(0, 7)}`;
export const localUrl = (hz, center, jd) => `/api/horizons/local?body=${hz}&center=${center}&day=${isoDay(jd)}`;
export const localMonthUrl = (hz, center, jd) => `/api/horizons/local-month?body=${hz}&center=${center}&month=${isoDay(jd).slice(0, 7)}`;
export const trackUrl = (hz, start, stop) => `/api/horizons/track?body=${hz}&start=${start}&stop=${stop}&n=400`;
