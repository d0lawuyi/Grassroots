// Balanced teams: split the players who joined a game into fair teams.
//
// "Fair" means two things here:
//   1. Team sizes differ by at most one player.
//   2. The difference between the strongest and weakest team's total skill (the "spread")
//      is as small as possible.
// Players who sign up together (same "party", e.g. friends) always land on the same team.

#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace teams {

struct Player {
    std::string name;
    double skill = 0;     // any non-negative number; the app uses 1 (new) to 5 (very strong)
    std::string party;    // players with the same non-empty party stay together
};

struct Options {
    int team_count = 2;
    // The exact search stops after this many steps and returns the best split found so far.
    // 2 million steps is well under a second and settles any normal pickup game.
    std::int64_t step_limit = 2'000'000;
};

struct Team {
    std::vector<Player> players;  // strongest first
    double total = 0;
};

struct Result {
    std::vector<Team> teams;
    double spread = 0;            // strongest team total minus weakest team total
    bool proven_best = false;     // true if no better split exists; false if the step limit was hit
    std::int64_t steps = 0;       // how much searching it took (useful when learning about pruning)
};

// Throws std::invalid_argument with a plain-English message when the players can't be split,
// for example fewer players than teams, a negative skill, or a party bigger than a team.
Result balance(const std::vector<Player>& players, const Options& options = {});

}  // namespace teams
