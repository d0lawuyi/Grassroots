# Grassroots Python tools

Three command-line tools that work alongside the app. The phone app stays in JavaScript.
These run on your computer (and later on a schedule) and talk to the same Supabase database.

| Command | What it does | Changes data? |
|---|---|---|
| `parks-import` | Finds public soccer, basketball, flag football, track and ultimate fields in a city on OpenStreetMap and adds them as unverified venues | Only with `--commit` |
| `precheck` | Checks every venue submission waiting for review and saves findings the admin screen shows | Writes `venue_prechecks` only |
| `sideline` | Builds this week's issue of The Sideline newsletter as a preview file | No |

They use only Python's standard library, so there is nothing to `pip install`.

---

## One-time setup

**1. Install Python 3.11 or newer.** Check with:

```
python --version
```

If Windows opens the Microsoft Store instead, install Python from python.org and tick
**"Add python.exe to PATH"** on the first screen of the installer.

**2. Run the database update.** In Supabase, open **SQL Editor**, then **New query**,
paste in all of `supabase/migrations/003_python_tools.sql` and press **Run**. It adds:

- `venue_prechecks`: where the pre-check saves its findings (only admins can read it)
- `users.sideline_feature`: the "Feature me in The Sideline" switch on the Profile screen (off for everyone)

**3. Give the tools a key.** In this `services/python` folder, copy `.env.example` to a new
file called `.env` and fill in both lines:

- `SUPABASE_URL`: Supabase > Project Settings > Data API > Project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase > Project Settings > API Keys > the **secret** key

> The secret key can read and change everything, skipping all security rules.
> It goes only in `services/python/.env`, never in the app's `.env` and never on GitHub.
> `.gitignore` already keeps this file out of git.

**4. Run the tests** to check everything works on your computer:

```
cd services\python
python -m unittest discover -s tests -t .
```

You should see `OK` at the end.

---

## Using the tools

Run every command from the `services\python` folder.

### Admin pre-check

```
python -m grassroots_tools precheck
```

For each submission waiting for review, it runs the same four checks you do by hand:

| Check | What the tool looks at |
|---|---|
| Ownership | Was a proof document uploaded? |
| Location | Does the pin match the typed address? Is another venue already on that spot, or one with almost the same name nearby? |
| Pricing | Is a paid venue missing its rate? Is the rate far above what similar venues charge? |
| Legitimacy | How many photos? Any sports picked? Phone numbers, emails or links in the name or rules? |

Each finding is **flag** (probably wrong), **warn** (worth a look) or **ok**. The score starts at
100 and drops 25 per flag and 8 per warning. Open **Profile > Review venues** in the app and the
findings appear under each check. The tool never approves or rejects anything: you still decide.

It skips submissions it already checked, unless the owner resubmitted. Options:
`--recheck` runs all of them again; `--no-geocode` skips the address lookup.

### Import public fields

Always do a dry run first:

```
python -m grassroots_tools parks-import --city "Indianapolis" --state IN
```

This writes a spreadsheet to `out\parks-import-indianapolis-<date>.csv` listing what it would
**add** and what it would **skip** (and why). Open it in Excel, and if it looks right:

```
python -m grassroots_tools parks-import --city "Indianapolis" --state IN --commit
```

Add `--limit 10` to start small. Imported fields show as "Not yet verified" in Explore.

### The Sideline

```
python -m grassroots_tools sideline
```

Writes `out\sideline-<date>.html` (double-click to preview it in your browser) and a `.txt`
version. Player of the week only ever picks people who turned on **Feature me in The Sideline**
in their profile, and shows first name and last initial only.

---

## How the code is organized

```
services/python/
  grassroots_tools/
    __main__.py       the command line: reads your options and calls the right tool
    config.py         finds SUPABASE_URL and the key
    web.py            sends HTTP requests (urllib) with retries
    supabase_rest.py  reads and writes tables through Supabase's REST API
    geo.py            distances between map points, name matching, address lookup
    parks_import.py   the OpenStreetMap import
    precheck.py       the four checks
    sideline.py       the newsletter
  tests/              37 tests, no internet or database needed
  out/                previews land here (ignored by git)
```

A pattern to notice: each tool splits **deciding** from **doing**. `evaluate()` in precheck,
`group_into_venues()` in the import and `build_digest()` in the newsletter take plain data and
return a result, with no network or database. That's what makes them easy to test: the tests
hand them made-up rows and check the answer. The `run()` function in each file does the
fetching and saving around them.

## Good first exercises

1. Change `PRICE_FLAG_X` in `precheck.py` from 4.0 to 7.0 and run the tests. One fails: which, and why? (Hint: $300 is 6x the typical $50.) Put it back after.
2. Add a check to `check_legitimacy` that warns when `availability` is empty. Write a test for it first.
3. Add "volleyball" to `SPORT_MAP` in `parks_import.py` (the app would need a volleyball chip too).

## Data credit

Field locations from OpenStreetMap, (c) OpenStreetMap contributors, under the Open Database
License. Address lookups use OpenStreetMap's Nominatim service, limited to one request per second.

---

## Running on a schedule (GitHub Actions)

`.github/workflows/scheduled.yml` runs the tools for you on GitHub's computers:

| Tool | When |
|---|---|
| `precheck` | Every hour, at 7 minutes past |
| `sideline` | Mondays at 9:03 AM Indianapolis time (8:03 in winter). The preview is saved with the run: open it under **Actions** and download **the-sideline** from Artifacts. |

To turn them on, add two repository secrets in GitHub: **Settings > Secrets and variables >
Actions > New repository secret**, one called `SUPABASE_URL` and one called
`SUPABASE_SERVICE_ROLE_KEY`, with the same values as your `.env`. Until then the jobs skip
themselves instead of failing.

To run one right away: **Actions > Scheduled tools > Run workflow**, then pick the tool.

GitHub pauses scheduled jobs in a repository that has had no commits for 60 days; a push
or a click on **Enable workflow** starts them again.
