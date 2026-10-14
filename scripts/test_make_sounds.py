"""Checks the celebration sounds made by scripts/make_sounds.py.

Run from the repo root:  python -m unittest scripts/test_make_sounds.py -v
"""
import array
import os
import sys
import tempfile
import unittest
import wave

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_sounds  # noqa: E402

NAMES = ["whistle", "swish", "cheer", "pistol", "whoosh"]


def read(path):
    with wave.open(path, "rb") as w:
        frames = w.readframes(w.getnframes())
        return w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes(), array.array("h", frames)


class GeneratedSounds(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.mkdtemp()
        make_sounds.main(cls.dir)

    def test_every_sound_is_short_mono_22khz(self):
        for name in NAMES:
            with self.subTest(name):
                channels, width, rate, frames, _ = read(os.path.join(self.dir, f"{name}.wav"))
                self.assertEqual(channels, 1)
                self.assertEqual(width, 2)
                self.assertEqual(rate, 22050)
                self.assertLess(frames / rate, 1.0)

    def test_every_sound_is_audible_and_not_clipped(self):
        for name in NAMES:
            with self.subTest(name):
                *_, samples = read(os.path.join(self.dir, f"{name}.wav"))
                peak = max(abs(s) for s in samples) / 32768
                self.assertGreater(peak, 0.1)
                self.assertLess(peak, 0.95)

    def test_generating_twice_gives_identical_files(self):
        other = tempfile.mkdtemp()
        make_sounds.main(other)
        for name in NAMES:
            with self.subTest(name):
                with open(os.path.join(self.dir, f"{name}.wav"), "rb") as a, open(os.path.join(other, f"{name}.wav"), "rb") as b:
                    self.assertEqual(a.read(), b.read())


if __name__ == "__main__":
    unittest.main()
