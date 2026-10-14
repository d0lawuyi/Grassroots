using System.Text.Json;
using CalendarFeed.Teams;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging.Abstractions;

namespace CalendarFeed.Tests;

public class TeamsServiceTests
{
    private const string GameId = "40000000-0000-0000-0000-000000000001";
    private const string Organizer = "00000000-0000-0000-0000-00000000000a";

    /// <summary>A pretend Supabase: a game, its players, and a record of what got saved.</summary>
    private sealed class FakeStore : ITeamsStore
    {
        public Dictionary<string, string> Tokens { get; } = new() { ["organizer-token"] = Organizer, ["player-token"] = "p2" };
        public Roster? Roster { get; set; }
        public IReadOnlyList<IReadOnlyList<string>>? Saved { get; private set; }

        public Task<string?> UserIdAsync(string accessToken, CancellationToken ct) =>
            Task.FromResult(Tokens.GetValueOrDefault(accessToken));

        public Task<Roster?> LoadRosterAsync(string gameId, CancellationToken ct) =>
            Task.FromResult(Roster?.GameId == gameId ? Roster : null);

        public Task SaveTeamsAsync(string gameId, IReadOnlyList<IReadOnlyList<string>> teams, CancellationToken ct)
        {
            Saved = teams;
            return Task.CompletedTask;
        }
    }

    /// <summary>A pretend solver: deals players out in turn and remembers what it was given.</summary>
    private sealed class FakeSolver : ITeamSolver
    {
        public IReadOnlyList<(string Id, double Skill)>? Input { get; private set; }

        public Task<SolvedTeams> SolveAsync(IReadOnlyList<(string Id, double Skill)> players, int teamCount, CancellationToken ct)
        {
            Input = players;
            var teams = Enumerable.Range(0, teamCount)
                .Select(t => (IReadOnlyList<string>)players.Where((_, i) => i % teamCount == t).Select(p => p.Id).ToList())
                .ToList();
            return Task.FromResult(new SolvedTeams(teams, 0, true));
        }
    }

    private static Roster RosterOf(int players, double? skill = 4) => new(GameId, Organizer,
        Enumerable.Range(1, players).Select(i => new RosterPlayer($"p{i}", i == 1 ? null : skill)).ToList());

    private static (TeamsService Service, FakeStore Store, FakeSolver Solver) Make(Roster? roster)
    {
        var store = new FakeStore { Roster = roster };
        var solver = new FakeSolver();
        return (new TeamsService(store, solver, NullLogger<TeamsService>.Instance), store, solver);
    }

    /// <summary>The status code and the "error" message (if any) of a result.</summary>
    private static (int Status, string? Error) Read(IResult result)
    {
        var status = (result as IStatusCodeHttpResult)?.StatusCode ?? 200;
        var value = (result as IValueHttpResult)?.Value;
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(value));
        var error = doc.RootElement.TryGetProperty("error", out var e) ? e.GetString() : null;
        return (status, error);
    }

    [Fact]
    public async Task Organizer_gets_teams_and_they_are_saved()
    {
        var (service, store, solver) = Make(RosterOf(6));
        var result = await service.MakeAsync("organizer-token", GameId, null, default);

        Assert.Equal(200, Read(result).Status);
        var body = Assert.IsType<JsonHttpResult<TeamsResponse>>(result).Value!;
        Assert.Equal(new[] { 1, 2 }, body.Teams.Select(t => t.Team));
        Assert.Equal(6, body.Teams.Sum(t => t.Players.Count));
        Assert.NotNull(store.Saved);
        Assert.Equal(2, store.Saved!.Count);
        // p1 never picked a level, so they count as the middle one
        Assert.Equal(TeamsService.DefaultSkill, solver.Input!.Single(p => p.Id == "p1").Skill);
        Assert.Equal(4, solver.Input!.Single(p => p.Id == "p2").Skill);
    }

    [Fact]
    public async Task Three_teams_when_asked()
    {
        var (service, store, _) = Make(RosterOf(9));
        var result = await service.MakeAsync("organizer-token", GameId, 3, default);
        Assert.Equal(200, Read(result).Status);
        Assert.Equal(3, store.Saved!.Count);
    }

    [Theory]
    [InlineData(null, 401, "Sign in")]
    [InlineData("", 401, "Sign in")]
    [InlineData("expired-token", 401, "expired")]
    [InlineData("player-token", 403, "Only the organizer")]
    public async Task Only_the_signed_in_organizer_can_make_teams(string? token, int status, string message)
    {
        var (service, store, _) = Make(RosterOf(6));
        var (code, error) = Read(await service.MakeAsync(token, GameId, null, default));
        Assert.Equal(status, code);
        Assert.Contains(message, error);
        Assert.Null(store.Saved);
    }

    [Theory]
    [InlineData("not-a-game", null, 404, "doesn't exist")]
    [InlineData("40000000-0000-0000-0000-000000000009", null, 404, "doesn't exist")]
    [InlineData(GameId, 1, 400, "between 2 and 4")]
    [InlineData(GameId, 5, 400, "between 2 and 4")]
    [InlineData(GameId, 4, 400, "4 teams need at least 8 players. 6 have joined")]
    public async Task Bad_requests_are_explained(string gameId, int? teams, int status, string message)
    {
        var (service, store, _) = Make(RosterOf(6));
        var (code, error) = Read(await service.MakeAsync("organizer-token", gameId, teams, default));
        Assert.Equal(status, code);
        Assert.Contains(message, error);
        Assert.Null(store.Saved);
    }

    [Fact]
    public async Task Too_few_players_for_two_teams()
    {
        var (service, _, _) = Make(RosterOf(3));
        var (code, error) = Read(await service.MakeAsync("organizer-token", GameId, null, default));
        Assert.Equal(400, code);
        Assert.Contains("at least 4 players", error);
    }

    [Fact]
    public async Task Missing_solver_says_not_available()
    {
        var store = new FakeStore { Roster = RosterOf(6) };
        var service = new TeamsService(store, new MissingTeamSolver(), NullLogger<TeamsService>.Instance);
        var (code, error) = Read(await service.MakeAsync("organizer-token", GameId, null, default));
        Assert.Equal(503, code);
        Assert.Contains("isn't available", error);
        Assert.Null(store.Saved);
    }
}

public class ProcessTeamSolverTests
{
    [Fact]
    public void Csv_uses_ids_and_dots_for_decimals()
    {
        var csv = ProcessTeamSolver.ToCsv([("a1", 4), ("b2", 3.5)]);
        Assert.Equal("name,skill\na1,4\nb2,3.5\n", csv);
    }

    [Fact]
    public void Csv_rejects_ids_that_would_break_the_format()
    {
        Assert.Throws<ArgumentException>(() => ProcessTeamSolver.ToCsv([("a,b", 3)]));
    }

    [Fact]
    public void Parses_balance_teams_json()
    {
        var solved = ProcessTeamSolver.Parse(
            """{"spread":0.5,"proven_best":true,"teams":[{"total":7,"players":[{"name":"a","skill":4},{"name":"b","skill":3}]},{"total":6.5,"players":[{"name":"c","skill":3.5},{"name":"d","skill":3}]}]}""");
        Assert.Equal(0.5, solved.Spread);
        Assert.True(solved.ProvenBest);
        Assert.Equal(new[] { "a", "b" }, solved.Teams[0]);
        Assert.Equal(new[] { "c", "d" }, solved.Teams[1]);
    }

    /// <summary>
    /// Runs the real C++ program. CI builds it first and sets TEAMS_SOLVER_PATH; on your PC it
    /// uses services/teams-solver/build if you've built it there. Without it, there's nothing to run.
    /// </summary>
    [Fact]
    public async Task Real_solver_splits_players_fairly()
    {
        var root = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "src", "CalendarFeed");
        var path = ProcessTeamSolver.Find(root);
        if (path is null)
        {
            Assert.Null(Environment.GetEnvironmentVariable("CI")); // in CI the solver must be there
            return;
        }
        var solver = new ProcessTeamSolver(path, NullLogger<ProcessTeamSolver>.Instance);

        var solved = await solver.SolveAsync(
            [("p1", 5), ("p2", 4), ("p3", 3), ("p4", 3), ("p5", 2), ("p6", 1)], 2, default);

        Assert.Equal(0, solved.Spread); // 5+3+1 = 4+3+2
        Assert.True(solved.ProvenBest);
        Assert.Equal(6, solved.Teams.Sum(t => t.Count));
        Assert.All(solved.Teams, t => Assert.Equal(3, t.Count));

        var tooFew = await Assert.ThrowsAsync<SolverInputException>(() => solver.SolveAsync([("p1", 3)], 2, default));
        Assert.Contains("not enough for 2 teams", tooFew.Message);
    }
}
