using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.Json;

namespace CalendarFeed.Teams;

/// <summary>
/// Runs the C++ program services/teams-solver/balance-teams: players go in as CSV on its
/// standard input, teams come back as JSON on its standard output.
///
/// Running a separate program is the simplest way for C# to use C++ code: the two only
/// share text, so neither needs to know how the other stores data in memory.
/// </summary>
internal sealed class ProcessTeamSolver(string path, ILogger<ProcessTeamSolver> log) : ITeamSolver
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(10);

    public string Path { get; } = path;

    public async Task<SolvedTeams> SolveAsync(IReadOnlyList<(string Id, double Skill)> players, int teamCount, CancellationToken ct)
    {
        var start = new ProcessStartInfo(Path)
        {
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            StandardInputEncoding = new UTF8Encoding(false),
            StandardOutputEncoding = Encoding.UTF8,
        };
        start.ArgumentList.Add("--teams");
        start.ArgumentList.Add(teamCount.ToString(CultureInfo.InvariantCulture));
        start.ArgumentList.Add("--json");

        using var process = Process.Start(start)
            ?? throw new InvalidOperationException($"Couldn't start the teams solver at {Path}.");

        // Start reading the output before writing the input. If the program filled its output
        // buffer while we were still writing, both sides would wait on each other forever.
        var stdout = process.StandardOutput.ReadToEndAsync(ct);
        var stderr = process.StandardError.ReadToEndAsync(ct);

        await process.StandardInput.WriteAsync(ToCsv(players).AsMemory(), ct);
        process.StandardInput.Close();

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(Timeout);
        try
        {
            await process.WaitForExitAsync(timeout.Token);
        }
        catch (OperationCanceledException)
        {
            process.Kill(entireProcessTree: true);
            throw new InvalidOperationException("The teams solver took too long.");
        }

        var output = await stdout;
        var errors = (await stderr).Trim();
        switch (process.ExitCode)
        {
            case 0:
                return Parse(output);
            case 2: // balance-teams uses 2 for "the input was wrong"
                throw new SolverInputException(errors.Replace("balance-teams: ", ""));
            default:
                log.LogError("balance-teams exited with {Code}: {Errors}", process.ExitCode, errors);
                throw new InvalidOperationException($"The teams solver failed (exit code {process.ExitCode}).");
        }
    }

    /// <summary>name,skill per line. The name is the player's id, so no real names leave the service.</summary>
    internal static string ToCsv(IReadOnlyList<(string Id, double Skill)> players)
    {
        var csv = new StringBuilder("name,skill\n");
        foreach (var (id, skill) in players)
        {
            if (id.Contains(',') || id.Contains('\n')) throw new ArgumentException($"Bad player id: {id}");
            csv.Append(id).Append(',').Append(skill.ToString(CultureInfo.InvariantCulture)).Append('\n');
        }
        return csv.ToString();
    }

    /// <summary>Reads balance-teams --json output: {"spread":0,"proven_best":true,"teams":[{"players":[{"name":...}]}]}</summary>
    internal static SolvedTeams Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var teams = root.GetProperty("teams").EnumerateArray()
            .Select(t => (IReadOnlyList<string>)t.GetProperty("players").EnumerateArray()
                .Select(p => p.GetProperty("name").GetString()!)
                .ToList())
            .ToList();
        return new SolvedTeams(teams, root.GetProperty("spread").GetDouble(), root.GetProperty("proven_best").GetBoolean());
    }

    /// <summary>
    /// Where balance-teams is. In order: the TEAMS_SOLVER_PATH setting, next to this service
    /// (how the AWS deploy ships it), then the C++ project's build folder on your PC.
    /// Null if it isn't built yet.
    /// </summary>
    public static string? Find(string contentRoot)
    {
        var exe = OperatingSystem.IsWindows() ? "balance-teams.exe" : "balance-teams";
        var fromSetting = Environment.GetEnvironmentVariable("TEAMS_SOLVER_PATH");
        var candidates = new List<string>();
        if (!string.IsNullOrWhiteSpace(fromSetting)) candidates.Add(fromSetting);
        candidates.Add(System.IO.Path.Combine(AppContext.BaseDirectory, exe));
        // contentRoot is services/calendar-feed/src/CalendarFeed when you dotnet run
        var solverDir = System.IO.Path.Combine(contentRoot, "..", "..", "..", "teams-solver", "build");
        candidates.Add(System.IO.Path.Combine(solverDir, "Release", exe)); // Visual Studio build
        candidates.Add(System.IO.Path.Combine(solverDir, exe));            // Linux/macOS build
        return candidates.Select(System.IO.Path.GetFullPath).FirstOrDefault(File.Exists);
    }
}
