// Grassroots calendar feed: a private calendar link for each venue owner.
//
//   GET /feeds/{link}.ics   the owner's games, in the format calendar apps subscribe to
//   GET /health             "ok", for hosting platforms to check the service is up
//
// Run it:  dotnet run --project src/CalendarFeed   (then open http://localhost:5080/health)

using System.Threading.RateLimiting;
using CalendarFeed.Config;
using CalendarFeed.Feeds;
using CalendarFeed.Supabase;

var builder = WebApplication.CreateBuilder(args);

var settings = Settings.Load(builder.Environment.ContentRootPath);

builder.Services.AddHttpClient<IFeedSource, SupabaseFeedSource>(http =>
{
    http.BaseAddress = new Uri($"{settings.SupabaseUrl}/rest/v1/");
    http.Timeout = TimeSpan.FromSeconds(15);
    http.DefaultRequestHeaders.Add("apikey", settings.ServiceKey);
    // Older keys are JWTs and also go in the Authorization header; newer sb_secret_ keys don't.
    if (settings.ServiceKey.StartsWith("eyJ", StringComparison.Ordinal))
    {
        http.DefaultRequestHeaders.Add("Authorization", $"Bearer {settings.ServiceKey}");
    }
});

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

var app = builder.Build();
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

app.Run();
