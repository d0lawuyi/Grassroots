namespace CalendarFeed.Teams;

/// <summary>
/// POST /games/{gameId}/teams: checks who's asking, loads the roster, asks the C++ solver
/// for fair teams and saves them. Each step that can go wrong returns a plain-English
/// message and the matching HTTP status, so the app can show it as-is.
/// </summary>
internal sealed class TeamsService(ITeamsStore store, ITeamSolver solver, ILogger<TeamsService> log)
{
    public const int MinTeams = 2;
    public const int MaxTeams = 4;
    public const int MinPerTeam = 2;

    /// <summary>Players who haven't picked a level count as the middle one.</summary>
    public const double DefaultSkill = 3;

    public async Task<IResult> MakeAsync(string? accessToken, string gameId, int? requestedTeams, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(accessToken)) return Error(401, "Sign in to make teams.");
        if (!Guid.TryParse(gameId, out var parsed)) return Error(404, "That game doesn't exist.");
        gameId = parsed.ToString();

        var teamCount = requestedTeams ?? 2;
        if (teamCount is < MinTeams or > MaxTeams)
            return Error(400, $"Pick between {MinTeams} and {MaxTeams} teams.");

        var userId = await store.UserIdAsync(accessToken, ct);
        if (userId is null) return Error(401, "Your sign-in has expired. Sign in again and retry.");

        var roster = await store.LoadRosterAsync(gameId, ct);
        if (roster is null) return Error(404, "That game doesn't exist.");
        if (!string.Equals(roster.OrganizerId, userId, StringComparison.OrdinalIgnoreCase))
            return Error(403, "Only the organizer can make teams.");

        var needed = teamCount * MinPerTeam;
        if (roster.Players.Count < needed)
            return Error(400, $"{teamCount} teams need at least {needed} players. {roster.Players.Count} have joined so far.");

        var input = roster.Players.Select(p => (p.PlayerId, p.Skill ?? DefaultSkill)).ToList();
        SolvedTeams solved;
        try
        {
            solved = await solver.SolveAsync(input, teamCount, ct);
        }
        catch (SolverInputException e)
        {
            return Error(400, e.Message);
        }
        catch (SolverUnavailableException e)
        {
            log.LogError("{Message}", e.Message);
            return Error(503, "Making teams isn't available right now. Try again later.");
        }

        await store.SaveTeamsAsync(gameId, solved.Teams, ct);
        log.LogInformation("Made {Teams} teams for game {Game} ({Players} players, spread {Spread})",
            teamCount, gameId, roster.Players.Count, solved.Spread);

        return Results.Json(new TeamsResponse(
            solved.Teams.Select((players, i) => new TeamEntry(i + 1, players)).ToList(),
            solved.Spread,
            solved.ProvenBest));
    }

    internal static IResult Error(int status, string message) =>
        Results.Json(new { error = message }, statusCode: status);
}
