// Isolated-margin liquidation estimate. A position is liquidated when its equity falls to the
// maintenance requirement (maintenance fraction × notional at mark), per the Arcus margin docs.
//   long:  M + q(P − E) = mmf·q·P  →  P = E(1 − 1/L) / (1 − mmf)
//   short: M + q(E − P) = mmf·q·P  →  P = E(1 + 1/L) / (1 + mmf)
// where M = margin posted = notional / L and q = notional / E.

export interface LiquidationInput {
  side: "long" | "short";
  entry: number;
  leverage: number;
  notional: number;
  maintenanceFraction: number;
}

export interface LiquidationResult {
  price: number;
  distance: number; // fraction of entry price, always positive
  margin: number;
  maintenanceAtEntry: number;
}

export function liquidationPrice({ side, entry, leverage, notional, maintenanceFraction: mmf }: LiquidationInput): LiquidationResult {
  const price = side === "long" ? (entry * (1 - 1 / leverage)) / (1 - mmf) : (entry * (1 + 1 / leverage)) / (1 + mmf);
  return {
    price: Math.max(0, price),
    distance: Math.abs(price - entry) / entry,
    margin: notional / leverage,
    maintenanceAtEntry: notional * mmf,
  };
}
