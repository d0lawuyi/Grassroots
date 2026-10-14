# Grassroots API: calendar feed and balanced teams (C#)

A small web service with two jobs:

1. **Calendar feed.** Each venue owner gets a private calendar link. They add it to Apple
   Calendar, Google Calendar or Outlook once, and every game booked at their venues shows
   up there by itself, with the time, the organizer and how many players have joined.
   Calendar apps check the link for changes about once an hour.
2. **Balanced teams.** The organizer taps **Make teams** on the game page. The service checks
   they really are the organizer, loads the players and their levels, runs the C++ solver
   (`services/teams-solver`) and saves the teams for everyone to see.

```
GET  /feeds/{link}.ics        the owner's games, in iCalendar format
POST /games/{id}/teams        body {"teams": 2}; header Authorization: Bearer <app sign-in token>
GET  /health                  "ok"
```

Built with ASP.NET Core on .NET 10. The only extra package is the one that lets it run in
AWS Lambda.

---

## Run it on your computer

**1. Database update.** In Supabase, open **SQL Editor**, then **New query**, paste all of
`supabase/migrations/004_calendar_feeds.sql` and press **Run**.

**2. Get a test link** for the account that owns your verified venue. In a new SQL Editor
query, put that account's email in both places and run it:

```sql
insert into public.calendar_feeds (owner_id)
select id from auth.users where email = 'you@example.com'
on conflict (owner_id) do nothing;

select token from public.calendar_feeds f
join auth.users u on u.id = f.owner_id
where u.email = 'you@example.com';
```

Copy the 64-character token it shows. In the app this will be a button instead.

**3. The key.** The service reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from
`services/python/.env`, the same file the Python tools use, so there's nothing new to set up.

**4. Start it:**

```
cd services\calendar-feed
dotnet run --project src\CalendarFeed
```

Leave that window open. In your browser, go to `http://localhost:5080/health` (it says `ok`),
then `http://localhost:5080/feeds/YOUR-TOKEN.ics`. That downloads the calendar file.
Double-click it to see the games in your calendar app. Press **Ctrl+C** in the window to stop.

To subscribe from a phone, the service has to be online rather than on your computer.
`infra/calendar-feed/README.md` puts it on AWS Lambda, deployed by GitHub Actions.

**Run the tests:**

```
dotnet test CalendarFeed.slnx
```

They also run on GitHub for every pull request (the "C# calendar feed" check).

---

## How the code is organized

```
services/calendar-feed/
  CalendarFeed.slnx                 the solution: open it in Visual Studio or Rider
  src/CalendarFeed/
    Program.cs                      starts the web server, the two routes, rate limiting
    Ics/IcsWriter.cs                writes iCalendar text: escaping, CRLF, folding long lines
    Feeds/FeedModels.cs             Venue, Game, FeedData, and the IFeedSource interface
    Feeds/FeedBuilder.cs            turns venues and games into a calendar (pure, no network)
    Supabase/SupabaseFeedSource.cs  reads the owner's venues, games, players and organizers
    Config/Settings.cs              finds the Supabase URL and key
  tests/CalendarFeed.Tests/         xUnit tests, no database or internet needed
```

The same split as the Python tools: `FeedBuilder` decides what the calendar says and is easy
to test; `SupabaseFeedSource` fetches the data around it. `IFeedSource` is an interface, so
the real Supabase reader and a fake one in a test are interchangeable.

## Balanced teams: how C# and C++ work together

```
App ──POST /games/{id}/teams──> TeamsService (C#)
                                  1. Supabase Auth: whose sign-in token is this?
                                  2. Supabase: the game's organizer, players, levels
                                  3. balance-teams (C++): CSV in, JSON out
                                  4. Supabase: save game_teams
```

`Teams/ProcessTeamSolver.cs` runs the C++ program as a separate process: it writes the
players to the program's standard input as CSV and reads the teams back as JSON. The two
languages only share text, which keeps them independent. Player ids go in instead of
names, so no personal details leave the service.

To try it locally, build the solver first (`services/teams-solver/README.md`). The service
finds it in `services/teams-solver/build` and logs `Teams solver: …` when it starts. On AWS,
the deploy builds an arm64 copy and ships it next to the service.

The tests use a fake Supabase and a fake solver (`TeamsTests.cs`), so every rule (only the
organizer, enough players, 2 to 4 teams) is checked without a network. One test runs the
real C++ program when it's built.

## Security

- The link is the only key to the feed, so it's 64 random characters, and only its owner can
  read it (row level security in migration 004).
- Anything that isn't 64 hex characters is rejected before the database is touched.
- 60 requests per minute per address, so links can't be guessed by brute force.
- Owners see organizers as first name and last initial, not full names.
- `reset_calendar_feed()` gives an owner a new link if they shared the old one by mistake.

## Good first exercises

1. Add the venue's surface (`grass`, `turf`) to each event's description. Start with a
   failing test in `FeedBuilderTests.cs`.
2. Add a `?sport=soccer` option to the feed URL that only includes games of that sport.
3. Add `CATEGORIES:Soccer` to each event (RFC 5545 section 3.8.1.2) so calendar apps can color by sport.
