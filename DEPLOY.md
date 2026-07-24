# Putting RefluxCare online (free, on Render)

This guide takes your app from your computer to a private link you can open on
your phone anywhere. It is written for a first-time deploy — follow it top to
bottom.

**Before you start, you need:**

- A **GitHub** account (free) — https://github.com
- A **Render** account (free) — sign up with your GitHub at https://render.com

Your private medical photos (`*.jpeg`) are **not** uploaded — `.gitignore`
keeps them on your computer only.

---

## Step 1 — Put your code on GitHub

1. On GitHub, click **New repository**.
   - Name it e.g. `refluxcare`
   - Choose **Private** (recommended — it is your health app)
   - Do **not** add a README or .gitignore (you already have them)
   - Click **Create repository**

2. GitHub now shows a page with a URL like
   `https://github.com/YOUR-NAME/refluxcare.git`. Copy it.

3. In a terminal, from this project folder, run these commands. Replace the URL
   in the last line with the one you copied:

   ```bash
   git add .
   git commit -m "RefluxCare: water tracking, insights, passcode lock, deploy setup"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/refluxcare.git
   git push -u origin main
   ```

   (The repository was already initialized for you with the first commit — if
   `git add`/`git commit` say "nothing to commit", just run the last three
   lines.)

---

## Step 2 — Deploy on Render (one click, via the blueprint)

1. Go to the Render dashboard → **New +** → **Blueprint**.
2. **Connect** your GitHub and pick the `refluxcare` repository.
3. Render reads the included `render.yaml` and shows two things to create:
   - a **web service** named `refluxcare`
   - a **PostgreSQL** database named `refluxcare-db`
4. It will ask you to set **`APP_PASSCODE`**. This is your private unlock code —
   **choose something only you know** (for example a long word + numbers). You
   will type this the first time you open the app on each device.
5. Click **Apply** / **Create**. Render builds the image (first build takes a
   few minutes) and connects the database automatically.

When it finishes, Render gives you a link like:

```
https://refluxcare.onrender.com
```

That link is your app. 🎉

---

## Step 3 — Open it on your phone

1. On your phone, open the Render link in the browser.
2. Enter your **passcode** (the `APP_PASSCODE` you set). It is remembered on
   that device, so you only type it once.
3. **Add it to your home screen** so it opens like a real app:
   - **iPhone (Safari):** Share button → **Add to Home Screen**
   - **Android (Chrome):** menu (⋮) → **Add to Home screen**
4. Tap the new **RefluxCare** icon any time. Log burps, water, meals, and
   symptoms — from anywhere, on any network.

---

## Good to know

- **Free service "sleeps":** after ~15 minutes of no use, the free Render
  service pauses. The next time you open it, the first load is slow (about
  30–60 seconds) while it wakes up, then it is fast again. This is normal on the
  free plan. (Upgrading removes the sleep.)
- **Free database expires:** Render's free PostgreSQL is removed about **90
  days** after you create it. Before that, either upgrade the database or export
  your data so nothing is lost. Ask me and I will add an export button.
- **Updating the app:** whenever you (or I) change the code, run
  `git add . && git commit -m "update" && git push`. Render redeploys
  automatically.
- **Your passcode is the only lock.** Keep it private. To change it later, edit
  `APP_PASSCODE` in the Render dashboard → the service redeploys with the new
  code.

---

## Local development still works the same

Nothing here changes how you run it on your computer:

```bash
docker compose up          # database + API on http://localhost:8000
cd web && npm run dev       # website on http://localhost:5173
```

Locally there is **no passcode** (the lock only turns on when `APP_PASSCODE` is
set, which happens on Render).
