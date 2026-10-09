using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.RegularExpressions;
using CalendarFeed.Feeds;

namespace CalendarFeed.Supabase;

/// <summary>
/// Reads one owner's venues and games from Supabase's REST API (PostgREST), the same
/// way the Python tools do. Uses the secret key, so it can read across all tables;
/// the private feed link is what decides whose data comes back.
/// </summary>
internal sealed partial class SupabaseFeedSource(HttpClient http, ILogger<SupabaseFeedSource> log) : IFeedSource
{
    // Show games from the last 30 days and everything ahead.
    private static readonly TimeSpan History = TimeSpan.FromDays(30);

    /// <summary>Links are 64 hex characters. Anything else is rejected before touching the database.</summary>
    [GeneratedRegex("^[a-f0-9]{64}$")]
    private static partial Regex TokenShape();

    public static bool LooksLikeToken(string token) => TokenShape().IsMatch(token);

    public async Task<FeedData?> LoadAsync(string token, CancellationToken ct)
    {
        if (!LooksLikeToken(token)) return null;

        var feed = await GetAsync($"calendar_feeds?select=owner_id&token=eq.{token}", ct);
        if (feed.GetArrayLength() == 0) return null;
        var ownerId = feed[0].GetProperty("owner_id").GetString()!;

        var venueRows = await GetAsync(
            $"parks?select=park_id,name,address,city,state,latitude,longitude&owner_id=eq.{ownerId}", ct);
        var venues = venueRows.EnumerateArray().Select(v => new Venue(
            Id: RawId(v.GetProperty("park_id")),
            Name: Str(v, "name") ?? "Your venue",
            Address: Str(v, "address"),
            City: Str(v, "city"),
            State: Str(v, "state"),
            Latitude: Num(v, "latitude"),
            Longitude: Num(v, "longitude"))).ToList();
        if (venues.Count == 0) return new FeedData(venues, []);

        var since = Uri.EscapeDataString(DateTimeOffset.UtcNow.Subtract(History).ToString("O"));
        var gameRows = await GetAsync(
            "games?select=game_id,park_id,title,sport,organizer_id,start_time,end_time" +
            $"&park_id=in.({InList(venues.Select(v => v.Id))})&start_time=gte.{since}&order=start_time", ct);
        if (gameRows.GetArrayLength() == 0) return new FeedData(venues, []);

        var gameIds = gameRows.EnumerateArray().Select(g => RawId(g.GetProperty("game_id"))).ToList();
        var organizerIds = gameRows.EnumerateArray()
            .Select(g => Str(g, "organizer_id")).OfType<string>().Distinct().ToList();

        var bookingRows = await GetAsync($"bookings?select=game_id&game_id=in.({InList(gameIds)})", ct);
        var players = bookingRows.EnumerateArray()
            .GroupBy(b => RawId(b.GetProperty("game_id")))
            .ToDictionary(g => g.Key, g => g.Count());

        var names = new Dictionary<string, string?>();
        if (organizerIds.Count > 0)
        {
            var userRows = await GetAsync($"users?select=user_id,full_name&user_id=in.({InList(organizerIds)})", ct);
            foreach (var u in userRows.EnumerateArray())
            {
                names[RawId(u.GetProperty("user_id"))] = FeedBuilder.ShortName(Str(u, "full_name"));
            }
        }

        var games = new List<Game>();
        foreach (var g in gameRows.EnumerateArray())
        {
            if (!DateTimeOffset.TryParse(Str(g, "start_time"), out var start)) continue;
            DateTimeOffset? end = DateTimeOffset.TryParse(Str(g, "end_time"), out var e) ? e : null;
            var id = RawId(g.GetProperty("game_id"));
            var organizer = Str(g, "organizer_id");
            games.Add(new Game(
                Id: id,
                VenueId: RawId(g.GetProperty("park_id")),
                Title: Str(g, "title"),
                Sport: Str(g, "sport"),
                Start: start,
                End: end,
                OrganizerName: organizer is not null ? names.GetValueOrDefault(organizer) : null,
                PlayerCount: players.GetValueOrDefault(id)));
        }

        log.LogInformation("Feed for owner {Owner}: {Venues} venues, {Games} games", ownerId, venues.Count, games.Count);
        return new FeedData(venues, games);
    }

    private async Task<JsonElement> GetAsync(string pathAndQuery, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, pathAndQuery);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        using var resp = await http.SendAsync(req, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Supabase returned {(int)resp.StatusCode} for {pathAndQuery.Split('?')[0]}: {body}");
        }
        return JsonDocument.Parse(body).RootElement.Clone();
    }

    /// <summary>Ids may be uuids (strings) or numbers depending on the table; treat both as text.</summary>
    internal static string RawId(JsonElement e) =>
        e.ValueKind == JsonValueKind.String ? e.GetString()! : e.GetRawText();

    /// <summary>PostgREST list filter: in.("a","b"). Quotes keep commas inside values safe.</summary>
    internal static string InList(IEnumerable<string> ids) =>
        string.Join(",", ids.Select(id => $"\"{id.Replace("\"", "")}\""));

    private static string? Str(JsonElement row, string name) =>
        row.TryGetProperty(name, out var v) && v.ValueKind != JsonValueKind.Null
            ? (v.ValueKind == JsonValueKind.String ? v.GetString() : v.GetRawText())
            : null;

    private static double? Num(JsonElement row, string name) =>
        row.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : null;
}
