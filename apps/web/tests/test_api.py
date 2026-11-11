import unittest, tempfile, threading, json
from pathlib import Path
from urllib.request import urlopen,Request
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer
import app

class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory()
        cls.original_db=app.DB
        app.DB=Path(cls.temp.name)/'gridshare.sqlite3'
        cls.httpd=ThreadingHTTPServer(('127.0.0.1',0),app.Handler)
        cls.base=f'http://127.0.0.1:{cls.httpd.server_address[1]}'
        cls.thread=threading.Thread(target=cls.httpd.serve_forever,daemon=True)
        cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown();cls.httpd.server_close()
        app.DB=cls.original_db
        cls.temp.cleanup()
    def get(self,path):
        with urlopen(self.base+path,timeout=20) as r:return json.loads(r.read())
    def post(self,path,data):
        request=Request(self.base+path,data=json.dumps(data).encode(),headers={'Content-Type':'application/json'},method='POST')
        with urlopen(request,timeout=20) as r:return json.loads(r.read())
    def test_bootstrap_and_profile(self):
        self.assertGreater(len(self.get('/api/bootstrap')['listings']),5)
        profile={'account_type':'person','name':'Test participant','supplier':'Eneco','contract_type':'fixed',
           'connection_type':'3 × 25 A','connection_amps':25,'contracted_kw':0,'share_public':True,
           'roles':['producer'],'solar_kwp':4.2,'battery_kwh':0,'acknowledged_simulation':True}
        self.assertTrue(self.post('/api/profile',profile)['ok'])
        self.assertEqual(self.get('/api/bootstrap')['profile']['supplier'],'Eneco')
    def test_listing_and_request_flow(self):
        p={'account_type':'person','name':'Test participant','supplier':'Eneco','contract_type':'fixed','share_public':True,'acknowledged_simulation':True}
        self.post('/api/profile',p)
        listing=self.post('/api/listings',{'kind':'solar','name':'My test solar','power_kw':4,'energy_kwh':10,'price':.08,'window':'13:00–15:00','location_area':'Helpman'})['listing']
        self.assertTrue(listing['local'])
        record=self.post('/api/requests',{'listing_id':listing['id'],'quantity':3,'date':'2026-11-12','estimated_savings_eur':999})['request']
        self.assertTrue(record['status'].startswith('Draft'))
        self.assertIsInstance(record['estimated_savings_eur'], (int,float))
        self.assertGreaterEqual(record['estimated_savings_eur'],0)
        self.assertLess(record['estimated_savings_eur'],1)
        self.assertLessEqual(record['estimated_quantity'],record['quantity'])
        self.assertIn('not realized',record['savings_basis'])
        saved=next(r for r in self.get('/api/bootstrap?date=2026-11-13')['requests'] if r['id']==record['id'])
        self.assertEqual(saved['estimated_savings_eur'],record['estimated_savings_eur'])
        self.assertEqual(saved['date'],'2026-11-12')
    def test_reject_mcc_for_personal_connection(self):
        try:self.post('/api/listings',{'kind':'mcc','name':'Not eligible','power_kw':4})
        except HTTPError as err:self.assertEqual(err.code,400)
        else:self.fail('Personal MCC listing should have been blocked')

if __name__=='__main__':unittest.main()
