using CalendarFeed.Feeds;

namespace CalendarFeed.Tests;

public class FeedBuilderTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 9, 20, 0, 0, TimeSpan.Zero);

    private static readonly Venue Central = new("p1", "Central Green Field", "1200 W 38th St", "Indianapolis", "IN", 39.8253, -86.1874);

    private static Game GameAt(string id, int daysFromNow, string? title = "Tuesday 5v5", DateTimeOffset? end = null, int players = 7) =>
        new(id, "p1", title, "soccer", Now.AddDays(daysFromNow), end, "Sam L.", players);

    // Long lines are folded (see IcsWriter); undo that so tests can search the text.
    private static string Unfold(string ics) => ics.Replace("\r\n ", "");

    private static string Build(params Game[] games) => Unfold(FeedBuilder.Build(new FeedData([Central], games), Now));

    [Fact]
    public void Calendar_has_header_and_footer()
    {
        var ics = Build();
        Assert.StartsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n", ics);
        Assert.EndsWith("END:VCALENDAR\r\n", ics);
        Assert.Contains("X-WR-CALNAME:Grassroots: Central Green Field\r\n", ics);
        Assert.Contains("REFRESH-INTERVAL;VALUE=DURATION:PT1H\r\n", ics);
    }

    [Fact]
    public void Each_game_becomes_one_event_with_a_stable_id()
    {
        var ics = Build(GameAt("g1", 1), GameAt("g2", 3));
        Assert.Equal(2, ics.Split("BEGIN:VEVENT").Length - 1);
        Assert.Contains("UID:game-g1@grassroots\r\n", ics);
        Assert.Contains("UID:game-g2@grassroots\r\n", ics);
    }

    [Fact]
    public void Event_has_time_place_and_details()
    {
        var ics = Build(GameAt("g1", 1));
        Assert.Contains("DTSTART:20261010T200000Z\r\n", ics);
        Assert.Contains("DTEND:20261010T220000Z\r\n", ics); // no end time -> 2 hours
        Assert.Contains("SUMMARY:Soccer: Tuesday 5v5\r\n", ics);
        Assert.Contains("LOCATION:Central Green Field\\, 1200 W 38th St\\, Indianapolis\\, IN\r\n", ics);
        Assert.Contains("Organized by Sam L.", ics);
        Assert.Contains("7 players have joined", ics);
        Assert.Contains("GEO:39.8253;-86.1874\r\n", ics);
    }

    [Fact]
    public void Real_end_time_is_used_when_present()
    {
        var ics = Build(GameAt("g1", 1, end: Now.AddDays(1).AddMinutes(90)));
        Assert.Contains("DTEND:20261010T213000Z\r\n", ics);
    }

    [Fact]
    public void Untitled_game_and_unknown_sport_still_read_well()
    {
        var game = new Game("g9", "p1", null, "pickle_ball", Now, null, null, 1);
        var ics = Unfold(FeedBuilder.Build(new FeedData([Central], [game]), Now));
        Assert.Contains("SUMMARY:pickle ball game\r\n", ics);
        Assert.Contains("1 player has joined", ics);
    }

    [Fact]
    public void Games_are_in_time_order()
    {
        var ics = Build(GameAt("later", 5), GameAt("sooner", 1));
        Assert.True(ics.IndexOf("game-sooner", StringComparison.Ordinal) < ics.IndexOf("game-later", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("Danny Olawuyi", "Danny O.")]
    [InlineData("Danny", "Danny")]
    [InlineData("  ", null)]
    [InlineData(null, null)]
    public void Short_names_show_only_a_last_initial(string? full, string? expected) =>
        Assert.Equal(expected, FeedBuilder.ShortName(full));
}
