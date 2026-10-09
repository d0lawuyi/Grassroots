using System.Text;
using CalendarFeed.Ics;

namespace CalendarFeed.Tests;

public class IcsWriterTests
{
    [Fact]
    public void Lines_end_with_crlf()
    {
        var text = new IcsWriter().Line("BEGIN", "VCALENDAR").ToString();
        Assert.Equal("BEGIN:VCALENDAR\r\n", text);
    }

    [Theory]
    [InlineData("Soccer; 5v5, bring water", "Soccer\; 5v5\\, bring water")]
    [InlineData("Line one\nLine two", "Line one\\nLine two")]
    [InlineData("C:\\fields", "C:\\\\fields")]
    public void Text_is_escaped(string input, string expected) =>
        Assert.Equal(expected, IcsWriter.Escape(input));

    [Fact]
    public void Long_lines_fold_at_75_bytes()
    {
        var text = new IcsWriter().Text("DESCRIPTION", new string('a', 200)).ToString();
        var lines = text.Split("\r\n", StringSplitOptions.RemoveEmptyEntries);

        Assert.True(lines.Length > 1);
        Assert.All(lines, l => Assert.True(Encoding.UTF8.GetByteCount(l) <= 75, $"{l.Length} bytes: {l}"));
        Assert.All(lines.Skip(1), l => Assert.StartsWith(" ", l));
        // Unfolding (remove CRLF + space) gives back the original line
        Assert.Equal("DESCRIPTION:" + new string('a', 200), text.Replace("\r\n ", "").TrimEnd());
    }

    [Fact]
    public void Folding_never_splits_an_emoji()
    {
        var text = new IcsWriter().Text("SUMMARY", string.Concat(Enumerable.Repeat("⚽", 40))).ToString();
        foreach (var line in text.Split("\r\n", StringSplitOptions.RemoveEmptyEntries))
        {
            Assert.True(Encoding.UTF8.GetByteCount(line) <= 75);
            Assert.DoesNotContain('\uFFFD', Encoding.UTF8.GetString(Encoding.UTF8.GetBytes(line)));
        }
    }

    [Fact]
    public void Times_are_written_in_utc()
    {
        var indy = new DateTimeOffset(2026, 10, 10, 16, 0, 0, TimeSpan.FromHours(-4));
        Assert.Equal("20261010T200000Z", IcsWriter.FormatUtc(indy));
    }
}
