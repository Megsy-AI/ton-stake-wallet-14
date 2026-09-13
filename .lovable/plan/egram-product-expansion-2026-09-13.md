# EGRAM Product Expansion

## Goal
Turn the current two-screen interface into a cleaner three-screen Telegram mini app with asset-specific staking, a focused wallet, and a dedicated AI trading experience.

## What will change
- Remove the EGRAM wordmark and Gram image from the top of Stake and Wallet while keeping the connected-wallet action clear.
- Replace “Yield levels” with individual GRAM, USDT, NOT, and DOGS offers. Each offer will show its own increased projected APY, lock period, minimum, live USD price, and 24-hour movement.
- Keep all yields explicitly labeled as projected and use live CoinGecko market data as informational pricing, while confirmed TON-network records remain the source for balances and positions.
- Redesign the partners and community area as a restrained trust strip and a single polished community action.
- Add a separate AI Trading page with agent status, the $500 activation flow, risk selection, confirmed trades, a concise explanation, and expandable common questions.
- Simplify Wallet into a portfolio-style view focused on the connected address, confirmed staking positions, and verified totals, with a clear link to AI Trading.
- Expand the animated iOS-style bottom navigation to Stake, Wallet, and AI Trading.

## Yield model
- Use asset-specific projected yields: GRAM leads, NOT and DOGS carry higher-risk rates, and USDT remains the most conservative.
- Tier increases still apply as the staked amount grows, but each asset has its own rate schedule and lock profile.
- No market price, staking amount, position, or trade will be presented as confirmed unless its source supports that claim.

## Technical details
- Extend the existing server-side CoinGecko integration to return all four supported assets with graceful unavailable states.
- Keep existing TON Connect payment verification, treasury destination, agent wallet, and confirmed-trade behavior unchanged.
- Create the `/trading` route before adding navigation to it, with unique page metadata.
- Reuse the existing semantic design tokens and Button component; keep the interface English-only, icon-light, and emoji-free.
- Validate `/`, `/wallet`, and `/trading` at 434×716 and inspect build/runtime diagnostics.