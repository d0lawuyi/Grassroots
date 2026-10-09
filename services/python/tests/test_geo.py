import unittest

from grassroots_tools.geo import distance_m, name_similarity, nearest, normalize_name


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


if __name__ == "__main__":
    unittest.main()
