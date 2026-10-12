// A tiny test framework, so the tests need nothing but a C++ compiler.
//
//   TEST(name) { CHECK(1 + 1 == 2); CHECK_THROWS(f(), "part of the message"); }
//
// Each TEST registers itself before main() runs (via a static object), and test_main.cpp
// runs them all and reports how many failed. Bigger projects use GoogleTest or Catch2,
// which work the same way with more features.

#pragma once

#include <functional>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

namespace check {

struct Case {
    const char* name;
    std::function<void()> body;
};

inline std::vector<Case>& registry() {
    static std::vector<Case> cases;
    return cases;
}

inline int& failures() {
    static int count = 0;
    return count;
}

struct Register {
    Register(const char* name, std::function<void()> body) { registry().push_back({name, std::move(body)}); }
};

inline void fail(const char* file, int line, const std::string& what) {
    ++failures();
    std::cerr << "  FAILED " << file << ":" << line << "  " << what << "\n";
}

}  // namespace check

#define CHECK_CONCAT_(a, b) a##b
#define CHECK_CONCAT(a, b) CHECK_CONCAT_(a, b)

#define TEST(name)                                                                  \
    static void name();                                                             \
    static const check::Register CHECK_CONCAT(register_, name)(#name, name);        \
    static void name()

#define CHECK(condition)                                                            \
    do {                                                                            \
        if (!(condition)) check::fail(__FILE__, __LINE__, #condition);              \
    } while (false)

#define CHECK_THROWS(expression, message_part)                                      \
    do {                                                                            \
        try {                                                                       \
            (void)(expression);                                                     \
            check::fail(__FILE__, __LINE__, "expected an error from " #expression); \
        } catch (const std::invalid_argument& e) {                                  \
            if (std::string(e.what()).find(message_part) == std::string::npos)      \
                check::fail(__FILE__, __LINE__,                                     \
                            std::string("error message was: ") + e.what());         \
        }                                                                           \
    } while (false)
