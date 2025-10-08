import re
import os
import csv
import geojson


def csv_to_geojson(model_name, input_csv, output_geojson):
    features = []
    with open(input_csv, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        polygon_coordinates = []
        for row in reader:
            try:
                longitude = float(row['Longitude'])
                latitude = float(row['Latitude'])
                polygon_coordinates.append([longitude, latitude])
            except ValueError:
                print(f"Skipping invalid row: {row}")

        features.append(geojson.Feature(
            geometry=geojson.MultiPolygon([[polygon_coordinates]]),
            style={
                'color': "#FF7800",
                'weight': 2,
                'fillOpacity': 0.2
            },
            properties={'name': model_name}
        ))
    feature_collection = geojson.FeatureCollection(features)
    with open(output_geojson, 'w', encoding='utf-8') as geojsonfile:
        geojson.dump(feature_collection, geojsonfile, indent=2)


# Example usage
input_path = r"./data/model_domains"

files = [file for file in os.listdir(input_path) if file.endswith('.csv')]
print("file count: " + str(len(files)))

models = [re.match(r'(.*?)_.*\.csv', file).group(1) for file in files if re.match(r'(.*?)_.*\.csv', file)]
print("model count: " + str(len(models)))
for model, file in zip(models, files):
    csv_to_geojson(model, os.path.join(input_path, file), os.path.join(input_path, f"{model}_domain.geojson"))
