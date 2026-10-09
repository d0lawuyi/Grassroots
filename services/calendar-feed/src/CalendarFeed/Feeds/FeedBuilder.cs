using System.Globalization;
using CalendarFeed.Ics;

namespace CalendarFeed.Feeds;

/// <summary>
/// Turns an owner's venues and games into a calendar. Pure: no network, no clock of
/// its own (the time is passed in), so it's simple to test.
/// </summary>
internal static class FeedBuilder
{
    // Games with no end time get this long a slot on the calendar.
    private static readonly TimeSpan DefaultLength = TimeSpan.FromHours(2);

    private static readonly Dictionary<string, string> SportNames = new()
    {
        ["soccer"] = "Soccer",
        ["basketball"] = "Basketball",
        ["flag_football"] = "Flag football",
        ["track"] = "Track",
        ["ultimate"] = "Ultimate",
    };

    public static string Build(FeedData data, DateTimeOffset now)
    {
        var venues = data.Venues.ToDictionary(v => v.Id);
        var ics = new IcsWriter()
            .Line("BEGIN", "VCALENDAR")
            .Line("VERSION", "2.0")
            .Line("PRODID", "-//Grassroots//Venue bookings//EN")
            .Line("CALSCALE", "GREGORIAN")
            .Line("METHOD", "PUBLISH")
            .Text("X-WR-CALNAME", CalendarName(data.Venues))
            .Text("X-WR-CALDESC", "Games booked at your venues through Grassroots")
            // Ask calendar apps to check for new bookings every hour
            .Line("REFRESH-INTERVAL;VALUE=DURATION", "PT1H")
            .Line("X-PUBLISHED-TTL", "PT1H");

        foreach (var game in data.Games.OrderBy(g => g.Start))
        {
            venues.TryGetValue(game.VenueId, out var venue);
            var end = game.End is { } e && e > game.Start ? e : game.Start + DefaultLength;

            ics.Line("BEGIN", "VEVENT")
                // A stable id, so an edited game updates in place instead of duplicating
                .Line("UID", $"game-{game.Id}@grassroots")
                .Utc("DTSTAMP", now)
                .Utc("DTSTART", game.Start)
                .Utc("DTEND", end)
                .Text("SUMMARY", Summary(game))
                .Text("LOCATION", Location(venue))
                .Text("DESCRIPTION", Description(game, venue))
                .Line("STATUS", "CONFIRMED")
                .Line("TRANSP", "OPAQUE");

            if (venue?.Latitude is { } lat && venue.Longitude is { } lon)
            {
                ics.Line("GEO", string.Create(CultureInfo.InvariantCulture, $"{lat:0.######};{lon:0.######}"));
            }
            ics.Line("END", "VEVENT");
        }

        return ics.Line("END", "VCALENDAR").ToString();
    }

    public static string SportName(string? sport) =>
        sport is not null && SportNames.TryGetValue(sport, out var name)
            ? name
            : string.IsNullOrWhiteSpace(sport) ? "Pickup" : sport.Replace('_', ' ');

    private static string CalendarName(IReadOnlyList<Venue> venues) =>
        venues.Count == 1 ? $"Grassroots: {venues[0].Name}" : "Grassroots bookings";

    private static string Summary(Game game)
    {
        var sport = SportName(game.Sport);
        return string.IsNullOrWhiteSpace(game.Title) ? $"{sport} game" : $"{sport}: {game.Title}";
    }

    private static string? Location(Venue? venue)
    {
        if (venue is null) return null;
        var parts = new[] { venue.Name, venue.Address, venue.City, venue.State }
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .Distinct(StringComparer.OrdinalIgnoreCase);
        return string.Join(", ", parts);
    }

    private static string Description(Game game, Venue? venue)
    {
        var lines = new List<string>();
        if (venue is not null) lines.Add($"Venue: {venue.Name}");
        if (!string.IsNullOrWhiteSpace(game.OrganizerName)) lines.Add($"Organized by {game.OrganizerName}");
        lines.Add(game.PlayerCount == 1 ? "1 player has joined" : $"{game.PlayerCount} players have joined");
        lines.Add("Booked through Grassroots");
        return string.Join("\n", lines);
    }

    /// <summary>"Danny Olawuyi" -> "Danny O." Owners see a first name, not a full name.</summary>
    public static string? ShortName(string? fullName)
    {
        var parts = (fullName ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length switch
        {
            0 => null,
            1 => parts[0],
            _ => $"{parts[0]} {parts[^1][0]}.",
        };
    }
}
