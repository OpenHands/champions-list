import subprocess
import sys
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]


class AutomationSmokeTests(unittest.TestCase):
    def test_package_imports(self) -> None:
        from automation.main import run_automation
        from automation.models import ContributorPR

        self.assertTrue(callable(run_automation))
        self.assertIsNotNone(ContributorPR)

    def test_repo_root_entrypoint_fails_fast_without_token(self) -> None:
        result = subprocess.run(
            [sys.executable, "automation/main.py"],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
        )

        combined_output = f"{result.stdout}\n{result.stderr}"
        self.assertEqual(result.returncode, 1, combined_output)
        self.assertIn("GITHUB_TOKEN environment variable not set", combined_output)
        self.assertNotIn("ModuleNotFoundError", combined_output)
        self.assertNotIn("NameError", combined_output)


if __name__ == "__main__":
    unittest.main()
