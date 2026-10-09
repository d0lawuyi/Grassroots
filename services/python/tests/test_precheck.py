import unittest

from grassroots_tools.precheck import evaluate

PARKS = [
    {"park_id": "p1", "name": "Central Green Field", "latitude": 39.7700, "longitude": -86.1600, "sports": ["soccer"], "hourly_rate": 40},
    {"park_id": "p2", "name": "Northside Turf", "latitude": 39.8500, "longitude": -86.1500, "sports": ["soccer"], "hourly_rate": 60},
    {"park_id": "p3", "name": "Southside Turf", "latitude": 39.7000, "longitude": -86.1500, "sports": ["soccer"], "hourly_rate": 50},
]

GOOD = {
    "submission_id": "s1",
    "name": "Westside Community Field",
    "sports": ["soccer"],
    "address": "100 Main St",
    "latitude": 39.7800,
    "longitude": -86.2500,
    "is_free": False,
    "hourly_rate": 55,
    "photos": ["a.jpg", "b.jpg", "c.jpg"],
    "proof_path": "owner/proof.pdf",
    "rules": "No cleats on the track.",
}
ADDRESS_MATCH = {"latitude": 39.7801, "longitude": -86.2501}


def levels(findings, check):
    return [f.level for f in findings if f.check == check]


class PrecheckTest(unittest.TestCase):
    def test_clean_submission_scores_100(self):
        total, findings = evaluate(GOOD, PARKS, ADDRESS_MATCH)
        self.assertEqual(total, 100)
        self.assertTrue(all(f.level == "ok" for f in findings))

    def test_missing_proof_is_flagged(self):
        total, findings = evaluate({**GOOD, "proof_path": None}, PARKS, ADDRESS_MATCH)
        self.assertEqual(levels(findings, "ownership"), ["flag"])
        self.assertEqual(total, 75)

    def test_pin_on_top_of_existing_venue_is_a_possible_duplicate(self):
        _, findings = evaluate({**GOOD, "latitude": 39.7701, "longitude": -86.1601}, PARKS, None)
        self.assertIn("flag", levels(findings, "location"))

    def test_pin_far_from_address_is_flagged(self):
        _, findings = evaluate(GOOD, PARKS, {"latitude": 39.90, "longitude": -86.25})
        self.assertIn("flag", levels(findings, "location"))

    def test_price_far_above_typical_is_flagged(self):
        _, findings = evaluate({**GOOD, "hourly_rate": 300}, PARKS, ADDRESS_MATCH)
        self.assertEqual(levels(findings, "pricing"), ["flag"])  # 300 is 6x the typical 50

    def test_paid_without_rate_is_flagged(self):
        _, findings = evaluate({**GOOD, "hourly_rate": None}, PARKS, ADDRESS_MATCH)
        self.assertEqual(levels(findings, "pricing"), ["flag"])

    def test_free_venue_passes_pricing(self):
        _, findings = evaluate({**GOOD, "is_free": True, "hourly_rate": None}, PARKS, ADDRESS_MATCH)
        self.assertEqual(levels(findings, "pricing"), ["ok"])

    def test_address_not_found_is_a_warning_but_skipped_lookup_is_not(self):
        _, not_found = evaluate(GOOD, PARKS, False)
        _, skipped = evaluate(GOOD, PARKS, None)
        self.assertEqual(levels(not_found, "location"), ["warn"])
        self.assertEqual(levels(skipped, "location"), ["ok"])

    def test_phone_number_in_rules_is_a_warning(self):
        _, findings = evaluate({**GOOD, "rules": "Text me at (317) 555-0199 to book"}, PARKS, ADDRESS_MATCH)
        self.assertIn("warn", levels(findings, "legitimacy"))

    def test_no_photos_and_no_pin(self):
        total, findings = evaluate({**GOOD, "photos": [], "latitude": None, "longitude": None}, PARKS, None)
        self.assertIn("flag", levels(findings, "legitimacy"))
        self.assertIn("flag", levels(findings, "location"))
        self.assertEqual(total, 50)


if __name__ == "__main__":
    unittest.main()
