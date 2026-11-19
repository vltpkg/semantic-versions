"""Runs the shared conformance suite (../../conformance) against this package."""

import json
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))

import semantic_versions as sv  # noqa: E402

SUITE = pathlib.Path(__file__).resolve().parents[3] / "conformance"


def cases(name):
    return json.loads((SUITE / f"{name}.json").read_text())["cases"]


class Conformance(unittest.TestCase):
    def test_versions(self):
        for c in cases("versions"):
            with self.subTest(input=c["input"]):
                if c["valid"]:
                    v = sv.parse(c["input"])
                    self.assertEqual(str(v), c["version"])
                    if "context" in c:
                        self.assertEqual(v.context, c["context"])
                else:
                    self.assertIsNone(sv.valid(c["input"]))

    def test_precedence(self):
        for c in cases("precedence"):
            with self.subTest(a=c["a"], b=c["b"]):
                self.assertEqual(sv.compare(c["a"], c["b"]), c["expected"])
                self.assertEqual(sv.compare(c["b"], c["a"]), -c["expected"])

    def test_ranges(self):
        for c in cases("ranges"):
            with self.subTest(range=c["range"], version=c["version"]):
                self.assertEqual(sv.satisfies(c["version"], c["range"]), c["expected"])

    def test_desugar(self):
        for c in cases("desugar"):
            with self.subTest(input=c["input"]):
                self.assertIn(sv.valid_range(c["input"]), [c["output"], *c.get("accept", [])])


class Api(unittest.TestCase):
    def test_helpers(self):
        vs = ["1.0.0", "2.0.0-rc.1", "1.5.0", "2.0.0", "1.5.0+build"]
        self.assertEqual(sv.max_satisfying(vs, "^1"), "1.5.0+build")
        self.assertEqual(sv.min_satisfying(vs, "^1"), "1.0.0")
        self.assertEqual(sv.sort(vs), ["1.0.0", "1.5.0", "1.5.0+build", "2.0.0-rc.1", "2.0.0"])
        self.assertEqual(sv.rsort(vs)[0], "2.0.0")
        self.assertEqual(sv.valid_range(">=0.0.0"), "*")
        self.assertIsNone(sv.valid("v1.2.3"))
        self.assertTrue(sv.Range("npm:react@^18").test(sv.parse("npm:react@18.2.0")))
        self.assertFalse(sv.Range("npm:react@^18").test(sv.parse("18.2.0")))
        self.assertIn(sv.parse("1.2.3"), sv.Range("~1.2"))
        with self.assertRaises(sv.InvalidVersion):
            sv.parse("1.2")


if __name__ == "__main__":
    unittest.main()
