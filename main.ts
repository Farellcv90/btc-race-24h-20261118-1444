// Dip-and-turn BTC bot for btc-race-24h-20261118-1444.
//
// Idea: on a falling day the only money is in catching a real bounce, not in
// holding through the slide. This bot sits in cash, waits until the price has
// fallen well below its slow trend and then turned back up on the fast trend,
// buys the whole stake, and sells on a fixed target, a tight stop, or a time
// limit. One position at a time, one symbol (CBBTC), long only.
//
//   Entry, decided on a bar's close (filled at the next bar's open):
//     close at least 0.8% below the 120-bar EMA  (a deep dip), and
//     close above the 10-bar EMA                (the turn has started).
//   Exit, checked on every later bar's close:
//     the position worth 2% over its cost, or 1% under it, or
//     360 bars held, whichever comes first.
//
// Everything is integer arithmetic: closes are integers at price_scale 5, the
// EMAs are kept as bigints scaled by 1,000,000, and the exit tests compare
// integer value against integer cost. No clock, no randomness, no network, so
// two runs on the same bars give the same orders.

import { runBars, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Slow trend length, in bars. */
const SLOW_BARS = 120;
/** Fast turn length, in bars. */
const FAST_BARS = 10;
/** Micro units per price unit: EMAs are bigints at this scale. */
const MICRO = 1_000_000n;
/** Entry needs the close this far below the slow EMA: 992/1000 = 0.8% under. */
const DIP_NUM = 992n;
const DIP_DEN = 1000n;
/** Sell when the position is worth 102% of its cost. */
const TAKE_NUM = 102n;
/** Sell when the position is worth 99% of its cost. */
const STOP_NUM = 99n;
const EXIT_DEN = 100n;
/** Give up on a trade after this many bars held. */
const MAX_HOLD_BARS = 360;
/** Reject a fill that moved more than 1% past the close we decided on. */
const MAX_SLIPPAGE_BPS = 100;

let slowEma: bigint | null = null;
let fastEma: bigint | null = null;
/** Seq of the batch whose fills opened the current position, -1 when flat. */
let heldSinceSeq = -1;

/** Fold one close into both EMAs, in integer micro units. */
function pushClose(close: bigint): void {
  const micro = close * MICRO;
  if (slowEma === null) slowEma = micro;
  else slowEma += ((micro - slowEma) * 2n) / BigInt(SLOW_BARS + 1);
  if (fastEma === null) fastEma = micro;
  else fastEma += ((micro - fastEma) * 2n) / BigInt(FAST_BARS + 1);
}

/** True when the dip is deep and the fast trend has turned up. */
function entrySignal(close: bigint): boolean {
  if (slowEma === null || fastEma === null) return false;
  const micro = close * MICRO;
  return micro * DIP_DEN < slowEma * DIP_NUM && micro > fastEma;
}

await runBars({
  onBatch(state: BarsState, batch) {
    if (state.warmingUp) return [];
    const bar = batch.bars.find((b) => b.symbol === SYMBOL);
    if (bar === undefined) return [];
    const close = BigInt(bar.c);

    // The fills this batch reports tell us when a buy actually opened.
    for (const fill of batch.fills) {
      if (fill.symbol === SYMBOL && fill.status === 'filled' && fill.side === 'buy') heldSinceSeq = batch.seq;
      if (fill.symbol === SYMBOL && fill.status === 'filled' && fill.side === 'sell') heldSinceSeq = -1;
    }

    pushClose(close);
    const held = state.positions.get(SYMBOL);
    const orders: (BuyInput | SellInput)[] = [];
    const { caps, fees } = state.hello;

    if (held !== undefined) {
      if (heldSinceSeq < 0) heldSinceSeq = state.seq;
      const value = state.value(SYMBOL, held.qty);
      const tookProfit = value * EXIT_DEN >= held.cost * TAKE_NUM;
      const stoppedOut = value * EXIT_DEN <= held.cost * STOP_NUM;
      const timedOut = state.seq - heldSinceSeq >= MAX_HOLD_BARS;
      if (tookProfit || stoppedOut || timedOut) {
        orders.push({ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
      }
      return orders;
    }

    heldSinceSeq = -1;
    if (!entrySignal(close)) return [];
    let stake = state.cash;
    const room = state.weightRoom(SYMBOL);
    if (stake > room) stake = room;
    if (stake < BigInt(fees.min_notional_quote_units)) return [];
    orders.push({ side: 'buy', symbol: SYMBOL, notional_quote_units: stake, max_slippage_bps: MAX_SLIPPAGE_BPS });
    if (orders.length > caps.max_orders_per_bar) return orders.slice(0, caps.max_orders_per_bar);
    return orders;
  },
});
