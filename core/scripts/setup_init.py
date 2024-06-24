from core.scripts import load_mpa_shapes
from core.scripts import load_timeseries


def setup():
    load_mpa_shapes.load_mpas()
    load_mpa_shapes.merge_zones()
    load_timeseries.load_stAnns()


if __name__ == '__main__':
    setup()