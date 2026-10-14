using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CalendarFeed.Teams;

namespace CalendarFeed.Supabase;

/// <summary>
/// Supabase side of balanced teams. Two kinds of request:
///   - auth/v1/user with the app user's own access token, to find out who is asking
///   - rest/v1 with the secret key, to read the roster and save the teams
/// </summary>
internal sealed class SupabaseTeamsStore(HttpClient rest, SupabaseAuthClient auth) : ITeamsStore
{
    public Task<string?> UserIdAsync(string accessToken, CancellationToken ct) => auth.UserIdAsync(accessToken, ct);

    public async Task<Roster?> LoadRosterAsync(string gameId, CancellationToken ct)
    {
        var games = await SendAsync(HttpMethod.Get, $"games?select=game_id,organizer_id&game_id=eq.{gameId}", null, ct);
        if (games.GetArrayLength() == 0) return null;
        var organizer = games[0].TryGetProperty("organizer_id", out var o) && o.ValueKind == JsonValueKind.String
            ? o.GetString()
            : null;

        var bookings = await SendAsync(HttpMethod.Get, $"bookings?select=player_id&game_id=eq.{gameId}", null, ct);
        var playerIds = bookings.EnumerateArray()
            .Select(b => SupabaseFeedSource.RawId(b.GetProperty("player_id")))
            .Distinct()
            .ToList();

        var skills = new Dictionary<string, double?>();
        if (playerIds.Count > 0)
        {
            var users = await SendAsync(HttpMethod.Get,
                $"users?select=user_id,skill_rating&user_id=in.({SupabaseFeedSource.InList(playerIds)})", null, ct);
            foreach (var u in users.EnumerateArray())
            {
                skills[SupabaseFeedSource.RawId(u.GetProperty("user_id"))] =
                    u.TryGetProperty("skill_rating", out var s) && s.ValueKind == JsonValueKind.Number ? s.GetDouble() : null;
            }
        }

        return new Roster(gameId, organizer,
            playerIds.Select(id => new RosterPlayer(id, skills.GetValueOrDefault(id))).ToList());
    }

    public async Task SaveTeamsAsync(string gameId, IReadOnlyList<IReadOnlyList<string>> teams, CancellationToken ct)
    {
        // Out with the old teams, in with the new. (Two requests, not one transaction: if the
        // second failed, the organizer would see no teams and tap the button again.)
        await SendAsync(HttpMethod.Delete, $"game_teams?game_id=eq.{gameId}", null, ct);
        var rows = teams
            .SelectMany((players, i) => players.Select(p => new { game_id = gameId, player_id = p, team = i + 1 }))
            .ToList();
        await SendAsync(HttpMethod.Post, "game_teams", JsonSerializer.Serialize(rows), ct);
    }

    private async Task<JsonElement> SendAsync(HttpMethod method, string pathAndQuery, string? jsonBody, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(method, pathAndQuery);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (jsonBody is not null)
        {
            req.Content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
            req.Headers.Add("Prefer", "return=minimal");
        }
        using var resp = await rest.SendAsync(req, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Supabase returned {(int)resp.StatusCode} for {method} {pathAndQuery.Split('?')[0]}: {body}");
        }
        return body.Length == 0 ? default : JsonDocument.Parse(body).RootElement.Clone();
    }
}

/// <summary>
/// Asks Supabase Auth who an app access token belongs to. A separate HttpClient from the
/// REST one, because this request must carry the user's token, not the secret key.
/// </summary>
internal sealed class SupabaseAuthClient(HttpClient http)
{
    public async Task<string?> UserIdAsync(string accessToken, CancellationToken ct)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get, "user");
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        using var resp = await http.SendAsync(req, ct);
        if (resp.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden or HttpStatusCode.BadRequest)
        {
            return null; // expired, signed out, or not a real token
        }
        var body = await resp.Content.ReadAsStringAsync(ct);
        if (!resp.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Supabase Auth returned {(int)resp.StatusCode}: {body}");
        }
        using var doc = JsonDocument.Parse(body);
        return doc.RootElement.TryGetProperty("id", out var id) ? id.GetString() : null;
    }
}
