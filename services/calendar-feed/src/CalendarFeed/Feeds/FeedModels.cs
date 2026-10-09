namespace CalendarFeed.Feeds;

/// <summary>A venue the owner manages.</summary>
internal sealed record Venue(
    string Id,
    string Name,
    string? Address,
    string? City,
    string? State,
    double? Latitude,
    double? Longitude);

/// <summary>A game booked at one of the owner's venues.</summary>
internal sealed record Game(
    string Id,
    string VenueId,
    string? Title,
    string? Sport,
    DateTimeOffset Start,
    DateTimeOffset? End,
    string? OrganizerName,
    int PlayerCount);

/// <summary>Everything one owner's calendar needs.</summary>
internal sealed record FeedData(IReadOnlyList<Venue> Venues, IReadOnlyList<Game> Games);

/// <summary>Where feed data comes from. Supabase in the real service, a fake in tests.</summary>
internal interface IFeedSource
{
    /// <summary>Returns null when no owner has this link (wrong or reset link).</summary>
    Task<FeedData?> LoadAsync(string token, CancellationToken ct);
}
