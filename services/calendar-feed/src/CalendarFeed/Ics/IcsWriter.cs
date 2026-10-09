using System.Globalization;
using System.Text;

namespace CalendarFeed.Ics;

/// <summary>
/// Writes iCalendar text (RFC 5545), the format every calendar app subscribes to.
///
/// Three rules from the standard that matter here:
///   1. Lines end with CRLF ("\r\n"), not just "\n".
///   2. No line may be longer than 75 bytes. Longer lines are "folded": cut, and the
///      rest continues on the next line starting with a single space.
///   3. In text values, backslash, semicolon, comma and newline must be escaped.
/// </summary>
internal sealed class IcsWriter
{
    private const int MaxLineBytes = 75;
    private readonly StringBuilder _sb = new();

    /// <summary>Adds a property line, for example ("SUMMARY", "Soccer: Tuesday 5v5").</summary>
    public IcsWriter Line(string name, string value)
    {
        Fold($"{name}:{value}");
        return this;
    }

    /// <summary>Adds a property whose value is free text, escaping it first.</summary>
    public IcsWriter Text(string name, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            Line(name, Escape(value));
        }
        return this;
    }

    /// <summary>Adds a date-time in UTC, written like 20261010T200000Z.</summary>
    public IcsWriter Utc(string name, DateTimeOffset when) =>
        Line(name, FormatUtc(when));

    public static string FormatUtc(DateTimeOffset when) =>
        when.UtcDateTime.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);

    public static string Escape(string value) =>
        value
            .Replace("\\", "\\\\")
            .Replace(";", "\\;")
            .Replace(",", "\\,")
            .Replace("\r\n", "\n")
            .Replace("\r", "\n")
            .Replace("\n", "\\n");

    public override string ToString() => _sb.ToString();

    /// <summary>Writes one logical line, folding it so no physical line passes 75 bytes.</summary>
    private void Fold(string line)
    {
        var budget = MaxLineBytes;
        var used = 0;
        foreach (var rune in line.EnumerateRunes())
        {
            var bytes = rune.Utf8SequenceLength;
            if (used + bytes > budget)
            {
                _sb.Append("\r\n ");
                budget = MaxLineBytes - 1; // the leading space counts toward the 75
                used = 0;
            }
            _sb.Append(rune.ToString());
            used += bytes;
        }
        _sb.Append("\r\n");
    }
}
