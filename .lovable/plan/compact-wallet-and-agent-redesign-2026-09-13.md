# Compact Wallet and Agent Redesign

## Goal
Make the app quieter and easier to scan, with Wallet as the final tab.

## Changes
- Reduce each page header to one title.
- Remove “Live market data” and the CoinGecko/APY disclosure sentence from Stake.
- Reorder the bottom tabs to Stake, AI Trade, Wallet.
- Rebuild Wallet around the connected wallet’s real TON balance, Deposit and Withdraw actions, and the available assets with current prices.
- Remove staking positions, projected rewards, counters, and the trading link from Wallet.
- Simplify AI Trading to one clear status/balance area, a compact activation flow, confirmed activity, and short expandable questions.
- Keep all visible app copy in English, with no emoji and minimal icons.

## Technical details
- Read the connected wallet balance directly from TON through a server function.
- Use the existing live market feed for displayed asset prices.
- Deposit sends TON to the existing EGRAM treasury address through TON Connect.
- Withdraw opens the connected wallet flow; the app will not claim to custody or release funds it cannot authorize.
- Preserve confirmed-only trade reporting and existing activation verification.

## Verification
- Check Stake, AI Trade, and Wallet at 434×716.
- Confirm Deposit, Withdraw, Connect, tab order, and empty/loading states render cleanly.
- Confirm the latest build finishes successfully.