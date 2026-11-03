# TRAASS · Vedant Pathak: Portfolio

Personal portfolio for Vedant Pathak: Business Analyst, Certified Data Analyst, APCD & fan design expert.

## Files

| File | What it is |
|---|---|
| `index.html` | The website |
| `assets/style.css` | Design |
| `assets/app.js` | All interactive features (dashboard, blog, forms) |
| `markets.html`, `assets/markets.js`, `assets/markets-py.worker.js`, `assets/markets.css` | NSE/BSE prices and the Python Lab. Prices are read from `data/market` by `FEED` in `markets.js` |
| `assets/markets-cache.js` | Checks every price file and saves good copies in the visitor's browser |
| `assets/intro.js` | The 3D logo intro |
| `tools/fetch_market_data.py`, `.github/workflows/market-data.yml` | Fetch prices with the free yfinance library. GitHub runs this about every 10 minutes in market hours and saves the results in `data/market` |
| `blog/posts.js` | **Your blog posts. Edit this to add a daily post** |
| `og-image.png` | Image shown when the link is shared on LinkedIn/WhatsApp |
| `favicon.svg`, `apple-touch-icon.png` | Browser tab and phone home-screen icons (your emblem) |
| `assets/traass-logo-reversed.svg` | Your logo for the dark site (header, footer, 404) |
| `assets/traass-logo.png` | Your full-colour logo, given to Google |
| `assets/vedant-pathak.jpg` | Your photo |
| `sitemap.xml`, `robots.txt` | For Google (SEO) |
| `404.html` | "Page not found" page |

## Put it on GitHub Pages (one time)

1. Open the repository **pathakvedant/vedant-contact** on github.com.
2. Click **Add file → Upload files**. Select everything in this folder and **drag it onto the page**, so the `assets` and `blog` folders are included ("choose your files" can't add folders). Click **Commit changes**.
3. Pages is already switched on for this repository. Wait for the green tick in the **Actions** tab before uploading again.
4. After 1–2 minutes the site is live at `https://pathakvedant.github.io/vedant-contact/`.

## Site address

The address above is already set in `index.html`, `assets/app.js`, `sitemap.xml` and `robots.txt`.

## Turn on the forms (one time)

The contact form, the phone-number form and the newsletter form all email **pathakvedant001@gmail.com** through FormSubmit (free).
1. Once the site is live, fill in the contact form yourself.
2. FormSubmit emails you an **activation link**. Click it.
3. From then on, every lead (name, phone, company, message) arrives in your Gmail.

## Turn on Markets prices (one time)

1. Upload the site, including the `tools` and `data` folders. The small `data` folder gives the page starter prices; GitHub adds the rest. If `.github` doesn't upload, create `.github/workflows/market-data.yml` by hand with **Add file → Create new file**.
2. In the repository, open **Actions → Market data → Run workflow**. The first run takes about 10 minutes.
3. After that it runs by itself on weekdays. If a run shows a red cross, open it to see why; the page keeps showing the last good prices and says they are delayed.

Optional second source: add an IndianAPI key under **Settings → Secrets and variables → Actions** as `INDIANAPI_KEY`. Never put a key in the website files: anyone can read those.

To test on your own computer: `pip install yfinance`, `python tools/fetch_market_data.py`, then `python -m http.server` in this folder and open `http://localhost:8000/markets.html`.

## Add a daily blog post

1. Open `blog/posts.js` on your computer. Copy one `{ ... },` block and paste it at the **top** of the list.
2. Change `slug`, `date`, `cat`, `title`, `excerpt`, `tags` and `body`. Write the title as the question a buyer would ask, and answer it in the excerpt.
3. In this folder, run `python tools/build_site.py`. This makes the post's own page and updates `sitemap.xml`.
4. Upload the changed files to GitHub in one commit.

Share the post's own link, for example `https://pathakvedant.github.io/vedant-contact/blog/your-slug.html`.

## Add your real client conversion numbers

In `assets/app.js`, find `CONVERSION_HISTORY` and fill in your years, leads and converted clients. The 5-year chart then appears in the Marketing & BD section.

## Getting found on Google and AI tools

1. Add the site to **Google Search Console** (search.google.com/search-console), verify it and submit `sitemap.xml`.
2. Add the site URL to your **LinkedIn profile** (Contact info → Website) and to your Featured section.
3. Create a free **Google Business Profile** for **TRAASS** (business.google.com) with this website link.
4. Use the exact same name everywhere: **Vedant Pathak (VP) · TRAASS**, on LinkedIn, Google Business, email signature and visiting card.
5. Publish useful posts regularly and share each one on LinkedIn. Links from other real websites are what move you up.
6. Optional: a custom domain such as `traass.in`, connected in Settings → Pages → Custom domain.

Most realistic searches first: *Vedant Pathak TRAASS*, *TRAASS*, then long questions such as *bag filter high differential pressure*. Plain *Vedant Pathak* is shared with other people, *VP* alone is not realistic, and broad terms like *APCD* or *B2B marketing* take long, steady effort. No one can guarantee a Google position.
