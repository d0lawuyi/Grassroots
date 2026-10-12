// How the solver works
//
// 1. Group players into "units": a party is one unit, everyone else is a unit of one.
//    From here on the solver only moves whole units, so parties can never be split.
// 2. Greedy first guess: biggest and strongest units first, each into the weakest team that
//    still has room. Fast, and usually close to the best answer.
// 3. Exact search (branch and bound): try every way of placing the units, but skip any
//    branch that provably can't beat the best split found so far. The greedy guess gives
//    the search a good target from the start, so it can skip a lot. It also stops early
//    once it reaches the best spread that's mathematically possible.
//
// Team sizes: with n players and k teams, every team gets n/k or n/k + 1 players
// (rounded down), so sizes never differ by more than one.

#include "teams/solver.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <map>
#include <numeric>
#include <stdexcept>

namespace teams {
namespace {

constexpr double kEpsilon = 1e-9;  // skills can have decimals, so compare with a little slack

struct Unit {
    std::vector<int> members;  // indexes into the players list
    int size = 0;
    double skill = 0;
};

// The search keeps one of these and changes it in place, undoing each move on the way back.
// That's much faster than copying the whole state at every step.
struct Search {
    const std::vector<Unit>& units;
    int team_count;
    int min_size;     // n / k
    int max_size;     // n / k, plus one if it doesn't divide evenly
    double average;   // total skill / k
    std::int64_t step_limit;
    double target = 0;  // no split can beat this, so the search stops as soon as it gets here

    std::vector<int> team_of;        // unit index -> team
    std::vector<double> totals;      // team -> skill so far
    std::vector<int> sizes;          // team -> players so far
    std::vector<double> skill_after; // skill_after[u] = skill of units u, u+1, ... (not placed yet)
    std::vector<int> players_after;  // same, counting players

    std::vector<int> best_team_of;
    double best_spread = std::numeric_limits<double>::infinity();
    std::int64_t steps = 0;
    bool stopped = false;

    Search(const std::vector<Unit>& units_, int k, int min_s, int max_s, double avg, std::int64_t limit)
        : units(units_), team_count(k), min_size(min_s), max_size(max_s), average(avg), step_limit(limit),
          team_of(units_.size(), -1), totals(k, 0.0), sizes(k, 0),
          skill_after(units_.size() + 1, 0.0), players_after(units_.size() + 1, 0) {
        for (int u = static_cast<int>(units.size()) - 1; u >= 0; --u) {
            skill_after[u] = skill_after[u + 1] + units[u].skill;
            players_after[u] = players_after[u + 1] + units[u].size;
        }
    }

    double spread() const {
        auto [lo, hi] = std::minmax_element(totals.begin(), totals.end());
        return *hi - *lo;
    }

    // Every team must end up with at least min_size players. If the players still to place
    // can't fill the gaps, this branch is a dead end.
    bool can_still_fill(int next_unit) const {
        int missing = 0;
        for (int s : sizes) missing += std::max(0, min_size - s);
        return missing <= players_after[next_unit];
    }

    // The smallest spread any finished split from here could have. If even that isn't
    // better than the best split already found, there's no point searching this branch.
    //   - Teams only get stronger, so the strongest team ends at least at today's maximum,
    //     and the weakest team can't end above the average. Spread >= max - average.
    //   - The weakest team can at most gain everything that's left, and the strongest team
    //     ends at least at the average. Spread >= average - (min + everything left).
    double lower_bound(int next_unit) const {
        auto [lo, hi] = std::minmax_element(totals.begin(), totals.end());
        double bound = std::max(*hi - average, average - (*lo + skill_after[next_unit]));
        return std::max(0.0, bound);
    }

    void run(int u) {
        if (stopped) return;
        if (++steps > step_limit) {
            stopped = true;
            return;
        }
        if (u == static_cast<int>(units.size())) {
            double s = spread();
            if (s < best_spread - kEpsilon) {
                best_spread = s;
                best_team_of = team_of;
            }
            return;
        }
        if (best_spread <= target + kEpsilon) return;  // already as good as it gets
        if (lower_bound(u) >= best_spread - kEpsilon) return;

        // Try the weakest teams first: good splits turn up sooner, so more branches get skipped.
        std::vector<int> order(team_count);
        std::iota(order.begin(), order.end(), 0);
        std::stable_sort(order.begin(), order.end(), [&](int a, int b) { return totals[a] < totals[b]; });

        bool tried_empty_team = false;
        for (int t : order) {
            if (sizes[t] + units[u].size > max_size) continue;
            // Empty teams are interchangeable: putting this unit in empty team 2 or empty
            // team 3 gives the same splits with the names swapped. Try only one of them.
            if (sizes[t] == 0) {
                if (tried_empty_team) continue;
                tried_empty_team = true;
            }
            team_of[u] = t;
            totals[t] += units[u].skill;
            sizes[t] += units[u].size;
            if (can_still_fill(u + 1)) run(u + 1);
            sizes[t] -= units[u].size;
            totals[t] -= units[u].skill;
            team_of[u] = -1;
            if (stopped) return;
        }
    }
};

// Biggest units first, then strongest, each into the weakest team with room.
// Returns an empty vector if this simple method can't produce valid team sizes.
std::vector<int> greedy(const std::vector<Unit>& units, int k, int min_size, int max_size) {
    std::vector<int> team_of(units.size(), -1);
    std::vector<double> totals(k, 0.0);
    std::vector<int> sizes(k, 0);
    for (std::size_t u = 0; u < units.size(); ++u) {
        int pick = -1;
        for (int t = 0; t < k; ++t) {
            if (sizes[t] + units[u].size > max_size) continue;
            if (pick < 0 || totals[t] < totals[pick] - kEpsilon ||
                (std::abs(totals[t] - totals[pick]) <= kEpsilon && sizes[t] < sizes[pick])) {
                pick = t;
            }
        }
        if (pick < 0) return {};
        team_of[u] = pick;
        totals[pick] += units[u].skill;
        sizes[pick] += units[u].size;
    }
    for (int s : sizes) {
        if (s < min_size) return {};
    }
    return team_of;
}

// The best spread any split could possibly reach, without searching.
// If every skill is a multiple of some step (say 0.5), then every team total and every spread
// is too. A spread of 0 needs the total to divide evenly into k teams, in whole steps. If it
// doesn't, the best possible is one step. Knowing this lets the search stop the moment it
// finds a one-step split, instead of hunting for a perfect split that can't exist.
double best_possible_spread(const std::vector<Unit>& units, int k) {
    for (double step : {1.0, 0.5, 0.25, 0.1, 0.05, 0.01}) {
        double total_steps = 0;
        bool whole = true;
        for (const auto& u : units) {
            double steps = u.skill / step;
            if (std::abs(steps - std::round(steps)) > 1e-6) {
                whole = false;
                break;
            }
            total_steps += std::round(steps);
        }
        if (!whole) continue;
        return std::fmod(total_steps, k) == 0 ? 0.0 : step;
    }
    return 0.0;  // skills too fine-grained to reason about: only a perfect split ends early
}

std::string describe_party(const std::string& party) { return "The party \"" + party + "\""; }

}  // namespace

Result balance(const std::vector<Player>& players, const Options& options) {
    const int k = options.team_count;
    const int n = static_cast<int>(players.size());
    if (k < 2) throw std::invalid_argument("Pick at least 2 teams.");
    if (n < k) {
        throw std::invalid_argument("There are " + std::to_string(n) + " players, not enough for " +
                                    std::to_string(k) + " teams.");
    }
    for (const auto& p : players) {
        if (!std::isfinite(p.skill) || p.skill < 0) {
            throw std::invalid_argument(p.name + "'s skill must be a number of 0 or more.");
        }
    }

    const int min_size = n / k;
    const int max_size = n / k + (n % k == 0 ? 0 : 1);

    // 1. Units. std::map keeps parties in alphabetical order so results never depend on luck.
    std::vector<Unit> units;
    std::map<std::string, int> party_unit;
    for (int i = 0; i < n; ++i) {
        const auto& party = players[i].party;
        int u;
        if (party.empty()) {
            u = static_cast<int>(units.size());
            units.emplace_back();
        } else {
            auto [it, added] = party_unit.try_emplace(party, static_cast<int>(units.size()));
            if (added) units.emplace_back();
            u = it->second;
        }
        units[u].members.push_back(i);
        units[u].size += 1;
        units[u].skill += players[i].skill;
    }
    for (const auto& [party, u] : party_unit) {
        if (units[u].size > max_size) {
            throw std::invalid_argument(describe_party(party) + " has " + std::to_string(units[u].size) +
                                        " players, but each team only has room for " +
                                        std::to_string(max_size) + ".");
        }
    }
    std::stable_sort(units.begin(), units.end(), [](const Unit& a, const Unit& b) {
        if (a.size != b.size) return a.size > b.size;
        return a.skill > b.skill;
    });

    const double total = std::accumulate(units.begin(), units.end(), 0.0,
                                         [](double sum, const Unit& u) { return sum + u.skill; });

    // 2. Greedy guess, 3. exact search seeded with it.
    Search search(units, k, min_size, max_size, total / k, options.step_limit);
    search.target = best_possible_spread(units, k);
    if (auto guess = greedy(units, k, min_size, max_size); !guess.empty()) {
        search.best_team_of = guess;
        std::vector<double> totals(k, 0.0);
        for (std::size_t u = 0; u < units.size(); ++u) totals[guess[u]] += units[u].skill;
        auto [lo, hi] = std::minmax_element(totals.begin(), totals.end());
        search.best_spread = *hi - *lo;
    }
    search.run(0);

    if (search.best_team_of.empty()) {
        throw std::invalid_argument(search.stopped
            ? "Couldn't find even team sizes in time. Try splitting up a big party."
            : "These parties can't be split into teams whose sizes differ by at most one. "
              "Try splitting up a big party.");
    }

    Result result;
    result.teams.resize(k);
    for (std::size_t u = 0; u < units.size(); ++u) {
        Team& team = result.teams[search.best_team_of[u]];
        for (int i : units[u].members) {
            team.players.push_back(players[i]);
            team.total += players[i].skill;
        }
    }
    for (auto& team : result.teams) {
        std::stable_sort(team.players.begin(), team.players.end(),
                         [](const Player& a, const Player& b) { return a.skill > b.skill; });
    }
    // Strongest team first, so the output reads the same way every time.
    std::stable_sort(result.teams.begin(), result.teams.end(),
                     [](const Team& a, const Team& b) { return a.total > b.total; });

    result.spread = result.teams.front().total - result.teams.back().total;
    if (std::abs(result.spread) < kEpsilon) result.spread = 0;
    result.proven_best = !search.stopped;
    result.steps = search.steps;
    return result;
}

}  // namespace teams
