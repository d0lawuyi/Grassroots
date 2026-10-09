import unittest

from grassroots_tools.geo import distance_m, name_similarity, nearest, normalize_name, street_address
from grassroots_tools.web import HttpError


class DistanceTest(unittest.TestCase):
    def test_same_point_is_zero(self):
        self.assertAlmostEqual(distance_m(39.77, -86.16, 39.77, -86.16), 0, places=3)

    def test_one_degree_of_latitude_is_about_111_km(self):
        self.assertAlmostEqual(distance_m(39.0, -86.0, 40.0, -86.0), 111_195, delta=200)

    def test_nearest_ignores_places_without_coordinates(self):
        places = [{"name": "no pin"}, {"name": "far", "latitude": 40.0, "longitude": -86.0}, {"name": "close", "latitude": 39.001, "longitude": -86.0}]
        best, d = nearest(39.0, -86.0, places)
        self.assertEqual(best["name"], "close")
        self.assertLess(d, 200)


class NameTest(unittest.TestCase):
    def test_filler_words_are_dropped(self):
        self.assertEqual(normalize_name("The Eagle Creek Park - Field 1"), "eagle creek 1")

    def test_ampersand_matches_and(self):
        self.assertEqual(normalize_name("Mary & John Fields"), normalize_name("Mary and John"))

    def test_similar_names_score_high(self):
        self.assertGreater(name_similarity("Central Green Field", "Central Green Park"), 0.95)
        self.assertLess(name_similarity("Central Green Field", "Speedway Soccer"), 0.5)


class AddressTest(unittest.TestCase):
    def test_number_and_road(self):
        self.assertEqual(street_address({"house_number": "1200", "road": "W 38th St"}), "1200 W 38th St")

    def test_road_only_and_nothing(self):
        self.assertEqual(street_address({"road": "Kessler Blvd"}), "Kessler Blvd")
        self.assertIsNone(street_address({"city": "Indianapolis"}))


class ErrorTextTest(unittest.TestCase):
    def test_supabase_message_comes_first(self):
        body = '{"code":"23502","details":"Failing row contains (a, very, long, row)","hint":null,"message":"null value in column \\"address\\" violates not-null constraint"}'
        text = str(HttpError(400, body, "https://x.supabase.co/rest/v1/parks?select=*"))
        self.assertTrue(text.startswith('HTTP 400 from https://x.supabase.co/rest/v1/parks: null value in column "address"'))
        self.assertIn("(code 23502)", text)


if __name__ == "__main__":
    unittest.main()
