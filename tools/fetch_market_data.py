"""Fetches NSE and BSE prices for the Markets page.

Current prices and history come from the open-source yfinance library (Yahoo
Finance data). The Nifty 500 list and previous closes come from NSE's and BSE's
official public files. GitHub Actions runs this on a schedule; see
.github/workflows/market-data.yml. To run it yourself:
    pip install yfinance
    python tools/fetch_market_data.py          # prices, stock list and history
    python tools/fetch_market_data.py quotes   # prices only

Writes data/market/symbols.json, quotes.json and history/<symbol>.json.
"""
import csv
import io
import json
import math
import re
import sys
import time
import urllib.request
import warnings
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

warnings.filterwarnings("ignore")
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "market"
NIFTY500 = "https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv"
BSE_BHAV = "https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_{}_F_0000.CSV"
NSE_BHAV = "https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{}_F_0000.csv.zip"
INDICES = {"NIFTY 50": "^NSEI", "SENSEX": "^BSESN", "NIFTY BANK": "^NSEBANK"}
CHUNK = 100


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8", newline="\n")


def file_key(symbol):
    """Same rule as fileKey() in assets/markets.js: M&M becomes M_M."""
    return re.sub(r"[^A-Za-z0-9]", "_", symbol)


def nums(values, digits=2):
    return [None if v is None or math.isnan(v) else round(float(v), digits) for v in values]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=30).read()


def read_bhavcopy(url):
    """One exchange's official end-of-day file, as CSV rows. None if not published."""
    try:
        raw = get(url)
    except Exception:
        return None
    if url.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            raw = z.read(z.namelist()[0])
    return list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))


def official_closes(before):
    """Latest official close before the date `before`, by exchange and ISIN, plus BSE codes."""
    closes, codes = {"NSE": {}, "BSE": {}}, {}
    for ex, template in (("NSE", NSE_BHAV), ("BSE", BSE_BHAV)):
        for back in range(1, 11):
            day = before - timedelta(days=back)
            rows = read_bhavcopy(template.format(day.strftime("%Y%m%d"))) if day.weekday() < 5 else None
            if rows:
                for r in rows:
                    # A share can have several NSE series; EQ is the normal one
                    if ex == "BSE" or r["SctySrs"].strip() == "EQ" or r["ISIN"] not in closes[ex]:
                        closes[ex][r["ISIN"]] = float(r["ClsPric"])
                    if ex == "BSE":
                        codes[r["ISIN"]] = r["FinInstrmId"].strip()
                print(f"{ex} official closes from {day}")
                break
        else:
            print(f"No official {ex} file found; using other sources")
    return closes, codes


def load_symbols():
    """NSE's official list; the last saved copy is used if NSE can't be reached."""
    path = OUT / "symbols.json"
    try:
        text = get(NIFTY500).decode("utf-8-sig")
        rows = [[r["Symbol"].strip(), r["Company Name"].strip(), r["Industry"].strip(), r["ISIN Code"].strip(), ""]
                for r in csv.DictReader(io.StringIO(text)) if r.get("Symbol")]
        if len(rows) < 400:
            raise ValueError(f"only {len(rows)} symbols")
        return rows
    except Exception as err:
        if not path.exists():
            raise SystemExit(f"Could not get the NSE stock list: {err}")
        print(f"Using the saved stock list ({err})")
        return json.loads(path.read_text(encoding="utf-8"))


def download(tickers, **kw):
    """Yields (ticker, table) in small batches so Yahoo isn't hit all at once."""
    for i in range(0, len(tickers), CHUNK):
        part = tickers[i:i + CHUNK]
        for attempt in range(3):
            try:
                data = yf.download(part, group_by="ticker", auto_adjust=False, progress=False, threads=True, **kw)
                break
            except Exception as err:
                print(f"Retrying batch {i}: {err}")
                time.sleep(5 * (attempt + 1))
        else:
            continue
        for t in part:
            if t in data.columns.get_level_values(0):
                table = data[t].dropna(subset=["Close"])
                if len(table):
                    yield t, table
        time.sleep(1)


def quote_row(table):
    """[price, previous close, open, high, low, volume, date]"""
    last, prev = table.iloc[-1], table.iloc[-2] if len(table) > 1 else table.iloc[-1]
    return [*nums([last["Close"], prev["Close"], last["Open"], last["High"], last["Low"]]),
            0 if math.isnan(last["Volume"]) else int(last["Volume"]), table.index[-1].strftime("%Y-%m-%d")]


def fetch_quotes(rows):
    symbols = [r[0] for r in rows]
    tickers = [s + ".NS" for s in symbols] + [s + ".BO" for s in symbols] + list(INDICES.values())
    names = {v: k for k, v in INDICES.items()}
    out = {"idx": {}, "NSE": {}, "BSE": {}}
    for t, table in download(tickers, period="5d", interval="1d"):
        if t in names:
            out["idx"][names[t]] = quote_row(table)
        else:
            out["NSE" if t.endswith(".NS") else "BSE"][t[:-3]] = quote_row(table)
    if len(out["NSE"]) < len(symbols) / 2:
        raise SystemExit(f"Only {len(out['NSE'])} of {len(symbols)} NSE prices arrived; keeping the last good file.")

    # Yahoo's BSE daily bars have gaps, so its previous close can be wrong. Prefer the
    # exchanges' official figure; BSE shows no change at all rather than a wrong one.
    today = max(r[6] for r in out["NSE"].values())
    closes, codes = official_closes(date.fromisoformat(today))
    isin = {r[0]: r[3] for r in rows}
    for ex in ("NSE", "BSE"):
        for sym, row in out[ex].items():
            official = closes[ex].get(isin[sym])
            if official is not None:
                row[1] = official
            elif ex == "BSE":
                row[1] = None
    for r in rows:
        r[4] = codes.get(r[3], r[4])
    save(OUT / "symbols.json", rows)

    path = OUT / "quotes.json"
    old = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    # An unchanged file means no commit, so holidays don't add noise to the repository
    if {k: old.get(k) for k in out} != out:
        out["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        save(path, out)
    print(f"Quotes: {len(out['NSE'])} NSE, {len(out['BSE'])} BSE, {len(out['idx'])} indices")


def fetch_history(symbols):
    names = {s + ".NS": file_key(s) for s in symbols}
    names.update({v: "IDX_" + file_key(k) for k, v in INDICES.items()})
    count = 0
    for t, table in download(list(names), period="5y", interval="1d"):
        save(OUT / "history" / f"{names[t]}.json", {
            "t": [int(d.timestamp()) for d in table.index],
            "o": nums(table["Open"]), "h": nums(table["High"]), "l": nums(table["Low"]), "c": nums(table["Close"]),
            "v": [0 if math.isnan(v) else int(v) for v in table["Volume"]]})
        count += 1
    print(f"History: {count} files")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    rows = load_symbols()
    fetch_quotes(rows)
    if mode == "all":
        fetch_history([r[0] for r in rows])


if __name__ == "__main__":
    main()
