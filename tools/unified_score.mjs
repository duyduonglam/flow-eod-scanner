export const SCORE_VERSION = "volume-mcdx-flow-v1";

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function label(total) {
  if (total >= 80) return "YES";
  if (total >= 70) return "PARTIAL";
  return "NO";
}

export function computeUnifiedScore({
  trendChecks,
  banker,
  bankerMa,
  bankerRising,
  hotMoney,
  retailer,
  volumeBuzz,
  udVolumeRatio,
  currentVolumeAboveAverage,
  currentVolumeIsHigh,
  rsRating,
  swingUp,
  inEntryZone,
  nearEntryZone,
  stopDistancePct,
  notExtended,
}) {
  const checks = Array.isArray(trendChecks) ? trendChecks : Object.values(trendChecks ?? {});
  const flow = Math.min(25, 25 * checks.filter(Boolean).length / Math.max(checks.length, 11));

  const bankerValue = number(banker);
  const bankerMaValue = number(bankerMa);
  const hotValue = number(hotMoney);
  const retailerValue = number(retailer, 100);
  let mcdx = 0;
  if (bankerValue > 50) mcdx += 5;
  if (bankerValue >= bankerMaValue) mcdx += 4;
  if (bankerRising) mcdx += 3;
  if (hotValue >= 30 && hotValue <= 90) mcdx += 4;
  if (retailerValue <= 30) mcdx += 2;
  if (bankerValue >= 70 && bankerValue >= bankerMaValue) mcdx += 2;

  const buzz = number(volumeBuzz, -100);
  const udRatio = number(udVolumeRatio);
  let volume = 0;
  if (buzz > 0) volume += 4;
  if (buzz > 50) volume += 3;
  if (udRatio > 1) volume += 4;
  if (udRatio > 1.5) volume += 3;
  if (currentVolumeAboveAverage) volume += 3;
  if (currentVolumeIsHigh) volume += 3;

  const rsValue = number(rsRating);
  const rs = rsValue > 90 ? 15 : rsValue > 80 ? 10 : rsValue > 70 ? 5 : 0;

  let swingEntry = 0;
  if (swingUp) swingEntry += 5;
  if (inEntryZone) swingEntry += 6;
  else if (nearEntryZone) swingEntry += 3;
  const stopDistance = number(stopDistancePct, 100);
  if (stopDistance <= 8) swingEntry += 4;
  else if (stopDistance <= 10) swingEntry += 2;
  if (notExtended) swingEntry += 5;

  const components = {
    flow: round(Math.min(flow, 25)),
    mcdx: round(Math.min(mcdx, 20)),
    volume: round(Math.min(volume, 20)),
    rs: round(rs),
    swing_entry: round(Math.min(swingEntry, 20)),
  };
  const totalScore = round(Object.values(components).reduce((sum, value) => sum + value, 0));
  return { totalScore, label: label(totalScore), components, scoreVersion: SCORE_VERSION };
}
