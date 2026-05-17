import type { RichValue, View } from "@core";

/**
 * Quantity — a physical quantity with a numeric value and unit string.
 * Supports arithmetic and unit conversion.
 *
 * Example:
 *   quantity(10, "km").div(quantity(45, "min"))  // 13.333 km/h
 */
export class Quantity implements RichValue {
  readonly type = "Quantity";

  constructor(
    private readonly _value: number,
    private readonly _unit: string
  ) {}

  get value(): number {
    return this._value;
  }

  get unit(): string {
    return this._unit;
  }

  // ── RichValue protocol ──────────────────────────────

  summary(): string {
    return `${formatNumber(this._value)} ${this._unit}`;
  }

  views(): View[] {
    return [
      { viewType: "text", label: "Value", data: this.summary() },
      { viewType: "unit-info", label: "Unit Info", data: this.getUnitInfo() },
    ];
  }

  explain(): string {
    return `A quantity of ${formatNumber(this._value)} ${this._unit}.`;
  }

  toJSON(): unknown {
    return { value: this._value, unit: this._unit };
  }

  inputForm(): string {
    return `quantity(${this._value}, "${this._unit}")`;
  }

  // ── Arithmetic ──────────────────────────────────────

  /** Add another quantity (same unit required, or compatible) */
  add(other: Quantity): Quantity {
    const converted = other.to(this._unit);
    return new Quantity(this._value + converted.value, this._unit);
  }

  /** Subtract another quantity */
  sub(other: Quantity): Quantity {
    const converted = other.to(this._unit);
    return new Quantity(this._value - converted.value, this._unit);
  }

  /** Multiply by a number or another quantity */
  mul(other: Quantity | number): Quantity {
    if (typeof other === "number") {
      return new Quantity(this._value * other, this._unit);
    }
    // Multiply values and concatenate units
    const newUnit = combineUnits(this._unit, other.unit, "mul");
    return new Quantity(this._value * other.value, newUnit);
  }

  /** Divide by a number or another quantity */
  div(other: Quantity | number): Quantity {
    if (typeof other === "number") {
      return new Quantity(this._value / other, this._unit);
    }
    const newUnit = combineUnits(this._unit, other.unit, "div");
    return new Quantity(this._value / other.value, newUnit);
  }

  /** Convert to a target unit */
  to(targetUnit: string): Quantity {
    const factor = getConversionFactor(this._unit, targetUnit);
    if (factor === null) {
      throw new Error(`Cannot convert from ${this._unit} to ${targetUnit}`);
    }
    return new Quantity(this._value * factor, targetUnit);
  }

  // ── Unit info ──────────────────────────────────────

  private getUnitInfo(): object {
    const info = UNIT_INFO[this._unit];
    return {
      unit: this._unit,
      value: this._value,
      baseUnit: info?.base ?? this._unit,
      dimension: info?.dimension ?? "unknown",
      siPrefix: info?.prefix ?? null,
    };
  }
}

// ── Factory ──────────────────────────────────────────

/** Create a Quantity */
export function quantity(value: number, unit: string): Quantity {
  return new Quantity(value, unit);
}

// ── Unit conversion table ────────────────────────────

/**
 * Conversion factors to SI base units.
 * All factors convert TO the SI base unit.
 * E.g., km -> m: factor = 1000 (1 km = 1000 m)
 */
const CONVERSIONS: Record<string, { base: string; factor: number; dimension: string; prefix?: string }> = {
  // Length (SI base: m)
  "m":    { base: "m", factor: 1, dimension: "length" },
  "km":   { base: "m", factor: 1000, dimension: "length", prefix: "k" },
  "cm":   { base: "m", factor: 0.01, dimension: "length", prefix: "c" },
  "mm":   { base: "m", factor: 0.001, dimension: "length", prefix: "m" },
  "mi":   { base: "m", factor: 1609.344, dimension: "length" },
  "ft":   { base: "m", factor: 0.3048, dimension: "length" },
  "in":   { base: "m", factor: 0.0254, dimension: "length" },
  "yd":   { base: "m", factor: 0.9144, dimension: "length" },

  // Mass (SI base: kg)
  "kg":   { base: "kg", factor: 1, dimension: "mass" },
  "g":    { base: "kg", factor: 0.001, dimension: "mass" },
  "mg":   { base: "kg", factor: 0.000001, dimension: "mass" },
  "lb":   { base: "kg", factor: 0.453592, dimension: "mass" },
  "oz":   { base: "kg", factor: 0.0283495, dimension: "mass" },

  // Time (SI base: s)
  "s":    { base: "s", factor: 1, dimension: "time" },
  "ms":   { base: "s", factor: 0.001, dimension: "time" },
  "min":  { base: "s", factor: 60, dimension: "time" },
  "h":    { base: "s", factor: 3600, dimension: "time" },
  "hr":   { base: "s", factor: 3600, dimension: "time" },

  // Volume
  "l":    { base: "l", factor: 1, dimension: "volume" },
  "ml":   { base: "l", factor: 0.001, dimension: "volume" },
  "cup":  { base: "l", factor: 0.236588, dimension: "volume" },
  "gal":  { base: "l", factor: 3.78541, dimension: "volume" },

  // Temperature — special case, skip for now
};

/** Derived/compound units */
const DERIVED_CONVERSIONS: Record<string, { baseLeft: string; baseRight: string; dimension: string }> = {
  "km/h": { baseLeft: "m", baseRight: "s", dimension: "speed" },
  "m/s":  { baseLeft: "m", baseRight: "s", dimension: "speed" },
  "mph":  { baseLeft: "mi", baseRight: "h", dimension: "speed" },
};

const UNIT_INFO: Record<string, { base: string; dimension: string; prefix?: string }> = {};
for (const [unit, info] of Object.entries(CONVERSIONS)) {
  UNIT_INFO[unit] = { base: info.base, dimension: info.dimension, prefix: info.prefix };
}

/**
 * Get the conversion factor from one unit to another.
 * Returns null if conversion is not possible.
 */
function getConversionFactor(from: string, to: string): number | null {
  if (from === to) return 1;

  // Direct conversion
  const fromInfo = CONVERSIONS[from];
  const toInfo = CONVERSIONS[to];

  if (fromInfo && toInfo && fromInfo.dimension === toInfo.dimension) {
    // Convert: from -> base -> to
    return fromInfo.factor / toInfo.factor;
  }

  // Derived unit conversion (e.g., km/h -> mph)
  const fromDerived = DERIVED_CONVERSIONS[from];
  const toDerived = DERIVED_CONVERSIONS[to];

  if (fromDerived && toDerived && fromDerived.dimension === toDerived.dimension) {
    // For speed: km/h -> m/s -> mph
    // This requires decomposing and recombining
    // Simplified: just handle common speed conversions
    if (from === "km/h" && to === "mph") return 0.621371;
    if (from === "mph" && to === "km/h") return 1.60934;
    if (from === "km/h" && to === "m/s") return 1 / 3.6;
    if (from === "m/s" && to === "km/h") return 3.6;
  }

  return null;
}

/**
 * Combine two unit strings for multiplication or division.
 */
function combineUnits(left: string, right: string, op: "mul" | "div"): string {
  if (op === "div") {
    // Check for known derived units
    if (left === "km" && right === "h") return "km/h";
    if (left === "m" && right === "s") return "m/s";
    if (left === "mi" && right === "h") return "mph";
    if (left === "km" && right === "min") return "km/h";
    return `${left}/${right}`;
  }
  return `${left}·${right}`;
}

// ── Helpers ──────────────────────────────────────────

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  // Show up to 4 decimal places, trim trailing zeros
  return n.toFixed(4).replace(/\.?0+$/, "");
}
