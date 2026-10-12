# Build:   cmake -B build
#          cmake --build build --config Release
# Test:    ctest --test-dir build -C Release --output-on-failure
cmake_minimum_required(VERSION 3.20)
project(teams_solver LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE Release)
endif()

# Turn on the compiler's warnings, and treat them as errors so they get fixed, not ignored.
if(MSVC)
  set(WARNINGS /W4 /WX /permissive- /utf-8)
else()
  # -Wno-sign-conversion: Clang's -Wconversion also flags every vector[int] index; that's noise here.
  set(WARNINGS -Wall -Wextra -Wpedantic -Wshadow -Wconversion -Wno-sign-conversion -Werror)
endif()

# The solver is a library, so the command line and the tests share the same code.
add_library(teams src/solver.cpp src/io.cpp)
target_include_directories(teams PUBLIC include)
target_compile_options(teams PRIVATE ${WARNINGS})

add_executable(balance-teams src/main.cpp)
target_link_libraries(balance-teams PRIVATE teams)
target_compile_options(balance-teams PRIVATE ${WARNINGS})

enable_testing()
add_executable(teams-tests tests/test_main.cpp tests/test_solver.cpp tests/test_io.cpp)
target_link_libraries(teams-tests PRIVATE teams)
target_compile_options(teams-tests PRIVATE ${WARNINGS})
add_test(NAME teams-tests COMMAND teams-tests)

# A quick end-to-end check that the program runs on the example file.
add_test(NAME example-runs COMMAND balance-teams ${CMAKE_CURRENT_SOURCE_DIR}/examples/pickup.csv)
set_tests_properties(example-runs PROPERTIES PASS_REGULAR_EXPRESSION "the best possible")
