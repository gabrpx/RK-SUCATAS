import {
  band,
  cubehelixLong,
  cubehelix_default,
  hclLong,
  hcl_default,
  hslLong,
  hsl_default,
  lab,
  linear,
  log,
  ordinal,
  point,
  pow,
  quantile,
  quantize,
  radial,
  rgb_default,
  round_default,
  second,
  sqrt,
  symlog,
  threshold,
  time,
  timeDay,
  timeHour,
  timeMinute,
  timeMonth,
  timeSunday,
  timeYear,
  utcDay,
  utcHour,
  utcMinute,
  utcMonth,
  utcSunday,
  utcTime,
  utcYear
} from "./chunk-4KYZ6QUR.js";

// node_modules/@visx/scale/esm/operators/domain.js
function applyDomain(scale, config) {
  if (config.domain) {
    if ("nice" in scale || "quantiles" in scale) {
      scale.domain(config.domain);
    } else if ("padding" in scale) {
      scale.domain(config.domain);
    } else {
      scale.domain(config.domain);
    }
  }
}

// node_modules/@visx/scale/esm/operators/range.js
function applyRange(scale, config) {
  if (config.range) {
    if ("padding" in scale) {
      scale.range(config.range);
    } else {
      scale.range(config.range);
    }
  }
}

// node_modules/@visx/scale/esm/operators/align.js
function applyAlign(scale, config) {
  if ("align" in scale && "align" in config && typeof config.align !== "undefined") {
    scale.align(config.align);
  }
}

// node_modules/@visx/scale/esm/operators/base.js
function applyBase(scale, config) {
  if ("base" in scale && "base" in config && typeof config.base !== "undefined") {
    scale.base(config.base);
  }
}

// node_modules/@visx/scale/esm/operators/clamp.js
function applyClamp(scale, config) {
  if ("clamp" in scale && "clamp" in config && typeof config.clamp !== "undefined") {
    scale.clamp(config.clamp);
  }
}

// node_modules/@visx/scale/esm/operators/constant.js
function applyConstant(scale, config) {
  if ("constant" in scale && "constant" in config && typeof config.constant !== "undefined") {
    scale.constant(config.constant);
  }
}

// node_modules/@visx/scale/esm/operators/exponent.js
function applyExponent(scale, config) {
  if ("exponent" in scale && "exponent" in config && typeof config.exponent !== "undefined") {
    scale.exponent(config.exponent);
  }
}

// node_modules/@visx/scale/esm/utils/createColorInterpolator.js
var interpolatorMap = {
  lab,
  hcl: hcl_default,
  "hcl-long": hclLong,
  hsl: hsl_default,
  "hsl-long": hslLong,
  cubehelix: cubehelix_default,
  "cubehelix-long": cubehelixLong,
  rgb: rgb_default
};
function createColorInterpolator(interpolate) {
  switch (interpolate) {
    case "lab":
    case "hcl":
    case "hcl-long":
    case "hsl":
    case "hsl-long":
    case "cubehelix":
    case "cubehelix-long":
    case "rgb":
      return interpolatorMap[interpolate];
    default:
  }
  const {
    type,
    gamma
  } = interpolate;
  const interpolator = interpolatorMap[type];
  return typeof gamma === "undefined" ? interpolator : interpolator.gamma(gamma);
}

// node_modules/@visx/scale/esm/operators/interpolate.js
function applyInterpolate(scale, config) {
  if ("interpolate" in config && "interpolate" in scale && typeof config.interpolate !== "undefined") {
    const interpolator = createColorInterpolator(config.interpolate);
    scale.interpolate(interpolator);
  }
}

// node_modules/@visx/scale/esm/utils/isUtcScale.js
var TEST_TIME = new Date(Date.UTC(2020, 1, 2, 3, 4, 5));
var TEST_FORMAT = "%Y-%m-%d %H:%M";
function isUtcScale(scale) {
  const output = scale.tickFormat(1, TEST_FORMAT)(TEST_TIME);
  return output === "2020-02-02 03:04";
}

// node_modules/@visx/scale/esm/operators/nice.js
var localTimeIntervals = {
  day: timeDay,
  hour: timeHour,
  minute: timeMinute,
  month: timeMonth,
  second,
  week: timeSunday,
  year: timeYear
};
var utcIntervals = {
  day: utcDay,
  hour: utcHour,
  minute: utcMinute,
  month: utcMonth,
  second,
  week: utcSunday,
  year: utcYear
};
function applyNice(scale, config) {
  if ("nice" in config && typeof config.nice !== "undefined" && "nice" in scale) {
    const {
      nice
    } = config;
    if (typeof nice === "boolean") {
      if (nice) {
        scale.nice();
      }
    } else if (typeof nice === "number") {
      scale.nice(nice);
    } else {
      const timeScale = scale;
      const isUtc = isUtcScale(timeScale);
      if (typeof nice === "string") {
        timeScale.nice(isUtc ? utcIntervals[nice] : localTimeIntervals[nice]);
      } else {
        const {
          interval,
          step
        } = nice;
        const parsedInterval = (isUtc ? utcIntervals[interval] : localTimeIntervals[interval]).every(step);
        if (parsedInterval != null) {
          timeScale.nice(parsedInterval);
        }
      }
    }
  }
}

// node_modules/@visx/scale/esm/operators/padding.js
function applyPadding(scale, config) {
  if ("padding" in scale && "padding" in config && typeof config.padding !== "undefined") {
    scale.padding(config.padding);
  }
  if ("paddingInner" in scale && "paddingInner" in config && typeof config.paddingInner !== "undefined") {
    scale.paddingInner(config.paddingInner);
  }
  if ("paddingOuter" in scale && "paddingOuter" in config && typeof config.paddingOuter !== "undefined") {
    scale.paddingOuter(config.paddingOuter);
  }
}

// node_modules/@visx/scale/esm/operators/reverse.js
function applyReverse(scale, config) {
  if (config.reverse) {
    const reversedRange = scale.range().slice().reverse();
    if ("padding" in scale) {
      scale.range(reversedRange);
    } else {
      scale.range(reversedRange);
    }
  }
}

// node_modules/@visx/scale/esm/operators/round.js
function applyRound(scale, config) {
  if ("round" in config && typeof config.round !== "undefined") {
    if (config.round && "interpolate" in config && typeof config.interpolate !== "undefined") {
      console.warn(`[visx/scale/applyRound] ignoring round: scale config contains round and interpolate. only applying interpolate. config:`, config);
    } else if ("round" in scale) {
      scale.round(config.round);
    } else if ("interpolate" in scale && config.round) {
      scale.interpolate(round_default);
    }
  }
}

// node_modules/@visx/scale/esm/operators/unknown.js
function applyUnknown(scale, config) {
  if ("unknown" in scale && "unknown" in config && typeof config.unknown !== "undefined") {
    scale.unknown(config.unknown);
  }
}

// node_modules/@visx/scale/esm/operators/zero.js
function applyZero(scale, config) {
  if ("zero" in config && config.zero === true) {
    const domain = scale.domain();
    const [a, b] = domain;
    const isDescending = b < a;
    const [min, max] = isDescending ? [b, a] : [a, b];
    const domainWithZero = [Math.min(0, min), Math.max(0, max)];
    scale.domain(isDescending ? domainWithZero.reverse() : domainWithZero);
  }
}

// node_modules/@visx/scale/esm/operators/scaleOperator.js
var ALL_OPERATORS = [
  // domain => nice => zero
  "domain",
  "nice",
  "zero",
  // interpolate before round
  "interpolate",
  "round",
  // set range then reverse
  "range",
  "reverse",
  // Order does not matter for these operators
  "align",
  "base",
  "clamp",
  "constant",
  "exponent",
  "padding",
  "unknown"
];
var operators = {
  domain: applyDomain,
  nice: applyNice,
  zero: applyZero,
  interpolate: applyInterpolate,
  round: applyRound,
  align: applyAlign,
  base: applyBase,
  clamp: applyClamp,
  constant: applyConstant,
  exponent: applyExponent,
  padding: applyPadding,
  range: applyRange,
  reverse: applyReverse,
  unknown: applyUnknown
};
function scaleOperator() {
  for (var _len = arguments.length, ops = new Array(_len), _key = 0; _key < _len; _key++) {
    ops[_key] = arguments[_key];
  }
  const selection = new Set(ops);
  const selectedOps = ALL_OPERATORS.filter((o) => selection.has(o));
  return function applyOperators(scale, config) {
    if (typeof config !== "undefined") {
      selectedOps.forEach((op) => {
        operators[op](scale, config);
      });
    }
    return scale;
  };
}

// node_modules/@visx/scale/esm/scales/band.js
var updateBandScale = scaleOperator("domain", "range", "reverse", "align", "padding", "round");
function createBandScale(config) {
  return updateBandScale(band(), config);
}

// node_modules/@visx/scale/esm/scales/point.js
var updatePointScale = scaleOperator("domain", "range", "reverse", "align", "padding", "round");
function createPointScale(config) {
  return updatePointScale(point(), config);
}

// node_modules/@visx/scale/esm/scales/linear.js
var updateLinearScale = scaleOperator("domain", "range", "reverse", "clamp", "interpolate", "nice", "round", "zero");
function createLinearScale(config) {
  return updateLinearScale(linear(), config);
}

// node_modules/@visx/scale/esm/scales/radial.js
var updateRadialScale = scaleOperator("domain", "range", "clamp", "nice", "round", "unknown");
function createRadialScale(config) {
  return updateRadialScale(radial(), config);
}

// node_modules/@visx/scale/esm/scales/time.js
var updateTimeScale = scaleOperator("domain", "range", "reverse", "clamp", "interpolate", "nice", "round");
function createTimeScale(config) {
  return updateTimeScale(time(), config);
}

// node_modules/@visx/scale/esm/scales/utc.js
var updateUtcScale = scaleOperator("domain", "range", "reverse", "clamp", "interpolate", "nice", "round");
function createUtcScale(config) {
  return updateUtcScale(utcTime(), config);
}

// node_modules/@visx/scale/esm/scales/log.js
var updateLogScale = scaleOperator("domain", "range", "reverse", "base", "clamp", "interpolate", "nice", "round");
function createLogScale(config) {
  return updateLogScale(log(), config);
}

// node_modules/@visx/scale/esm/scales/power.js
var updatePowScale = scaleOperator("domain", "range", "reverse", "clamp", "exponent", "interpolate", "nice", "round", "zero");
function createPowScale(config) {
  return updatePowScale(pow(), config);
}

// node_modules/@visx/scale/esm/scales/ordinal.js
var updateOrdinalScale = scaleOperator("domain", "range", "reverse", "unknown");
function createOrdinalScale(config) {
  return updateOrdinalScale(ordinal(), config);
}

// node_modules/@visx/scale/esm/scales/quantize.js
var updateQuantizeScale = scaleOperator("domain", "range", "reverse", "nice", "zero");
function createQuantizeScale(config) {
  return updateQuantizeScale(quantize(), config);
}

// node_modules/@visx/scale/esm/scales/quantile.js
var updateQuantileScale = scaleOperator("domain", "range", "reverse");
function createQuantileScale(config) {
  return updateQuantileScale(quantile(), config);
}

// node_modules/@visx/scale/esm/scales/symlog.js
var updateSymlogScale = scaleOperator("domain", "range", "reverse", "clamp", "constant", "nice", "zero", "round");
function createSymlogScale(config) {
  return updateSymlogScale(symlog(), config);
}

// node_modules/@visx/scale/esm/scales/threshold.js
var updateThresholdScale = scaleOperator("domain", "range", "reverse");
function createThresholdScale(config) {
  return updateThresholdScale(threshold(), config);
}

// node_modules/@visx/scale/esm/scales/squareRoot.js
var updateSqrtScale = scaleOperator("domain", "range", "reverse", "clamp", "interpolate", "nice", "round", "zero");
function createSqrtScale(config) {
  return updateSqrtScale(sqrt(), config);
}

// node_modules/@visx/scale/esm/createScale.js
function createScale(config) {
  if (typeof config !== "undefined" && "type" in config) {
    switch (config.type) {
      case "linear":
        return createLinearScale(config);
      case "log":
        return createLogScale(config);
      case "pow":
        return createPowScale(config);
      case "sqrt":
        return createSqrtScale(config);
      case "symlog":
        return createSymlogScale(config);
      case "time":
        return createTimeScale(config);
      case "utc":
        return createUtcScale(config);
      case "quantile":
        return createQuantileScale(config);
      case "quantize":
        return createQuantizeScale(config);
      case "threshold":
        return createThresholdScale(config);
      case "ordinal":
        return createOrdinalScale(config);
      case "point":
        return createPointScale(config);
      case "band":
        return createBandScale(config);
      case "radial":
        return createRadialScale(config);
      default:
    }
  }
  return createLinearScale(config);
}
var createScale_default = createScale;

// node_modules/@visx/scale/esm/updateScale.js
var applyAllOperators = scaleOperator(...ALL_OPERATORS);
function updateScale(scale, config) {
  return applyAllOperators(scale.copy(), config);
}
var updateScale_default = updateScale;

// node_modules/@visx/scale/esm/utils/inferScaleType.js
function inferScaleType(scale) {
  var _a;
  if ("paddingInner" in scale) {
    return "band";
  }
  if ("padding" in scale) {
    return "point";
  }
  if ("quantiles" in scale) {
    return "quantile";
  }
  if ("base" in scale) {
    return "log";
  }
  if ("exponent" in scale) {
    return scale.exponent() === 0.5 ? "sqrt" : "pow";
  }
  if ("constant" in scale) {
    return "symlog";
  }
  if ("clamp" in scale) {
    if (!("interpolate" in scale)) {
      return "radial";
    }
    const ticks = (_a = scale.ticks) == null ? void 0 : _a.call(scale);
    if ((ticks == null ? void 0 : ticks[0]) instanceof Date) {
      return isUtcScale(scale) ? "utc" : "time";
    }
    return "linear";
  }
  if ("nice" in scale) {
    return "quantize";
  }
  if ("invertExtent" in scale) {
    return "threshold";
  }
  return "ordinal";
}

// node_modules/@visx/scale/esm/utils/coerceNumber.js
function coerceNumber(val) {
  if ((typeof val === "function" || typeof val === "object" && !!val) && "valueOf" in val) {
    const num = val.valueOf();
    if (typeof num === "number") return num;
  }
  return val;
}

// node_modules/@visx/scale/esm/utils/getTicks.js
function getTicks(scale, numTicks) {
  const s = scale;
  if ("ticks" in s) {
    return s.ticks(numTicks);
  }
  return s.domain().filter((_, index, arr) => numTicks == null || arr.length <= numTicks || index % Math.round((arr.length - 1) / numTicks) === 0);
}

// node_modules/@visx/scale/esm/utils/toString.js
function toString(x) {
  return x == null ? void 0 : x.toString();
}

// node_modules/@visx/scale/esm/utils/scaleCanBeZeroed.js
var zeroableScaleTypes = /* @__PURE__ */ new Set(["linear", "pow", "quantize", "sqrt", "symlog"]);
function scaleCanBeZeroed(scaleConfig) {
  return zeroableScaleTypes.has(scaleConfig.type);
}

export {
  createBandScale,
  createPointScale,
  createLinearScale,
  createRadialScale,
  createTimeScale,
  createUtcScale,
  createLogScale,
  createPowScale,
  createOrdinalScale,
  createQuantizeScale,
  createQuantileScale,
  createSymlogScale,
  createThresholdScale,
  createSqrtScale,
  createScale_default,
  updateScale_default,
  inferScaleType,
  coerceNumber,
  getTicks,
  toString,
  scaleCanBeZeroed
};
//# sourceMappingURL=chunk-VEXWFR7E.js.map
