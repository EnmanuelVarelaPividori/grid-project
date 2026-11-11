# FlexMeasures integration: supported extension, not required

FlexMeasures is an Apache-2.0 licensed, open-source energy management platform maintained as an LF Energy incubation project. It can forecast and compute schedules for batteries, EV chargers and flexible loads using an API. This project **does not include or launch** FlexMeasures; the bundled `engine/model.py` is an independent local heuristic.

Source: https://github.com/FlexMeasures/flexmeasures
API documentation: https://flexmeasures.readthedocs.io/latest/features/scheduling.html

The current API's asset-level scheduling endpoint is `POST /api/v3_0/assets/{asset_id}/schedules/trigger` with `start`, `duration` and `resolution`. It returns a job UUID. Authorized callers can poll `GET /api/v3_0/jobs/{uuid}` and retrieve a device schedule from `GET /api/v3_0/sensors/{sensor_id}/schedules/{uuid}`.

## Connecting in a future pilot

1. Deploy your own FlexMeasures instance following its official documentation.
2. Register verified participants and assets with legitimate permissions. Define their physical/grid constraints and meter/sensor identifiers.
3. Use the optional helper in `integrations/flexmeasures_adapter.py` and supply your server URL and access token **from the environment, not source code**.
4. Interpret and validate the schedule against contract, feeder, battery SoC, prices, and real device operation rules.
5. Have qualified operators review any actual control step. **Do not use this student demo for live device actuation.**

All FlexMeasures example endpoints may change. Verify against the version you install. This is an integration path, not a production-ready connector or a statement that FlexMeasures grants rights to trade electricity or grid capacity.
