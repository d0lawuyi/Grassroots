// balance-teams: the command line around the solver.
//
//   balance-teams examples/pickup.csv
//   balance-teams --teams 3 --json examples/pickup.csv
//   type examples\pickup.csv | balance-teams        (reads the players from the keyboard/pipe)

#include <cstdlib>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>

#include "teams/io.hpp"
#include "teams/solver.hpp"

namespace {

constexpr const char* kUsage =
    "Usage: balance-teams [--teams N] [--json] [players.csv]\n"
    "\n"
    "Splits players into fair teams: sizes differ by at most one, total skill as even as\n"
    "possible, and players in the same party stay together.\n"
    "\n"
    "  players.csv   one player per line: name,skill[,party]  (reads standard input if left out)\n"
    "  --teams N     number of teams (default 2)\n"
    "  --json        print JSON instead of a table\n";

int parse_team_count(const std::string& text) {
    try {
        std::size_t used = 0;
        int value = std::stoi(text, &used);
        if (used == text.size()) return value;
    } catch (const std::exception&) {
    }
    throw std::invalid_argument("--teams needs a whole number, like --teams 3.");
}

}  // namespace

int main(int argc, char* argv[]) {
    teams::Options options;
    bool json = false;
    std::string path;

    try {
        for (int i = 1; i < argc; ++i) {
            std::string arg = argv[i];
            if (arg == "-h" || arg == "--help") {
                std::cout << kUsage;
                return 0;
            } else if (arg == "--json") {
                json = true;
            } else if (arg == "--teams") {
                if (i + 1 >= argc) throw std::invalid_argument("--teams needs a number after it.");
                options.team_count = parse_team_count(argv[++i]);
            } else if (arg.rfind("--", 0) == 0) {
                throw std::invalid_argument("Unknown option " + arg + ". Try --help.");
            } else if (path.empty()) {
                path = arg;
            } else {
                throw std::invalid_argument("Give one players file, not two.");
            }
        }

        std::vector<teams::Player> players;
        if (path.empty()) {
            players = teams::read_players_csv(std::cin);
        } else {
            std::ifstream file(path);
            if (!file) throw std::invalid_argument("Can't open " + path + ".");
            players = teams::read_players_csv(file);
        }

        teams::Result result = teams::balance(players, options);
        std::cout << (json ? teams::format_json(result) : teams::format_text(result));
        return 0;
    } catch (const std::invalid_argument& e) {
        std::cerr << "balance-teams: " << e.what() << "\n";
        return 2;  // 2 = the input was wrong, so a script calling this can tell it apart from a crash
    }
}
