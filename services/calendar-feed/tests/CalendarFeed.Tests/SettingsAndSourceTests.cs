using System.Text;
using System.Text.Json;
using CalendarFeed.Config;
using CalendarFeed.Supabase;

namespace CalendarFeed.Tests;

public class SettingsAndSourceTests
{
    private static string FakeJwt(string role)
    {
        var body = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{{\"role\":\"{role}\"}}"))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return $"eyJhbGciOiJIUzI1NiJ9.{body}.sig";
    }

    [Theory]
    [InlineData("sb_publishable_abc", "anon")]
    [InlineData("sb_secret_abc", "service_role")]
    [InlineData("not-a-key", null)]
    public void Key_role_from_prefix(string key, string? role) => Assert.Equal(role, Settings.KeyRole(key));

    [Fact]
    public void Key_role_from_old_style_jwt()
    {
        Assert.Equal("anon", Settings.KeyRole(FakeJwt("anon")));
        Assert.Equal("service_role", Settings.KeyRole(FakeJwt("service_role")));
    }

    [Fact]
    public void Env_file_lines_are_parsed()
    {
        var path = Path.GetTempFileName();
        File.WriteAllText(path, "# comment\nSUPABASE_URL=https://x.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=\"sb_secret_1\"\nnot a setting\n");
        var values = Settings.ReadEnvFile(path).ToDictionary(p => p.Key, p => p.Value);
        Assert.Equal("https://x.supabase.co", values["SUPABASE_URL"]);
        Assert.Equal("sb_secret_1", values["SUPABASE_SERVICE_ROLE_KEY"]);
        Assert.Equal(2, values.Count);
    }

    [Theory]
    [InlineData("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", true)]
    [InlineData("short", false)]
    [InlineData("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde,", false)]
    [InlineData("eq.x&owner_id=eq.someone", false)]
    public void Only_well_formed_links_reach_the_database(string token, bool ok) =>
        Assert.Equal(ok, SupabaseFeedSource.LooksLikeToken(token));

    [Fact]
    public void Ids_work_whether_text_or_number()
    {
        using var doc = JsonDocument.Parse("""[ "a1b2", 42 ]""");
        Assert.Equal("a1b2", SupabaseFeedSource.RawId(doc.RootElement[0]));
        Assert.Equal("42", SupabaseFeedSource.RawId(doc.RootElement[1]));
    }

    [Fact]
    public void In_list_quotes_each_id() =>
        Assert.Equal("\"a\",\"b\"", SupabaseFeedSource.InList(["a", "b"]));
}
