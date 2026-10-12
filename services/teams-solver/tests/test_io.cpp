#include <sstream>
#include <string>

#include "check.hpp"
#include "teams/io.hpp"

namespace {

std::vector<teams::Player> parse(const std::string& text) {
    std::istringstream in(text);
    return teams::read_players_csv(in);
}

bool contains(const std::string& haystack, const std::string& needle) {
    return haystack.find(needle) != std::string::npos;
}

}  // namespace

TEST(reads_players_with_header_comments_and_parties) {
    auto players = parse(
        "# Thursday game\n"
        "name,skill,party\n"
        "Ana, 4.5\n"
        "\n"
        "Ben,3,friends\n"
        "Cal,2,friends\n");
    CHECK(players.size() == 3);
    CHECK(players[0].name == "Ana");
    CHECK(players[0].skill == 4.5);
    CHECK(players[0].party.empty());
    CHECK(players[2].party == "friends");
}

TEST(reads_files_saved_by_excel_on_windows) {
    auto players = parse("\xEF\xBB\xBFName,Skill\r\nAna,4\r\nBen,3\r\n");
    CHECK(players.size() == 2);
    CHECK(players[1].name == "Ben");
    CHECK(players[1].skill == 3);
}

TEST(trailing_comma_means_no_party) {
    auto players = parse("Ana,4,\n");
    CHECK(players.size() == 1);
    CHECK(players[0].party.empty());
}

TEST(bad_lines_name_the_line_number) {
    CHECK_THROWS(parse("name,skill\nAna,4\nBen,great\n"), "Line 3: \"great\" isn't a skill");
    CHECK_THROWS(parse("Ana,-1\n"), "Line 1:");
    CHECK_THROWS(parse("Ana\n"), "Line 1: expected name,skill");
    CHECK_THROWS(parse("Ana,4,x,y\n"), "Line 1: expected name,skill");
    CHECK_THROWS(parse(",4\n"), "Line 1: the name is missing");
}

TEST(text_output_reads_well) {
    auto r = teams::balance(parse("Ana,4\nBen,3\nCal,3\nDee,2\n"));
    auto text = teams::format_text(r);
    CHECK(contains(text, "Team 1  (2 players, total skill 6)"));
    CHECK(contains(text, "Team 2  (2 players, total skill 6)"));
    CHECK(contains(text, "Difference between the strongest and weakest team: 0 (the best possible)"));
}

TEST(json_output_escapes_names) {
    auto r = teams::balance(parse("Ana \"The Wall\",4.5\nBen,3\n"));
    auto json = teams::format_json(r);
    CHECK(contains(json, "\"name\":\"Ana \\\"The Wall\\\"\",\"skill\":4.5"));
    CHECK(contains(json, "\"spread\":1.5,\"proven_best\":true"));
}
