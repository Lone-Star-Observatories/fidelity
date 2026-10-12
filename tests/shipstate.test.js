import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eclToEq, sceneToFrame, eclSceneToGal, galToEclScene, starGalLy, galSceneToEclSceneBasis, systemEdgeAU, autoSim, SIM_SPEEDS } from '../src/views/ship/shipState.js';
import { eqToEcl, frameToScene, galacticLB, LY_PER_PC } from '../src/astro/frames.js';
import { navDecision, quadrantDecision, galaxyDecision, nearestStar } from '../src/views/ship/handover.js';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (±${tol})`);
const closeV = (a, b, tol, msg) => a.forEach((x, i) => close(x, b[i], tol, `${msg ?? ''}[${i}]`));

test('frame round trips: ecliptic ⇄ equatorial, scene ⇄ frame, System View scene ⇄ galactic', () => {
  const v = [0.3, -0.7, 0.648];
  closeV(eclToEq(eqToEcl(v)), v, 1e-9);
  closeV(sceneToFrame(frameToScene(v)), v, 1e-15);
  closeV(eclSceneToGal(galToEclScene(v)), v, 1e-9);
  closeV(galToEclScene(eclSceneToGal(v)), v, 1e-9);
});

test('the direction to Sol from Alpha Centauri agrees between the System View and the galactic frame', () => {
  const s = { x: -0.495, y: -0.414, z: -1.157 }; // α Cen A, J2000 equatorial parsecs (HYG)
  const n = Math.hypot(s.x, s.y, s.z);
  const solDirScene = frameToScene(eqToEcl([-s.x / n, -s.y / n, -s.z / n])); // as systems.js builds model.solDirection
  const g = starGalLy(s), gn = Math.hypot(...g);
  closeV(eclSceneToGal(solDirScene), g.map((x) => -x / gn), 1e-9);
  close(gn, n * LY_PER_PC, 1e-9, 'distance ly');
  const { l, b } = galacticLB([s.x, s.y, s.z]); // takes the equatorial vector
  close(Math.atan2(g[1], g[0]) * 180 / Math.PI + 360, l, 1e-6, 'starGalLy is galactic');
  close(l, 315.7, 0.3, 'galactic longitude'); close(b, -0.7, 0.3, 'galactic latitude');
});

test('the attitude basis between the views is a rotation', () => {
  const B = galSceneToEclSceneBasis();
  for (let i = 0; i < 3; i++) {
    close(Math.hypot(...B[i]), 1, 1e-9, `unit ${i}`);
    for (let j = i + 1; j < 3; j++) close(B[i][0] * B[j][0] + B[i][1] * B[j][1] + B[i][2] * B[j][2], 0, 1e-9, `orthogonal ${i}${j}`);
  }
  const det = B[0][0] * (B[1][1] * B[2][2] - B[1][2] * B[2][1]) - B[1][0] * (B[0][1] * B[2][2] - B[0][2] * B[2][1]) + B[2][0] * (B[0][1] * B[1][2] - B[0][2] * B[1][1]);
  close(det, 1, 1e-9, 'proper rotation');
});

test('system edge and the simulation speed-up', () => {
  assert.equal(systemEdgeAU({ survey: [{ au: 4.2 }, { au: 80 }, { au: 260 }, { localKm: 1e5 }] }), 299);
  assert.equal(systemEdgeAU({ survey: [{ au: 0.3 }] }), 200);
  assert.equal(autoSim(10), 1);
  assert.equal(autoSim(4.37 * 3.15576e7 / 3053), 3600, 'α Cen at warp 9.9: 12.5 h, watched at 1 H/S');
  assert.equal(autoSim(26670 * 3.15576e7 / 3053), 31557600, 'the galactic centre at warp 9.9: 8.7 years, at 1 YEAR/S');
  assert.equal(autoSim(1e20), SIM_SPEEDS.at(-1)[0]);
});

test('hand-overs between the galaxy-scale views', () => {
  const sol = { id: 'sol', gal: [0, 0, 0] }, acen = { id: 'acen', gal: [3.13, -3.05, -0.05] };
  const stars = [sol, acen];
  // just left Sol at 300 AU: Sol must not recapture until 0.03 ly out
  const state = { departed: 'sol', departedArmed: false };
  assert.equal(navDecision({ pos: [0.005, 0, 0], vel: [1, 0, 0], centreGal: [0, 0, 0], radiusLy: 25, stars, state }), null);
  assert.equal(navDecision({ pos: [0.04, 0, 0], vel: [1, 0, 0], centreGal: [0, 0, 0], radiusLy: 25, stars, state }), null);
  assert.equal(state.departedArmed, true);
  assert.deepEqual(navDecision({ pos: [0.01, 0, 0], vel: [-1, 0, 0], centreGal: [0, 0, 0], radiusLy: 25, stars, state }), { to: 'system', id: 'sol' }, 'flying back in');
  assert.deepEqual(navDecision({ pos: [3.12, -3.05, -0.05], vel: [1, 0, 0], centreGal: [0, 0, 0], radiusLy: 25, stars, state: {} }), { to: 'system', id: 'acen' });
  assert.deepEqual(navDecision({ pos: [2, -2, 0], vel: [1, 0, 0], centreGal: [0, 0, 0], radiusLy: 25, stars, courseId: 'acen', arrived: true, state: {} }), { to: 'system', id: 'acen' });
  assert.deepEqual(navDecision({ pos: [26, 0, 0], vel: [1, 0, 0], centreGal: [0, 0, 0], radiusLy: 25, stars, state: {} }), { to: 'quadrant' });
  assert.equal(navDecision({ pos: [26, 0, 0], vel: [-1, 0, 0], centreGal: [0, 0, 0], radiusLy: 25, stars, state: {} }), null, 'heading back in');
  // Quadrant: out to the Galaxy, in to Navigation
  const far = [{ id: 'pleiad', gal: [-300, 100, -150] }];
  assert.deepEqual(quadrantDecision({ pos: [3100, 0, 0], vel: [1, 0, 0], radiusLy: 3000, stars: far }), { to: 'galaxy' });
  assert.equal(quadrantDecision({ pos: [-310, 100, -150], vel: [1, 0, 0], radiusLy: 3000, stars: far }), null, 'still cruising');
  assert.deepEqual(quadrantDecision({ pos: [-310, 100, -150], vel: [0, 0, 0], radiusLy: 3000, stars: far, stopped: true }), { to: 'navigation', id: 'pleiad' });
  assert.deepEqual(quadrantDecision({ pos: [40, 0, 0], vel: [-1, 0, 0], radiusLy: 3000, stars: far }), { to: 'navigation', id: 'sol' });
  assert.equal(quadrantDecision({ pos: [30, 0, 0], vel: [1, 0, 0], radiusLy: 3000, stars: far }), null, 'leaving Sol');
  // Galaxy: back to the Quadrant near Sol only
  assert.deepEqual(galaxyDecision({ pos: [2000, 0, 0], vel: [-1, 0, 0], quadrantRadiusLy: 3000 }), { to: 'quadrant' });
  assert.equal(galaxyDecision({ pos: [2000, 0, 0], vel: [1, 0, 0], quadrantRadiusLy: 3000 }), null);
  assert.equal(galaxyDecision({ pos: [20000, 0, 0], vel: [-1, 0, 0], quadrantRadiusLy: 3000 }), null);
  assert.equal(nearestStar([3, -3, 0], stars).star.id, 'acen');
});
