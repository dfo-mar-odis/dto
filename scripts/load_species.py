import csv
import os

from core import models


def load_species():
    file_location = os.path.join('scripts', 'data')
    file_name = 'species_ranges.csv'

    create = []
    update = []
    fields = ["name", "grouping", "importance", "status", "lower_temperature",
              "upper_temperature", "lower_depth", "upper_depth"]
    with open(os.path.join(file_location, file_name), newline='') as csvfile:
        reader = csv.DictReader(csvfile, delimiter=',')

        for row in reader:
            if models.Species.objects.filter(scientific_name__iexact=row['Scientific']).exists():
                species = models.Species.objects.get(scientific_name__iexact=row['Scientific'])
                update.append(species)
            else:
                species = models.Species(scientific_name=row['Scientific'])
                create.append(species)

            species.name = row['Common']
            group = row['Grouping'].lower().replace(" fish", "").replace(" ", "_")
            importance = row['Importance'].lower().replace(" fish", "").replace(" ", "_")
            species.grouping = models.SpeciesGrouping.get(group)
            species.importance = models.Importance.get(importance) if row['Importance'] else None
            status = row['Status'].lower().replace(" ", "_")
            if status == 'special_concern':
                species.status = models.SpeciesStatus.vulnerable
            else:
                species.status = models.SpeciesStatus.get(status) if status else models.SpeciesStatus.not_evaluated

            species.lower_temperature = float(row['Lower Temp'])
            species.upper_temperature = float(row['Upper Temp'])
            species.lower_depth = float(row['Upper Depth'])
            species.upper_depth = float(row['Lower Depth'])

    if create:
        models.Species.objects.bulk_create(create)

    if update:
        models.Species.objects.bulk_update(update, fields=fields)
