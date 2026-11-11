import unittest, json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

class FrontendIntegrationTests(unittest.TestCase):
    def test_shadcn_frontend_and_classic_fallback(self):
        jsx=(ROOT/'hero-ui/src/App.jsx').read_text(encoding='utf8')
        package=(ROOT/'hero-ui/package.json').read_text(encoding='utf8')
        server=(ROOT/'app.py').read_text(encoding='utf8')
        for term in ('GroningenMap','CostChart','EnergyChart','/api/bootstrap','/api/forecast','/api/matches'):
            self.assertIn(term,jsx)
        dependencies=json.loads(package)
        self.assertIn('radix-ui',dependencies['dependencies'])
        self.assertIn('maplibre-gl',dependencies['dependencies'])
        self.assertIn('recharts',dependencies['dependencies'])
        self.assertNotIn('@heroui/react',dependencies['dependencies'])
        self.assertIn('react-dom',dependencies['dependencies'])
        self.assertIn('vite-plus',dependencies['devDependencies'])
        self.assertIn("path=='/classic'",server)
        self.assertTrue((ROOT/'static/index.html').exists())
        self.assertTrue((ROOT/'run_heroui_windows.bat').exists())
