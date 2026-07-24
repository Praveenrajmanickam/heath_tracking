# RefluxCare

Mobile-first personal GERD lifestyle and symptom tracker.

## Current milestone

The first vertical slice stores timestamped daily events in PostgreSQL and
provides a phone-friendly Today screen with:

- One-tap burp counting
- Meal, activity, symptom, medicine, and note logging
- Today's burp total
- A chronological daily timeline

See [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) for the product boundary.

## Run locally

1. Create the environment file:

   ```bash
   cp .env.example .env
   ```

2. Start PostgreSQL and the API:

   ```bash
   docker compose up --build
   ```

3. In another terminal, install and start the web app:

   ```bash
   cd web
   npm install
   npm run dev
   ```

4. Open `http://localhost:5173`.

The API documentation is available at `http://localhost:8000/docs`.

## Storage model

Daily data is stored in the PostgreSQL `daily_events` table. `occurred_at`
records when the event happened; `entered_at` records when it was submitted.
The flexible `details` JSON object holds type-specific fields while the product
model is evolving.

The PostgreSQL Docker volume is named `refluxcare_postgres`. Stopping the
containers does not erase it. Do not run `docker compose down --volumes` unless
you intentionally want to remove local health data.
