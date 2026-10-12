#include "check.hpp"

int main() {
    int failed_tests = 0;
    for (const auto& test : check::registry()) {
        int before = check::failures();
        try {
            test.body();
        } catch (const std::exception& e) {
            check::fail(test.name, 0, std::string("unexpected error: ") + e.what());
        }
        bool passed = check::failures() == before;
        if (!passed) ++failed_tests;
        std::cout << (passed ? "ok    " : "FAIL  ") << test.name << "\n";
    }
    std::cout << "\n" << check::registry().size() << " tests, " << failed_tests << " failed\n";
    return failed_tests == 0 ? 0 : 1;
}
