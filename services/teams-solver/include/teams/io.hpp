// Reading players from a CSV file and writing the teams out as text or JSON.

#pragma once

#include <istream>
#include <string>
#include <vector>

#include "teams/solver.hpp"

namespace teams {

// One player per line:   name,skill[,party]
//   Ana,4.5
//   Ben,3,ben-and-cal
// A first line starting with "name" is treated as a header and skipped. Blank lines and
// lines starting with # are ignored. Throws std::invalid_argument naming the bad line.
std::vector<Player> read_players_csv(std::istream& in);

// A table for people to read in a terminal.
std::string format_text(const Result& result);

// JSON for other programs (the Python tools, or the app later on).
std::string format_json(const Result& result);

}  // namespace teams
