namespace CalendarFeed.Teams;

/// <summary>A player in the game, with their level (1 to 5) if they've set one.</summary>
internal sealed record RosterPlayer(string PlayerId, double? Skill);

/// <summary>Who organized the game and who has joined it.</summary>
internal sealed record Roster(string GameId, string? OrganizerId, IReadOnlyList<RosterPlayer> Players);

/// <summary>What the C++ solver decided: player ids per team, strongest team first.</summary>
internal sealed record SolvedTeams(IReadOnlyList<IReadOnlyList<string>> Teams, double Spread, bool ProvenBest);

/// <summary>The body the app sends: how many teams. Leave it out for 2.</summary>
public sealed record MakeTeamsRequest(int? Teams);

/// <summary>What the app gets back.</summary>
public sealed record TeamsResponse(IReadOnlyList<TeamEntry> Teams, double Spread, bool ProvenBest);

public sealed record TeamEntry(int Team, IReadOnlyList<string> Players);

/// <summary>Reads and writes what teams need in Supabase.</summary>
internal interface ITeamsStore
{
    /// <summary>The signed-in user's id for an app access token, or null if it isn't valid.</summary>
    Task<string?> UserIdAsync(string accessToken, CancellationToken ct);

    /// <summary>The game's organizer and players, or null if there's no such game.</summary>
    Task<Roster?> LoadRosterAsync(string gameId, CancellationToken ct);

    /// <summary>Replaces the game's saved teams. teams[0] is team 1.</summary>
    Task SaveTeamsAsync(string gameId, IReadOnlyList<IReadOnlyList<string>> teams, CancellationToken ct);
}

/// <summary>Splits players into teams. The real one runs the C++ balance-teams program.</summary>
internal interface ITeamSolver
{
    Task<SolvedTeams> SolveAsync(IReadOnlyList<(string Id, double Skill)> players, int teamCount, CancellationToken ct);
}

/// <summary>The solver said the input can't be split (for example, too few players).</summary>
internal sealed class SolverInputException(string message) : Exception(message);

/// <summary>The balance-teams program isn't there (not built, or missing from the deploy).</summary>
internal sealed class SolverUnavailableException(string message) : Exception(message);

/// <summary>Stands in when balance-teams can't be found, so the rest of the service still runs.</summary>
internal sealed class MissingTeamSolver : ITeamSolver
{
    public Task<SolvedTeams> SolveAsync(IReadOnlyList<(string Id, double Skill)> players, int teamCount, CancellationToken ct) =>
        throw new SolverUnavailableException(
            "The teams solver isn't built. Build services/teams-solver (see its README) or set TEAMS_SOLVER_PATH.");
}
