import test from "node:test";
import assert from "node:assert/strict";
import { SCORE_VERSION, computeUnifiedScore } from "./unified_score.mjs";

test("unified score combines all components to 100", () => {
  const result = computeUnifiedScore({
    trendChecks: Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`check_${index}`, true])),
    banker: 80,
    bankerMa: 60,
    bankerRising: true,
    hotMoney: 50,
    retailer: 20,
    volumeBuzz: 60,
    udVolumeRatio: 2,
    currentVolumeAboveAverage: true,
    currentVolumeIsHigh: true,
    rsRating: 95,
    swingUp: true,
    inEntryZone: true,
    nearEntryZone: false,
    stopDistancePct: 7,
    notExtended: true,
  });

  assert.equal(result.scoreVersion, SCORE_VERSION);
  assert.deepEqual(result.components, { flow: 25, mcdx: 20, volume: 20, rs: 15, swing_entry: 20 });
  assert.equal(result.totalScore, 100);
  assert.equal(result.label, "YES");
});

test("unified score does not depend on news data", () => {
  const result = computeUnifiedScore({
    trendChecks: Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`check_${index}`, index < 6])),
    banker: 80,
    bankerMa: 60,
    bankerRising: true,
    hotMoney: 50,
    retailer: 20,
    volumeBuzz: 60,
    udVolumeRatio: 2,
    currentVolumeAboveAverage: true,
    currentVolumeIsHigh: true,
    rsRating: 95,
    swingUp: false,
    inEntryZone: false,
    nearEntryZone: true,
    stopDistancePct: 9,
    notExtended: false,
  });

  assert.equal(result.totalScore, 73.6);
  assert.equal(result.components.swing_entry, 5);
});
