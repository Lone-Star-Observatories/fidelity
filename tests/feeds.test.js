import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SAT_FEEDS, ISS_STREAMS, youtubeEmbed } from '../src/data/feeds.js';

test('ISS live video offers the two live YouTube streams, each with a credit', () => {
  const video = SAT_FEEDS[25544].find((f) => f.kind === 'video');
  assert.deepEqual(video.streams.map((s) => s.id), ['awQzjn72bI0', 'fO9e9jnhYK8']);
  for (const s of ISS_STREAMS) assert.ok(s.label && s.credit);
  assert.equal(youtubeEmbed('awQzjn72bI0').split('?')[0], 'https://www.youtube.com/embed/awQzjn72bI0');
});
