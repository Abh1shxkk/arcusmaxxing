# Arcus Fee Tracker

Track what trading on [Arcus](https://arcus.xyz) mainnet really costs you — volume, fees, funding and profit,
day by day and week by week — and whether farming points is worth it.

Built by [Abhishek Chauhan](https://portfolio-frontend-sigma-jade.vercel.app/) ·
[X](https://x.com/abh1shxkk) · [LinkedIn](https://www.linkedin.com/in/abhishek-chauhan-880496394) ·
[GitHub](https://github.com/abh1shxkk). Not affiliated with Arcus.

## What's inside

| Page | What it does |
|---|---|
| **Overview** | Any wallet's volume, fees, fee rate and tier; volume & fee charts; profit after fees and funding; maker/taker split; fees by market; when you trade; trade sizes; CSV export |
| **Points** | Log the points Arcus gives you each week, learn your points rate, predict future points and decide if farming pays. Optional signed sync and an anonymous community cost-per-point |
| **Farm** | Airdrop-farming checklist (invite codes, tier, consistency, breadth, maker share, ranks), true cost of farming, capital turnover, funding and transfer history, milestone alerts |
| **Card** | Graffiti trader card — your sea creature, style, stickers and degen score. Download or share to X with a generated preview image |
| **Compare** | Up to four wallets side by side |
| **Markets** | Live markets, 24h movers, volume share and a funding-rate scanner |
| **Leaderboard** | Top 100 traders by fees, volume or profit |
| **Calculators** | Fee tiers, a fee calculator and a liquidation-price calculator |

All trading data comes from the public Arcus API (`https://api.arcus.xyz`) — no API key and no wallet
connection needed. Subaccounts (0–9) are detected automatically.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (Vitest)
npm run lint
npm run build      # production build — stop `npm run dev` first; they share the .next folder
```

Requires Node.js 20+.

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. Go to [vercel.com/new](https://vercel.com/new), import the repository and click **Deploy**.
   Vercel detects Next.js; no settings need changing.
3. *(Optional, for points sync and the community average)* In the Vercel project open
   **Storage → Create → Upstash for Redis** (free tier is plenty) and connect it to the project.
   Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically. Redeploy.

Without step 3 everything works except syncing points across devices; points stay in each browser and the
Points page says sync isn't set up.

Share links look like `https://your-domain/u/0x…` and render a preview image of that wallet's trader card on X,
Telegram, Discord and anywhere else that reads Open Graph tags.

## Environment variables

See [`.env.example`](.env.example). Both are optional.

| Variable | Used for |
|---|---|
| `UPSTASH_REDIS_REST_URL` / `KV_REST_API_URL` | Points sync & community average |
| `UPSTASH_REDIS_REST_TOKEN` / `KV_REST_API_TOKEN` | Same |

## How the numbers work

- **Fees, volume, maker/taker:** summed from the wallet's fills (`GET /v1/fills`). 30-day and lifetime totals
  come from `GET /v1/account/stats`. Busy wallets are capped at the 100,000 most recent fills; the UI says so.
- **Profit after costs:** each fill's `closedPnl` (realised, already net of that fill's fee) plus funding
  payments (`GET /v1/funding`). Open positions aren't counted until they close.
- **Points:** Arcus has no public points API. You enter weekly points; the model fits points ≈ k × fees and
  points ≈ k × volume on complete weeks and uses whichever fits better.
- **Points sync:** saving requires a free `personal_sign` signature from the wallet over a hash of the data and
  a timestamp, verified server-side, so nobody can write points for a wallet they don't control. The community
  view shows medians only, and only for weeks with at least 3 contributing wallets.
- **Liquidation price:** isolated-margin estimate from each market's maintenance-margin fraction.
- **Caching:** fills are cached in the browser (IndexedDB); a return visit only downloads new fills.

Arcus has not published airdrop criteria. The Farm page is a guide, not a guarantee.
