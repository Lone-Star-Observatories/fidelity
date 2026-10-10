// Crew helpers (#46), pure so they can be tested: who is aboard what, and time in space.

const DAY_MS = 86400000;
/** Which people are aboard a craft ('ISS', 'TIANGONG' or any spacecraft name; null = everyone). */
export const aboard = (people, craft) => (!craft ? people : craft === 'ISS' ? people.filter((p) => p.iss) : craft === 'TIANGONG' ? people.filter((p) => !p.iss && /shenzhou|tiangong|tianzhou/i.test(p.spacecraft)) : people.filter((p) => p.spacecraft === craft));
/** Days since launch on this mission at time `nowMs`. */
export const missionDays = (p, nowMs = Date.now()) => (p.launched ? (nowMs - Date.parse(p.launched)) / DAY_MS : null);
/** Earlier flights (feed) plus this mission: total days in space. */
export const totalDays = (p, nowMs = Date.now()) => (p.priorDaysInSpace ?? 0) + (missionDays(p, nowMs) ?? 0);
export const initials = (name) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
