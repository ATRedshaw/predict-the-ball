<div align="center">
  <img src="frontend/public/logo.png" alt="PredictTheBall logo" width="120" />

  # PredictTheBall

  **Predict the Premier League table. Compete with your mates. See who really knows ball.**

  [View the live application](https://predict-the-ball.atredshaw.com)
</div>

## About the project

PredictTheBall is a full-stack Premier League prediction game. Before the season begins, players rank all 20 clubs in their expected finishing order. Once the first match kicks off, predictions are locked and scored against the live table throughout the season.

The application also runs its own Elo-based forecasting model, providing a data-driven benchmark alongside the predictions made by players.

This repository is a showcase of the application and its implementation. The live service is managed on a private Oracle Cloud Infrastructure VM. 

## How it works

1. Rank every Premier League club before the first kick-off.
2. Create or join private leagues using an invite code.
3. Follow the live table as scores and rankings update during the season.
4. Compare predictions with friends, the global leaderboard and the forecasting model.

A player's score is the total distance between every predicted position and the club's current position:

```text
score = sum(|predicted position - actual position|)
```

Lower is better. Exact positions are used as the tiebreaker when players have the same score.

## Highlights

- Drag-and-drop table predictions with a season-opening deadline
- Private leagues, invite codes, member leaderboards and league management
- Live Premier League standings and automatically recalculated scores
- Global rankings, season history and head-to-head prediction comparisons
- Elo-powered projections with title odds, relegation risk and full finishing-position distributions
- Historical projection snapshots and model-versus-player comparisons
- Responsive, installable progressive web app
- Account management, password recovery and administrative controls

## Forecasting model

The forecasting pipeline combines historical English league results with current-season data from the Fantasy Premier League API. Its Elo parameters are tuned against held-out seasons and account for home advantage, margin of victory and off-season rating reversion.

For each projection snapshot, the model simulates the remaining season 10,000 times. The resulting distributions are used to estimate each club's mean finishing position and its probability of finishing in every place from 1st to 20th.

## Technology

| Area | Stack |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS, dnd kit |
| Backend | Python, Flask, Gunicorn, SQLAlchemy, Alembic |
| Data and modelling | pandas, NumPy, SciPy, Elo ratings, Monte Carlo simulation |
| Authentication | JWT access and refresh sessions, bcrypt |
| Production | Oracle Cloud Infrastructure, Docker, Nginx, GitHub Actions |
| Data sources | Fantasy Premier League API, football-data.co.uk |

The production frontend is served as a static Vite build through Nginx. The Flask API runs in a Docker container behind the same reverse proxy, with automated deployment from the `main` branch. A separate refresh pipeline generates new table and projection snapshots from the latest results.

## Disclaimer

PredictTheBall is an independent, unofficial project and is not affiliated with or endorsed by the Premier League or Fantasy Premier League. Club and competition names are used for identification purposes only.