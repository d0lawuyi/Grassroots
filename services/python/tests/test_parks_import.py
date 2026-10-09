import unittest

from grassroots_tools.parks_import import group_into_venues, is_duplicate, parse_overpass

# A trimmed-down Overpass answer: two pitches in one park, one named pitch, one stray pitch.
OVERPASS = [
    {"type": "way", "center": {"lat": 39.8600, "lon": -86.3000}, "tags": {"leisure": "park", "name": "Eagle Creek Park"}},
    {"type": "way", "center": {"lat": 39.8605, "lon": -86.3004}, "tags": {"leisure": "pitch", "sport": "soccer"}},
    {"type": "way", "center": {"lat": 39.8610, "lon": -86.3008}, "tags": {"leisure": "pitch", "sport": "american_football;soccer"}},
    {"type": "node", "lat": 39.7000, "lon": -86.1000, "tags": {"leisure": "pitch", "sport": "basketball", "name": "Garfield Courts"}},
    {"type": "node", "lat": 39.5000, "lon": -86.5000, "tags": {"leisure": "pitch", "sport": "soccer"}},
    {"type": "node", "lat": 39.6000, "lon": -86.6000, "tags": {"leisure": "pitch", "sport": "tennis", "name": "Tennis only"}},
]


class ParseTest(unittest.TestCase):
    def test_splits_pitches_and_parks_and_maps_sports(self):
        pitches, parks = parse_overpass(OVERPASS)
        self.assertEqual(len(parks), 1)
        self.assertEqual(len(pitches), 4)  # tennis is not a Grassroots sport, so it's left out
        self.assertEqual(pitches[1].sports, {"soccer", "flag_football"})


class GroupTest(unittest.TestCase):
    def setUp(self):
        pitches, parks = parse_overpass(OVERPASS)
        self.venues = {v.name: v for v in group_into_venues(pitches, parks)}

    def test_pitches_in_one_park_become_one_venue(self):
        eagle = self.venues["Eagle Creek Park"]
        self.assertEqual(eagle.pitch_count, 2)
        self.assertEqual(eagle.sports, {"soccer", "flag_football"})

    def test_named_pitch_keeps_its_name(self):
        self.assertIn("Garfield Courts", self.venues)

    def test_unnamed_pitch_far_from_any_park_is_skipped(self):
        self.assertEqual(len(self.venues), 2)


class DuplicateTest(unittest.TestCase):
    def setUp(self):
        pitches, parks = parse_overpass(OVERPASS)
        self.eagle = next(v for v in group_into_venues(pitches, parks) if v.name == "Eagle Creek Park")

    def test_close_existing_venue_is_a_duplicate(self):
        dup, why = is_duplicate(self.eagle, [{"name": "Something else", "latitude": 39.8607, "longitude": -86.3006}])
        self.assertTrue(dup)
        self.assertIn("m from", why)

    def test_same_name_nearby_is_a_duplicate(self):
        dup, _ = is_duplicate(self.eagle, [{"name": "Eagle Creek Park - Field 1", "latitude": 39.865, "longitude": -86.300}])
        self.assertTrue(dup)

    def test_far_away_different_name_is_new(self):
        dup, _ = is_duplicate(self.eagle, [{"name": "Central Green", "latitude": 39.0, "longitude": -86.0}])
        self.assertFalse(dup)


if __name__ == "__main__":
    unittest.main()
