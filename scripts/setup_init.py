from scripts import load_species, load_timeseries, load_mpa_shapes


def setup():
    load_species.load_species()
    load_mpa_shapes.load_mpas()
    load_timeseries.load_mpas()


if __name__ == '__main__':
    setup()