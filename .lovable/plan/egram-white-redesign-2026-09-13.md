# EGRAM White Redesign

## Goal
Rebuild both EGRAM screens around the supplied trading-app references while keeping all existing staking, wallet, TON Connect, and verified-data behavior unchanged.

## What will change
- Replace the current generic card stack with a premium white financial interface using one strong graphite balance surface, oversized numbers, and restrained green highlights.
- Restructure Stake so the balance, asset choice, amount, tier, projected return, and primary action are clear within the first mobile viewport.
- Restructure Wallet so confirmed staking, live agent balance, market data, and confirmed trades read as a coherent portfolio view.
- Redesign the two-item bottom dock with thin custom icons, a moving active capsule, spring animation, and safe-area spacing.
- Keep EGRAM branding, real token icons, English copy, no emoji, only two screens, and verified values only.

## Technical details
- Use existing semantic tokens and add the new white, graphite, silver, and financial-green roles in the global design system.
- Use the existing Motion library for restrained entry and navigation transitions with reduced-motion support.
- Preserve all current server calls, payment verification, TON Connect transactions, and database behavior.
- Validate both `/` and `/wallet` at 434×716 and check the latest build diagnostics.