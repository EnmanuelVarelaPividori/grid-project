"""Business park cluster (ticket: Define the cluster's participants, roles and feeder limits).

A Groningen business park behind one medium-voltage substation, forming an energy hub under a
group transport agreement (GTO). All sizes, tariffs and capacities are ASSUMPTIONS until real
meter data and contracts replace them.
"""
import pandas as pd

# Tariffs (EUR). Business energy price all-in variable, feed-in, and the capacity tariff on
# contracted transport capacity (GTV). An overshoot raises the GTV for the whole calendar year.
RETAIL_EUR_KWH = 0.20
FEED_IN_EUR_KWH = 0.05
CAPACITY_EUR_PER_KW_YEAR = 40.0

# Platform revenue model (from the proposition)
SAAS_EUR_PER_MONTH = 150.0     # per connection and per battery system
GAIN_SHARE = 0.15              # of the avoided capacity-increase cost
MARGIN_EUR_KWH = 0.01          # on every kWh exchanged inside the hub

# x, y: positions on the prototype map; street: the park's street (no addresses).
PARK = [
    dict(id="L1", name="Distribution centre", archetype="logistics", role="sells", street="Transportweg",
         annual_kwh=1_600_000, pv_kwp=900, bess_kwh=0, bess_kw=0, flex_kwh=0, flex_kw=0, x=300, y=180),
    dict(id="O1", name="Office building", archetype="office", role="sells", street="Zernikeweg",
         annual_kwh=500_000, pv_kwp=250, bess_kwh=0, bess_kw=0, flex_kwh=0, flex_kw=0, x=470, y=150),
    dict(id="C1", name="Cold store", archetype="cold_storage", role="needs", street="Koelhuisweg",
         annual_kwh=2_200_000, pv_kwp=300, bess_kwh=0, bess_kw=0, flex_kwh=500, flex_kw=150, x=640, y=230),
    dict(id="D1", name="Data centre", archetype="data_center", role="needs", street="Zernikeweg",
         annual_kwh=1_300_000, pv_kwp=0, bess_kwh=0, bess_kw=0, flex_kwh=0, flex_kw=0, x=560, y=360),
    dict(id="F1", name="Factory with battery", archetype="factory_2shift", role="stores", street="Industrieweg",
         annual_kwh=2_500_000, pv_kwp=400, bess_kwh=1000, bess_kw=500, flex_kwh=0, flex_kw=0, x=760, y=420),
    dict(id="E1", name="EV fleet depot", archetype="ev_depot", role="needs", street="Transportweg",
         annual_kwh=50_000, pv_kwp=100, bess_kwh=0, bess_kw=0, flex_kwh=0, flex_kw=0, x=230, y=380,
         vans=25, van_kwh=45.0, charger_kw=11.0),
    dict(id="B1", name="Industrial bakery", archetype="bakery", role="needs", street="Industrieweg",
         annual_kwh=900_000, pv_kwp=0, bess_kwh=0, bess_kw=0, flex_kwh=0, flex_kw=0, x=860, y=260),
    dict(id="W1", name="Wholesale", archetype="supermarket", role="sells", street="Koelhuisweg",
         annual_kwh=600_000, pv_kwp=150, bess_kwh=0, bess_kw=0, flex_kwh=0, flex_kw=0, x=420, y=470),
]


def build_park() -> pd.DataFrame:
    df = pd.DataFrame(PARK).set_index("id")
    for col, default in [("vans", 0), ("van_kwh", 0.0), ("charger_kw", 0.0)]:
        df[col] = df[col].fillna(default)
    df["vans"] = df["vans"].astype(int)
    return df


def saas_units(park: pd.DataFrame) -> int:
    """Billable units: one per connection plus one per battery system."""
    return len(park) + int((park["bess_kwh"] > 0).sum())
