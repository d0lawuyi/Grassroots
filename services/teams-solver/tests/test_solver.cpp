#include <algorithm>
#include <cmath>
#include <cstdint>
#include <limits>
#include <map>
#include <random>
#include <set>
#include <string>
#include <vector>

#include "check.hpp"
#include "teams/solver.hpp"

using teams::Player;

namespace {

bool near(double a, double b) { return std::abs(a - b) < 1e-9; }

std::vector<Player> make(const std::vector<double>& skills) {
    std::vector<Player> players;
    for (std::size_t i = 0; i < skills.size(); ++i) {
        players.push_back({"P" + std::to_string(i + 1), skills[i], ""});
    }
    return players;
}

// Checks the rules every result must follow, whatever the input.
void check_valid(const std::vector<Player>& players, const teams::Result& r, int k) {
    CHECK(static_cast<int>(r.teams.size()) == k);
    std::size_t smallest = players.size(), largest = 0, count = 0;
    std::map<std::string, std::set<int>> teams_of_party;
    for (int t = 0; t < k; ++t) {
        const auto& team = r.teams[t];
        smallest = std::min(smallest, team.players.size());
        largest = std::max(largest, team.players.size());
        count += team.players.size();
        double total = 0;
        for (const auto& p : team.players) {
            total += p.skill;
            if (!p.party.empty()) teams_of_party[p.party].insert(t);
        }
        CHECK(near(total, team.total));
    }
    CHECK(count == players.size());
    CHECK(largest - smallest <= 1);
    for (const auto& [party, team_set] : teams_of_party) CHECK(team_set.size() == 1);
    double hi = r.teams.front().total, lo = r.teams.back().total;
    for (const auto& team : r.teams) {
        hi = std::max(hi, team.total);
        lo = std::min(lo, team.total);
    }
    CHECK(near(r.spread, hi - lo));
}

// The slow, obviously-correct answer: try every possible assignment of players to teams.
// Only usable for small games (k^n tries), but perfect for checking the fast solver.
double brute_force_spread(const std::vector<Player>& players, int k) {
    const int n = static_cast<int>(players.size());
    const int min_size = n / k, max_size = (n + k - 1) / k;
    double best = std::numeric_limits<double>::infinity();
    std::vector<int> team(n, 0);
    while (true) {
        std::vector<double> totals(k, 0);
        std::vector<int> sizes(k, 0);
        std::map<std::string, int> party_team;
        bool ok = true;
        for (int i = 0; i < n && ok; ++i) {
            totals[team[i]] += players[i].skill;
            sizes[team[i]] += 1;
            if (!players[i].party.empty()) {
                auto [it, added] = party_team.try_emplace(players[i].party, team[i]);
                if (!added && it->second != team[i]) ok = false;
            }
        }
        for (int s : sizes) ok = ok && s >= min_size && s <= max_size;
        if (ok) {
            auto [lo, hi] = std::minmax_element(totals.begin(), totals.end());
            best = std::min(best, *hi - *lo);
        }
        int i = 0;  // count up in base k: the next assignment
        while (i < n && ++team[i] == k) team[i++] = 0;
        if (i == n) break;
    }
    return best;
}

}  // namespace

TEST(splits_evenly_when_a_perfect_split_exists) {
    auto players = make({5, 4, 3, 3, 2, 1});  // 5+3+1 = 4+3+2 = 9
    auto r = teams::balance(players);
    check_valid(players, r, 2);
    CHECK(r.spread == 0);
    CHECK(r.proven_best);
    CHECK(r.teams[0].players.size() == 3);
}

TEST(odd_number_of_players_gives_sizes_one_apart) {
    auto players = make({5, 4, 3, 2, 1});
    auto r = teams::balance(players);
    check_valid(players, r, 2);
    CHECK(near(r.spread, 1));  // 15 total can't split evenly
}

TEST(team_sizes_matter_more_than_skill) {
    // Without the size rule, {10} vs {1,1,1,1,1,1,1,1,1,1} would be "perfectly balanced".
    auto players = make({10, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1});
    auto r = teams::balance(players);
    check_valid(players, r, 2);
    // Best allowed: {10,1,1,1,1} = 14 (5 players) vs six 1s = 6 (6 players).
    CHECK(near(r.spread, 8));
    CHECK(near(r.spread, brute_force_spread(players, 2)));
}

TEST(three_teams) {
    auto players = make({5, 5, 4, 4, 3, 3, 2, 2, 1});  // 29 total, 3 players each
    auto r = teams::balance(players, {.team_count = 3});
    check_valid(players, r, 3);
    CHECK(near(r.spread, brute_force_spread(players, 3)));
    CHECK(r.proven_best);
}

TEST(party_members_stay_together) {
    std::vector<Player> players = {
        {"Ana", 5, "friends"}, {"Ben", 5, "friends"},  // the two strongest want to play together
        {"Cal", 3, ""}, {"Dee", 3, ""}, {"Eli", 2, ""}, {"Fay", 2, ""},
    };
    auto r = teams::balance(players);
    check_valid(players, r, 2);
    CHECK(near(r.spread, brute_force_spread(players, 2)));  // 5+5+2=12 vs 3+3+2=8 -> 4
    CHECK(near(r.spread, 4));
}

TEST(party_too_big_for_a_team_is_an_error) {
    std::vector<Player> players = {
        {"A", 3, "crew"}, {"B", 3, "crew"}, {"C", 3, "crew"}, {"D", 3, ""}, {"E", 3, ""}, {"F", 3, ""},
        {"G", 3, "crew"},
    };
    auto r = teams::balance(players);  // 7 players: teams of 4 and 3, so a party of 4 just fits
    check_valid(players, r, 2);
    players.push_back({"H", 3, "crew"});  // now 5 in the party, but teams of 4
    CHECK_THROWS(teams::balance(players), "has 5 players, but each team only has room for 4");
}

TEST(parties_that_cant_make_even_sizes_are_an_error) {
    // 6 players in 4 teams means teams of 1 or 2. Three pairs fill three teams and leave
    // the fourth empty, so no split follows the size rule.
    std::vector<Player> players = {
        {"A", 1, "x"}, {"B", 1, "x"}, {"C", 1, "y"}, {"D", 1, "y"}, {"E", 1, "z"}, {"F", 1, "z"},
    };
    CHECK_THROWS(teams::balance(players, {.team_count = 4}), "can't be split");
}

TEST(bad_input_is_explained) {
    CHECK_THROWS(teams::balance(make({1, 2, 3}), {.team_count = 1}), "at least 2 teams");
    CHECK_THROWS(teams::balance(make({1, 2}), {.team_count = 3}), "not enough for 3 teams");
    CHECK_THROWS(teams::balance(make({1, -2, 3, 4})), "P2's skill");
    CHECK_THROWS(teams::balance(make({1, std::nan(""), 3, 4})), "P2's skill");
}

TEST(same_input_same_teams_every_time) {
    auto players = make({4, 4, 3, 3, 3, 2, 2, 1});
    auto a = teams::balance(players), b = teams::balance(players);
    for (std::size_t t = 0; t < a.teams.size(); ++t) {
        CHECK(a.teams[t].players.size() == b.teams[t].players.size());
        for (std::size_t i = 0; i < a.teams[t].players.size(); ++i)
            CHECK(a.teams[t].players[i].name == b.teams[t].players[i].name);
    }
}

TEST(step_limit_still_returns_valid_teams) {
    std::vector<double> skills;
    for (int i = 0; i < 30; ++i) skills.push_back(1 + (i * 7 % 9) * 0.5);
    auto players = make(skills);
    auto r = teams::balance(players, {.team_count = 3, .step_limit = 50});
    check_valid(players, r, 3);  // the greedy guess is used when the search runs out of steps
}

TEST(big_game_finishes_quickly) {
    // A full 11-a-side game plus subs: 26 players, 2 teams.
    std::vector<double> skills;
    for (int i = 0; i < 26; ++i) skills.push_back(1 + (i * 5 % 9) * 0.5);
    auto players = make(skills);
    auto r = teams::balance(players);
    check_valid(players, r, 2);
    CHECK(r.spread <= 0.5);
}

// The most important test: on hundreds of random small games, the fast solver must find
// exactly the same best spread as trying every possibility.
TEST(matches_brute_force_on_random_games) {
    std::mt19937 rng(20261011);  // fixed seed: the same "random" games on every run and computer
    for (int round = 0; round < 300; ++round) {
        int n = 4 + static_cast<int>(rng() % 6);  // 4 to 9 players
        int k = 2 + static_cast<int>(rng() % 2);  // 2 or 3 teams
        if (n < k) continue;
        std::vector<Player> players;
        for (int i = 0; i < n; ++i) {
            Player p{"P" + std::to_string(i), 1 + static_cast<double>(rng() % 9) * 0.5, ""};
            if (rng() % 4 == 0) p.party = "party" + std::to_string(rng() % 2);
            players.push_back(p);
        }
        double expected = brute_force_spread(players, k);
        if (std::isinf(expected)) {
            CHECK_THROWS(teams::balance(players, {.team_count = k}), "");
            continue;
        }
        teams::Result r;
        try {
            r = teams::balance(players, {.team_count = k});
        } catch (const std::invalid_argument& e) {
            check::fail(__FILE__, __LINE__, std::string("round ") + std::to_string(round) + ": " + e.what());
            continue;
        }
        check_valid(players, r, k);
        if (!near(r.spread, expected)) {
            check::fail(__FILE__, __LINE__, "round " + std::to_string(round) + ": spread " +
                        std::to_string(r.spread) + ", best possible " + std::to_string(expected));
        }
    }
}

TEST(stops_once_the_best_possible_spread_is_reached) {
    // 40 players, skills in half points, adding up to an odd number of half points: no
    // perfect split exists, so a 0.5 spread is the best possible. The solver should prove
    // that quickly instead of searching for a perfect split for ages.
    std::vector<double> skills;
    double total = 0;
    for (int i = 0; i < 40; ++i) {
        skills.push_back(1 + (i * 7 % 9) * 0.5);  // every half point from 1 to 5
        total += skills.back();
    }
    if (near(std::fmod(total * 2, 2), 0)) skills.back() += 0.5;  // make the half points odd
    auto players = make(skills);
    auto r = teams::balance(players);
    check_valid(players, r, 2);
    CHECK(near(r.spread, 0.5));
    CHECK(r.proven_best);
    CHECK(r.steps < 10'000);
}
