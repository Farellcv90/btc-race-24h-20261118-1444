# Dip-and-Turn BTC Bot

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/Farellcv90/btc-race-24h-20261118-1444/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/Farellcv90/btc-race-24h-20261118-1444/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A trading bot for the make.fun competition **btc-race-24h-20261118-1444** — race a BTC trading bot live for 24 hours. It trades Coinbase Wrapped BTC (CBBTC) against USDC, one minute bar at a time, starting from 1,000 USDC of paper money.

## Strategy

The dev window falls 2.8% from first close to last, so buying and holding loses money. This bot does the opposite of holding: it sits in cash and only buys a real bounce.

- **Entry:** buy the whole stake when the close is at least 0.8% below the 120-bar EMA (a deep dip) **and** above the 10-bar EMA (the short-term trend has turned back up). The order is decided on one bar's close and fills at the next bar's open.
- **Exit:** sell the whole position when it is worth 2% over its cost, or 1% under it, or after 360 bars held — whichever comes first.
- **Discipline:** one position at a time, long only, at most one order per bar, and every fill is capped at 1% slippage past the close the order was decided on.

Everything is deterministic integer arithmetic (bigints, no floats, no clock, no randomness), so two runs on the same bars produce identical orders.

## Run it

Grade it locally against the competition kit (needs Node 22):

```sh
node cli/makefun.mjs grade-local --kit <kit-dir> --bot . --driver process
```

The bot itself is `main.ts` (Node 22, erasable TypeScript only); it speaks the `agent-fun/bars-replay/v1` protocol through the vendored shim in `vendor/makefun-bars.ts`.

<sub>Entered on [make.fun](https://make.fun/?ref=bbbzard3&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
