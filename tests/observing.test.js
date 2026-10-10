import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJwstSchedule } from '../server/observing.js';

// Excerpt of an STScI JWST weekly schedule report (fixed-width columns).
const REPORT = `Visit Information for OP Package 2628203f01

VISIT ID       PCS MODE    VISIT TYPE                     SCHEDULED START TIME  DURATION     SCIENCE INSTRUMENT AND MODE                         TARGET NAME                      CATEGORY                        KEYWORDS                        
-------------  ----------  -----------------------------  --------------------  -----------  --------------------------------------------------  -------------------------------  ------------------------------  --------------------------------
11587:1:1      FINEGUIDE   PRIME TARGETED FIXED           2026-10-05T01:00:39Z  00/00:27:28  NIRCam Imaging                                      NGC-104                          Stellar Cluster                 Globular star clusters
12553:16:1     NONE        PARALLEL SLEW CALIBRATION      ^ATTACHED TO PRIME^                NIRSpec Internal Lamp                             
8004:1:1       FINEGUIDE   PRIME TARGETED FIXED           2026-10-05T09:48:26Z  00/08:32:15  NIRSpec Bright Object Time Series                   TOI-431d                         Star                            Exoplanets
                                                                                                                                                 TA-TOI-431d                      Star                            M stars
`;

test('JWST schedule: visits, durations, parallels and continuation lines', () => {
  const v = parseJwstSchedule(REPORT);
  assert.equal(v.length, 3);
  assert.deepEqual([v[0].visit, v[0].target, v[0].instrument, v[0].start, v[0].durationSec], ['11587:1:1', 'NGC-104', 'NIRCam Imaging', '2026-10-05T01:00:39Z', 27 * 60 + 28]);
  assert.equal(v[1].parallel, true);
  assert.equal(v[1].start, null);
  assert.equal(v[2].durationSec, (8 * 60 + 32) * 60 + 15);
  assert.deepEqual(v[2].alsoTargets, ['TA-TOI-431d']);
  assert.match(v[2].keywords, /Exoplanets, M stars/);
});
