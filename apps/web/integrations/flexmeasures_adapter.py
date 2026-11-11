"""Optional, inactive FlexMeasures scheduling API adapter.

This is not called by the GridShare demo and does not control any equipment.
It needs a separately configured and authorized FlexMeasures v3 instance.
Documentation: https://flexmeasures.readthedocs.io/latest/features/scheduling.html
Source/license: https://github.com/FlexMeasures/flexmeasures (Apache-2.0)

Access tokens should be provided through environment variables, never saved
inside demo user profiles or browser LocalStorage.
"""
from __future__ import annotations
import json
import os
from urllib.request import Request, urlopen
from urllib.parse import urlparse

FLEXMEASURES_PROJECT_URL = 'https://github.com/FlexMeasures/flexmeasures'
SCHEDULER_ENDPOINT_TEMPLATE = '/api/v3_0/assets/{asset_id}/schedules/trigger'

class FlexMeasuresAdapter:
    """A small REST adapter. API versions and authorization can vary by server."""
    def __init__(self, base_url=None, token=None):
        self.base_url=(base_url or os.environ.get('GRIDSHARE_FLEXMEASURES_URL','')).rstrip('/')
        self.token=token or os.environ.get('GRIDSHARE_FLEXMEASURES_TOKEN','')
        parsed=urlparse(self.base_url)
        if parsed.scheme not in ('http','https') or not parsed.netloc:
            raise ValueError('Configure GRIDSHARE_FLEXMEASURES_URL first')
        if not self.token:
            raise ValueError('Configure GRIDSHARE_FLEXMEASURES_TOKEN for the authorized instance')
        if parsed.scheme=='http' and parsed.hostname not in ('127.0.0.1','localhost'):
            raise ValueError('Use HTTPS for non-local FlexMeasures instances')

    def _call(self,method,endpoint,payload=None):
        body=json.dumps(payload).encode('utf-8') if payload is not None else None
        request=Request(self.base_url+endpoint,data=body,method=method,
            headers={'Authorization':'Bearer '+self.token,'Content-Type':'application/json','Accept':'application/json'})
        with urlopen(request,timeout=25) as response:
            return json.loads(response.read())

    def trigger_schedule(self, asset_id:int, start_iso:str, duration='PT24H', resolution='PT15M'):
        """Triggers optimization on an authorized external EMS — NEVER called by demo.

        Scheduling must be independently validated against actual equipment,
        permissions, SOC and approved operator constraints before any actuation.
        """
        if not isinstance(asset_id,int) or asset_id<=0:raise ValueError('asset_id must be positive integer')
        if 'T' not in start_iso or not ('+' in start_iso or start_iso.endswith('Z')):
            raise ValueError('start_iso must be a timezone-aware ISO 8601 timestamp')
        return self._call('POST',SCHEDULER_ENDPOINT_TEMPLATE.format(asset_id=asset_id),
            {'start':start_iso,'duration':duration,'resolution':resolution})

    def get_job(self,job_uuid:str):
        if not job_uuid or '/' in job_uuid:raise ValueError('Invalid job identifier')
        return self._call('GET',f'/api/v3_0/jobs/{job_uuid}')

    def get_sensor_schedule(self,sensor_id:int,job_uuid:str):
        if not isinstance(sensor_id,int) or sensor_id<=0:raise ValueError('Invalid sensor identifier')
        if not job_uuid or '/' in job_uuid:raise ValueError('Invalid job identifier')
        return self._call('GET',f'/api/v3_0/sensors/{sensor_id}/schedules/{job_uuid}')
