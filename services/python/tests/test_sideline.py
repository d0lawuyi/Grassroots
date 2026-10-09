import unittest
from datetime import datetime, timedelta, timezone

from grassroots_tools.sideline import build_digest, display_name, render_html, render_text

NOW = datetime(2026, 10, 9, 20, 0, tzinfo=timezone.utc)


def iso(dt):
    return dt.isoformat()


GAMES = [
    # played this week at p1, hosted by u1
    {"game_id": "g1", "title": "Tuesday 5v5", "sport": "soccer", "park_id": "p1", "organizer_id": "u1",
     "start_time": iso(NOW - timedelta(days=3, hours=2)), "end_time": iso(NOW - timedelta(days=3))},
    # played this week at p1, hosted by u2
    {"game_id": "g2", "title": "Hoops", "sport": "basketball", "park_id": "p1", "organizer_id": "u2",
     "start_time": iso(NOW - timedelta(days=1, hours=2)), "end_time": iso(NOW - timedelta(days=1))},
    # upcoming in 2 days, 1 of 10 spots taken
    {"game_id": "g3", "title": "Saturday <run>", "sport": "flag_football", "park_id": "p2", "organizer_id": "u1",
     "start_time": iso(NOW + timedelta(days=2)), "end_time": iso(NOW + timedelta(days=2, hours=2)), "max_players": 10},
    # upcoming but full
    {"game_id": "g4", "title": "Full game", "sport": "soccer", "park_id": "p2", "organizer_id": "u2",
     "start_time": iso(NOW + timedelta(days=3)), "end_time": iso(NOW + timedelta(days=3, hours=2)), "max_players": 1},
]
BOOKINGS = [
    {"game_id": "g1", "player_id": "u1"}, {"game_id": "g1", "player_id": "u2"}, {"game_id": "g1", "player_id": "u3"},
    {"game_id": "g2", "player_id": "u2"}, {"game_id": "g2", "player_id": "u3"},
    {"game_id": "g3", "player_id": "u3"},
    {"game_id": "g4", "player_id": "u1"},
]
PARKS = [
    {"park_id": "p1", "name": "Central Green Field", "city": "Indianapolis", "sports": ["soccer"], "verified_at": iso(NOW - timedelta(days=2))},
    {"park_id": "p2", "name": "Old Park", "city": "Carmel", "sports": ["soccer"], "verified_at": iso(NOW - timedelta(days=40))},
]


class DigestTest(unittest.TestCase):
    def build(self, users):
        return build_digest(now=NOW, games=GAMES, bookings=BOOKINGS, users=users, parks=PARKS)

    def test_week_numbers(self):
        d = self.build([])
        self.assertEqual(d.games_played, 2)
        self.assertEqual(d.players, 3)
        self.assertEqual([v["name"] for v in d.new_venues], ["Central Green Field"])
        self.assertEqual(d.busiest_venue, {"name": "Central Green Field", "games": 2})

    def test_nobody_featured_without_opt_in(self):
        self.assertIsNone(self.build([{"user_id": "u2", "full_name": "Sam Lee", "sideline_feature": False}]).player_of_week)

    def test_player_of_week_counts_played_and_hosted(self):
        users = [
            {"user_id": "u2", "full_name": "Sam Lee", "sideline_feature": True},   # 2 played + 1 hosted = 3.5
            {"user_id": "u3", "full_name": "Ana Cruz", "sideline_feature": True},  # 2 played = 2
        ]
        self.assertEqual(self.build(users).player_of_week, {"name": "Sam L.", "played": 2, "hosted": 1})

    def test_upcoming_skips_full_games(self):
        d = self.build([])
        self.assertEqual([u["title"] for u in d.upcoming], ["Saturday <run>"])
        self.assertEqual(d.upcoming[0]["spots"], 9)

    def test_html_escapes_user_text(self):
        page = render_html(self.build([]))
        self.assertIn("Saturday &lt;run&gt;", page)
        self.assertNotIn("<run>", page)

    def test_text_version(self):
        text = render_text(self.build([]))
        self.assertIn("2 games played by 3 players.", text)
        self.assertIn("Sun Oct 11, 8:00 PM UTC", text)


class NameTest(unittest.TestCase):
    def test_only_last_initial(self):
        self.assertEqual(display_name("Danny Olawuyi"), "Danny O.")
        self.assertEqual(display_name("Danny"), "Danny")
        self.assertEqual(display_name(None), "A Grassroots player")


if __name__ == "__main__":
    unittest.main()
