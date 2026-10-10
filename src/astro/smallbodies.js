// Asteroids, dwarf planets and comets on two-body orbits from osculating elements
// (JPL Small-Body Database: a AU, e, i, Ω, ω, M degrees at an epoch; J2000 ecliptic).
// Planetary perturbations are ignored, so accuracy degrades slowly away from the epoch.

import { positionAt, ellipse } from './kepler.js';

const DEG = Math.PI / 180;
const GAUSS = 0.9856076686; // deg/day for a = 1 AU around the Sun

const radians = (el) => ({ a: el.a, e: el.e, I: el.i * DEG, node: el.node * DEG, peri: (el.node + el.w) * DEG });

/** Mean motion, degrees per day. */
export const meanMotion = (el) => GAUSS / el.a ** 1.5;

/** Heliocentric J2000 ecliptic [x, y, z] AU at `jd`. */
export const smallBodyPosition = (el, jd) => positionAt(radians(el), (el.M + meanMotion(el) * (jd - el.epochJd)) * DEG);

/** Points around the orbit ellipse. */
export const smallBodyOrbit = (el, segments = 256) => ellipse(radians(el), segments);
