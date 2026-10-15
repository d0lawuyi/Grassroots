// Grassroots API: a private calendar link for each venue owner, and balanced teams.
//
//   GET  /feeds/{link}.ics       the owner's games, in the format calendar apps subscribe to
//   POST /games/{id}/teams       the organizer splits the players into fair teams (C++ solver)
//   GET  /health                 "ok", for hosting platforms to check the service is up
//
// Run it:  dotnet run --project src/CalendarFeed   (then open http://localhost:5080/health)
// Online it runs in AWS Lambda behind a Function URL (see infra/README.md).

using System.Threading.RateLimiting;
using Amazon.Lambda.AspNetCoreServer.Hosting;
using CalendarFeed.Config;
using CalendarFeed.Feeds;
using CalendarFeed.Supabase;
using CalendarFeed.Teams;

var builder = WebApplication.CreateBuilder(args);

var settings = Settings.Load(builder.Environment.ContentRootPath);

// In AWS Lambda, requests arrive as Lambda events instead of over a normal web port.
// This translates them, so the routes below work unchanged. On your PC it's skipped.
// (Function URLs send the same event format as an API Gateway HTTP API.)
builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

// Supabase's REST API with the secret key: reads across all tables.
void UseSupabaseRest(HttpClient http)
{
    http.BaseAddress = new Uri($"{settings.SupabaseUrl}/rest/v1/");
    http.Timeout = TimeSpan.FromSeconds(15);
    http.DefaultRequestHeaders.Add("apikey", settings.ServiceKey);
    // Older keys are JWTs and also go in the Authorization header; newer sb_secret_ keys don't.
    if (settings.ServiceKey.StartsWith("eyJ", StringComparison.Ordinal))
    {
        http.DefaultRequestHeaders.Add("Authorization", $"Bearer {settings.ServiceKey}");
    }
}
builder.Services.AddHttpClient<IFeedSource, SupabaseFeedSource>(UseSupabaseRest);
builder.Services.AddHttpClient<ITeamsStore, SupabaseTeamsStore>(UseSupabaseRest);

// Supabase Auth: the apikey header says which project; each request adds the user's own token.
builder.Services.AddHttpClient<SupabaseAuthClient>(http =>
{
    http.BaseAddress = new Uri($"{settings.SupabaseUrl}/auth/v1/");
    http.Timeout = TimeSpan.FromSeconds(10);
    http.DefaultRequestHeaders.Add("apikey", settings.ServiceKey);
});

// The C++ balance-teams program. If it isn't built, the calendar feed still works and
// making teams answers "not available".
var solverPath = ProcessTeamSolver.Find(builder.Environment.ContentRootPath);
if (solverPath is not null)
{
    builder.Services.AddSingleton<ITeamSolver>(sp =>
        new ProcessTeamSolver(solverPath, sp.GetRequiredService<ILogger<ProcessTeamSolver>>()));
}
else
{
    builder.Services.AddSingleton<ITeamSolver, MissingTeamSolver>();
}
builder.Services.AddScoped<TeamsService>();

// Calendar apps poll about once an hour. 60 requests a minute per address is plenty
// for them and stops anyone guessing links quickly.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1) }));
});

// Lets the Grassroots website (a browser on another address) call this API. See Config/WebsiteCors.cs.
builder.Services.AddCors(options => options.AddPolicy(WebsiteCors.PolicyName, policy => policy
    .WithOrigins(WebsiteCors.Origins)
    .WithMethods(WebsiteCors.Methods)
    .WithHeaders(WebsiteCors.Headers)));

var app = builder.Build();
app.UseCors(WebsiteCors.PolicyName);
app.UseRateLimiter();

app.MapGet("/health", () => Results.Text("ok"));

app.MapGet("/feeds/{file}", async (string file, IFeedSource source, ILogger<Program> log, CancellationToken ct) =>
{
    var token = file.EndsWith(".ics", StringComparison.OrdinalIgnoreCase) ? file[..^4] : file;
    try
    {
        var data = await source.LoadAsync(token, ct);
        if (data is null)
        {
            return Results.NotFound("This calendar link isn't valid. It may have been reset in the Grassroots app.");
        }
        return Results.Text(FeedBuilder.Build(data, DateTimeOffset.UtcNow), "text/calendar; charset=utf-8");
    }
    catch (Exception e) when (e is HttpRequestException || (e is TaskCanceledException && !ct.IsCancellationRequested))
    {
        log.LogError(e, "Couldn't load a calendar feed from Supabase");
        return Results.Problem("Couldn't reach the Grassroots database. Try again in a few minutes.", statusCode: 502);
    }
});

app.MapPost("/games/{gameId}/teams", async (string gameId, MakeTeamsRequest? body, HttpRequest request,
    TeamsService teams, ILogger<Program> log, CancellationToken ct) =>
{
    var header = request.Headers.Authorization.ToString();
    var token = header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? header[7..].Trim() : null;
    try
    {
        return await teams.MakeAsync(token, gameId, body?.Teams, ct);
    }
    catch (Exception e) when (e is HttpRequestException || (e is TaskCanceledException && !ct.IsCancellationRequested))
    {
        log.LogError(e, "Couldn't make teams");
        return TeamsService.Error(502, "Couldn't reach the Grassroots database. Try again in a few minutes.");
    }
});

app.Logger.LogInformation(solverPath is null
    ? "Teams solver not found: making teams is turned off. See services/teams-solver/README.md."
    : $"Teams solver: {solverPath}");

app.Run();
