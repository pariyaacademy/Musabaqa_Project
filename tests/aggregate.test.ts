import assert from "node:assert";
import { applyAggregationMethod } from "../lib/scoring/aggregate";

const j = (judgeId: string, total: number, weight = 1, isChairman = false) => ({ judgeId, total, weight, isChairman });

// AVERAGE_ALL
assert.strictEqual(
  applyAggregationMethod("AVERAGE_ALL", [j("a", 80), j("b", 90), j("c", 100)]),
  90,
  "AVERAGE_ALL should average all three"
);

// DROP_LOWEST
assert.strictEqual(
  applyAggregationMethod("DROP_LOWEST", [j("a", 70), j("b", 90), j("c", 100)]),
  95,
  "DROP_LOWEST should drop 70 and average 90+100"
);
assert.strictEqual(
  applyAggregationMethod("DROP_LOWEST", [j("a", 88)]),
  88,
  "DROP_LOWEST with a single judge should just return that judge's score"
);

// DROP_HIGHEST_AND_LOWEST
assert.strictEqual(
  applyAggregationMethod("DROP_HIGHEST_AND_LOWEST", [j("a", 60), j("b", 80), j("c", 90), j("d", 100)]),
  85,
  "DROP_HIGHEST_AND_LOWEST should drop 60 and 100, average 80+90"
);
assert.strictEqual(
  applyAggregationMethod("DROP_HIGHEST_AND_LOWEST", [j("a", 60), j("b", 80)]),
  70,
  "DROP_HIGHEST_AND_LOWEST with only 2 judges should fall back to plain average"
);

// WEIGHTED_AVERAGE
assert.strictEqual(
  applyAggregationMethod("WEIGHTED_AVERAGE", [j("a", 80, 1), j("b", 100, 3)]),
  95,
  "WEIGHTED_AVERAGE should weight judge b 3x: (80*1 + 100*3) / 4 = 95"
);

// CHAIRMAN_OVERRIDE
assert.strictEqual(
  applyAggregationMethod("CHAIRMAN_OVERRIDE", [j("a", 70), j("b", 85, 1, true), j("c", 60)]),
  85,
  "CHAIRMAN_OVERRIDE should use only the chairman's score"
);
assert.strictEqual(
  applyAggregationMethod("CHAIRMAN_OVERRIDE", [j("a", 70), j("b", 90)]),
  80,
  "CHAIRMAN_OVERRIDE with no chairman designated should fall back to average"
);

console.log("All aggregation tests passed.");
