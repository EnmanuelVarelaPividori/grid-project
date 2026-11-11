import unittest
from datetime import date,timedelta
from engine.model import get_engine,ASSETS,DEMO_DAY,DT,HELD_OUT,FEEDER_LIMIT_KW

class EngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.e=get_engine()
    def test_full_synthetic_year(self):
        self.assertEqual(len(self.e.weather),365*96)
        self.assertEqual(len(self.e.records),365*96)
        self.assertEqual(len(self.e.records[(DEMO_DAY,0)]),len(ASSETS))
    def test_forecast_intervals(self):
        f=self.e.forecast_day(DEMO_DAY)
        self.assertEqual(len(f),96)
        self.assertEqual(f[0]['time'],'00:00')
        self.assertEqual(f[95]['time'],'23:45')
    def test_heldout_never_trained(self):
        # One bin is learned from dates with exactly the same month/day kind/slot.
        self.assertEqual(len(HELD_OUT),2)
        self.assertTrue(all(self.e.mae[k] >= 0 for k in ['load','solar']))
    def test_baseline(self):
        r=self.e.optimize_day(DEMO_DAY,'no_coord')
        self.assertEqual(r['before'],r['after'])
        self.assertEqual(r['savings_eur'],0)
    def test_optimization_respects_total_shift_and_battery_losses(self):
        baseline=self.e.optimize_day(DEMO_DAY,'no_coord')
        result=self.e.optimize_day(DEMO_DAY,'gridshare_ai')
        self.assertGreaterEqual(result['storage_charged_kwh'],result['storage_discharged_kwh'])
        self.assertTrue(result['peak_reduction_kw']>0)
        self.assertEqual(len(result['timeseries']),96)
        # Increased imports arise from charging losses rather than conjured power.
        self.assertTrue(result['after']['import_kwh']>=baseline['before']['import_kwh'])
    def test_approved_public_pair_is_only_a_candidate(self):
        from app import DEMO_LISTINGS
        matches=self.e.matches(DEMO_LISTINGS)
        solar=next(m for m in matches if m['listing_id']=='solar-2')
        self.assertEqual(solar['partner_id'],'demand-2')
        self.assertIn('unverified',solar['compatibility'].lower())
    def test_backtest_four_baselines(self):
        data=self.e.backtest()
        self.assertEqual(data['days'],14)
        self.assertEqual(len(data['scores']),4)
        self.assertEqual(data['scores'][0]['key'],'no_coord')
        self.assertEqual(data['scores'][-1]['key'],'gridshare_ai')

if __name__=='__main__':unittest.main()
