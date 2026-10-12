#include "teams/io.hpp"

#include <algorithm>
#include <cctype>
#include <charconv>
#include <cstdio>
#include <sstream>
#include <stdexcept>
#include <system_error>

namespace teams {
namespace {

std::string trim(const std::string& s) {
    auto not_space = [](unsigned char c) { return !std::isspace(c); };
    auto begin = std::find_if(s.begin(), s.end(), not_space);
    auto end = std::find_if(s.rbegin(), s.rend(), not_space).base();
    return begin < end ? std::string(begin, end) : std::string();
}

std::vector<std::string> split_commas(const std::string& line) {
    std::vector<std::string> fields;
    std::string field;
    std::istringstream stream(line);
    while (std::getline(stream, field, ',')) fields.push_back(trim(field));
    if (!line.empty() && line.back() == ',') fields.emplace_back();  // "Ana,4," has an empty 3rd field
    return fields;
}

std::string lower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return s;
}

// std::from_chars reads numbers the same way on every computer. std::stod would follow the
// system language, so "4.5" could fail on a PC set up for a country that writes "4,5".
bool parse_number(const std::string& text, double& out) {
    const char* first = text.data();
    const char* last = text.data() + text.size();
    auto [ptr, ec] = std::from_chars(first, last, out);
    return ec == std::errc() && ptr == last;
}

// Prints 4.5 as "4.5" and 4.0 as "4", instead of "4.500000".
std::string number(double value) {
    char buffer[32];
    std::snprintf(buffer, sizeof buffer, "%.2f", value);
    std::string s = buffer;
    while (s.back() == '0') s.pop_back();
    if (s.back() == '.') s.pop_back();
    if (s == "-0") s = "0";
    return s;
}

std::string json_string(const std::string& s) {
    std::string out = "\"";
    for (unsigned char c : s) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20) {
                    char buffer[8];
                    std::snprintf(buffer, sizeof buffer, "\\u%04x", c);
                    out += buffer;
                } else {
                    out += static_cast<char>(c);  // UTF-8 names pass through unchanged
                }
        }
    }
    return out + "\"";
}

}  // namespace

std::vector<Player> read_players_csv(std::istream& in) {
    std::vector<Player> players;
    std::string line;
    int line_number = 0;
    bool first_content_line = true;
    while (std::getline(in, line)) {
        ++line_number;
        if (line_number == 1 && line.rfind("\xEF\xBB\xBF", 0) == 0) line.erase(0, 3);  // Excel's UTF-8 marker
        if (!line.empty() && line.back() == '\r') line.pop_back();                       // Windows line endings
        std::string trimmed = trim(line);
        if (trimmed.empty() || trimmed[0] == '#') continue;

        auto fields = split_commas(trimmed);
        if (first_content_line) {
            first_content_line = false;
            if (lower(fields[0]) == "name") continue;  // header row
        }

        auto where = "Line " + std::to_string(line_number) + ": ";
        if (fields.size() < 2 || fields.size() > 3) {
            throw std::invalid_argument(where + "expected name,skill or name,skill,party but got \"" + trimmed + "\".");
        }
        Player p;
        p.name = fields[0];
        if (p.name.empty()) throw std::invalid_argument(where + "the name is missing.");
        if (!parse_number(fields[1], p.skill) || p.skill < 0) {
            throw std::invalid_argument(where + "\"" + fields[1] + "\" isn't a skill. Use a number like 3 or 4.5.");
        }
        if (fields.size() == 3) p.party = fields[2];
        players.push_back(std::move(p));
    }
    return players;
}

std::string format_text(const Result& result) {
    std::size_t width = 4;
    for (const auto& team : result.teams)
        for (const auto& p : team.players) width = std::max(width, p.name.size());

    std::ostringstream out;
    for (std::size_t t = 0; t < result.teams.size(); ++t) {
        const auto& team = result.teams[t];
        out << "Team " << (t + 1) << "  (" << team.players.size() << " players, total skill "
            << number(team.total) << ")\n";
        for (const auto& p : team.players) {
            out << "  " << p.name << std::string(width - p.name.size() + 2, ' ') << number(p.skill);
            if (!p.party.empty()) out << "  [" << p.party << "]";
            out << "\n";
        }
        out << "\n";
    }
    out << "Difference between the strongest and weakest team: " << number(result.spread)
        << (result.proven_best ? " (the best possible)\n" : " (best found in time; there may be a closer split)\n");
    return out.str();
}

std::string format_json(const Result& result) {
    std::ostringstream out;
    out << "{\"spread\":" << number(result.spread)
        << ",\"proven_best\":" << (result.proven_best ? "true" : "false")
        << ",\"teams\":[";
    for (std::size_t t = 0; t < result.teams.size(); ++t) {
        const auto& team = result.teams[t];
        if (t) out << ",";
        out << "{\"total\":" << number(team.total) << ",\"players\":[";
        for (std::size_t i = 0; i < team.players.size(); ++i) {
            const auto& p = team.players[i];
            if (i) out << ",";
            out << "{\"name\":" << json_string(p.name) << ",\"skill\":" << number(p.skill);
            if (!p.party.empty()) out << ",\"party\":" << json_string(p.party);
            out << "}";
        }
        out << "]}";
    }
    out << "]}\n";
    return out.str();
}

}  // namespace teams
