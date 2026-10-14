# Grassroots balanced teams (C++)

Splits the players who joined a game into fair teams:

- Team sizes differ by at most one player.
- The total skill of the strongest and weakest team is as close as possible.
- Players who came together (same **party**) always end up on the same team.

```
> balance-teams examples\pickup.csv

Team 1  (5 players, total skill 17.5)
  Ana          4.5
  Ines Ortiz   4  [ortiz]
  Fay          3.5
  Lucia Ortiz  3  [ortiz]
  Gus          2.5

Team 2  (6 players, total skill 17.5)
  Dee          5
  Nia          4
  Ben          3  [ben-and-cal]
  Cal          2  [ben-and-cal]
  Mo           2
  Eli          1.5

Difference between the strongest and weakest team: 0 (the best possible)
```

Standard C++20 only, no extra libraries. It's a command-line program for now. Later the
app can use it from a Supabase function, or it can be compiled to WebAssembly and run on
the phone.

---

## Build it on Windows

You need two things: a C++ compiler and CMake.

**1. Install Visual Studio Build Tools** (free, about 3 GB). In PowerShell:

```
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

This includes the Microsoft C++ compiler (MSVC) and CMake. If you'd rather click through
the installer, download **Build Tools for Visual Studio** from visualstudio.microsoft.com
and tick **Desktop development with C++**.

**2. Open the right terminal.** From the Start menu, open **Developer PowerShell for VS 2022**
(a normal PowerShell window doesn't know where the compiler is). Check it worked:

```
cmake --version
```

If it says `cmake` is not recognized, see which Visual Studio tools are installed. This
works in any PowerShell window:

```
& "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -products * -property displayName
```

- Nothing printed, or "path not found": the Build Tools aren't installed yet. Run the
  `winget` command in step 1 and wait for it to finish.
- It prints **Visual Studio Build Tools 2022** but cmake still isn't found: the C++ part is
  missing. Open **Visual Studio Installer**, click **Modify** next to Build Tools 2022, tick
  **Desktop development with C++**, then **Modify**.

**3. Build and test**, from the Grassroots folder:

```
cd services\teams-solver
cmake -S . -B build
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

You should see `100% tests passed`. To see each test by name, run
`.\build\Release\teams-tests.exe`.

**4. Try it:**

```
.\build\Release\balance-teams.exe examples\pickup.csv
.\build\Release\balance-teams.exe --teams 3 examples\pickup.csv
.\build\Release\balance-teams.exe --json examples\pickup.csv
```

PowerShell needs the `.\` at the start to run a program from the current folder.
The `build` folder is ignored by git. Delete it any time to start a build from scratch.

## The players file

One player per line, `name,skill` or `name,skill,party`. Make one in Excel and
**Save As > CSV UTF-8**, or in Notepad:

```
name,skill,party
Ana,4.5
Ben,3,ben-and-cal
Cal,2,ben-and-cal
```

- **skill**: 1 (new) to 5 (very strong) works well. Halves like 3.5 are fine.
- **party**: any word. Everyone with the same word plays together. Leave it empty for solo
  players.
- A header line, blank lines and lines starting with `#` are skipped.

If something's wrong, the program names the line, for example
`Line 7: "great" isn't a skill. Use a number like 3 or 4.5.`

---

## How it works

The code is in `src/solver.cpp`. It takes three steps:

**1. Units.** A party becomes one unit, and each solo player is a unit of one. After this
the solver only moves whole units, so a party can't be split by mistake.

**2. Greedy guess.** It sorts units biggest and strongest first, and puts each one into the
weakest team that still has room. This takes microseconds and is usually close to the best
answer, but not always.

**3. Branch and bound.** This is the exact part. Picture a tree: unit 1 can go in team A or
B, then unit 2 in A or B, and so on. With 20 players and 2 teams that's about a million
leaves, and with 30 players and 3 teams it's about 200 trillion. Too many to visit, so the
solver skips any branch that can't possibly win:

- **Bound.** Teams only ever gain skill. If the strongest team is already 4 points above
  average, every split down that branch has a spread of at least 4. If the best split
  found so far is 1, the whole branch is skipped without being visited.
- **Symmetry.** Putting the first player in an empty team A or an empty team B gives the
  same splits with the names swapped, so only one is tried.
- **Good order.** Units go to the weakest team first, so good splits turn up early and more
  branches get skipped.
- **Knowing when to stop.** If skills are in half points and add up to an odd number of
  halves, a perfect split is impossible. A spread of 0.5 is then the best there is, and the
  search stops the moment it finds one.

If the search hits its step limit (2 million steps, under a second), it returns the best
split found so far and says so. `proven_best` in the JSON tells you which happened.

**How do we know it's right?** `tests/test_solver.cpp` has a `brute_force_spread` function
that tries every possible split: slow but obviously correct. One test creates 300 random
small games and checks that the fast solver always gets exactly the same answer. That's a
good habit for any clever algorithm: keep a slow, simple version to check it against.

## Code layout

```
services/teams-solver/
  CMakeLists.txt         how to build: the library, the program and the tests
  include/teams/
    solver.hpp           Player, Options, Team, Result and balance()
    io.hpp               reading CSV, writing text and JSON
  src/
    solver.cpp           the algorithm
    io.cpp               CSV parsing and output
    main.cpp             the balance-teams command line
  tests/
    check.hpp            a tiny test framework (TEST, CHECK, CHECK_THROWS)
    test_main.cpp        runs every test
    test_solver.cpp      solver tests, including the brute-force comparison
    test_io.cpp          CSV and output tests
  examples/pickup.csv
```

C++ ideas worth spotting as you read:

| Idea | Where |
|---|---|
| A header (`.hpp`) says what exists; the `.cpp` file says how it works | `include/teams/` vs `src/` |
| Anonymous `namespace { }` keeps helper functions private to one file | top of each `.cpp` |
| Change state in place and undo it on the way back, instead of copying | `Search::run` |
| Structured bindings: `auto [lo, hi] = std::minmax_element(...)` | `solver.cpp` |
| Designated initializers: `{.team_count = 3}` (C++20) | `test_solver.cpp` |
| `std::from_chars` reads numbers the same way in every country | `io.cpp`, `parse_number` |
| Macros and static objects that register tests before `main` runs | `tests/check.hpp` |

## CI

Every pull request builds and tests this twice (the **C++ teams solver** checks):

- **Linux with GCC, plus sanitizers.** AddressSanitizer and UndefinedBehaviorSanitizer stop
  the tests on memory mistakes, such as reading past the end of a vector, that might
  otherwise seem to work.
- **Windows with MSVC.** The same compiler as your PC.

Compiler warnings count as errors in both.

## Good first exercises

1. Run `balance-teams` on a file where one party is too big for a team. Read the error, then
   find the line in `solver.cpp` that produces it.
2. With 20 players (teams of 10) whose skills are only 1, 2.5 and 4, every spread is a
   multiple of 1.5, so 1.5 is often the best possible. The solver finds it but can't
   *prove* it, because it only knows steps like 1, 0.5 and 0.25. Change
   `best_possible_spread` to use the greatest common divisor of the skill differences
   instead. Write the failing test first.
3. Add `--max-steps N` to `main.cpp` to set `Options::step_limit`. Try `--max-steps 10` on a
   big file and watch `proven_best` turn false.
4. Add a second goal: when two splits have the same spread, prefer the one where each team
   has a similar number of strong (4+) players.
