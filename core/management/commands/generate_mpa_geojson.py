# core/management/commands/generate_mpa_geojson.py
from django.core.management.base import BaseCommand
import json
import os
from core.models import ClimateModels
from core.api.serializers import MPAZonesSerializer
from core.api.views import MPAZonesWithTimeseriesViewSet
from django.test.client import RequestFactory
from django.contrib.sessions.middleware import SessionMiddleware

class Command(BaseCommand):
    help = 'Generate static GeoJSON files for MPA polygons with timeseries data'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Force regeneration of files')

    def handle(self, *args, **options):
        # Create directory structure if it doesn't exist
        output_dir = 'core/static/core/geojson'
        os.makedirs(output_dir, exist_ok=True)

        # Get all climate models
        climate_models = ClimateModels.objects.all()

        factory = RequestFactory()

        for model in climate_models:
            self.stdout.write(f"Processing climate model: {model.name}")

            # Create a file name based on the model ID
            filename = os.path.join(output_dir, f"mpa_model_{model.name.upper()}.geojson")

            if os.path.exists(filename) and not options['force']:
                self.stdout.write(f"File {filename} already exists, skipping (use --force to regenerate)")
                continue

            # Simulate a request to the viewset
            request = factory.get('/')

            # Add session to request
            middleware = SessionMiddleware(get_response=lambda r: None)
            middleware.process_request(request)
            request.session['selected_model'] = model.id
            request.session.save()

            # Create a viewset instance
            viewset = MPAZonesWithTimeseriesViewSet()
            viewset.request = request

            # Get the queryset (MPAs with timeseries for this model)
            queryset = viewset.get_queryset()

            if not queryset.exists():
                self.stdout.write(self.style.WARNING(f"No MPAs with timeseries for model {model.name}"))
                continue

            # Serialize MPAs with geometry
            serializer = MPAZonesSerializer(queryset, many=True)
            serialized_data = serializer.data

            # Write to file as GeoJSON FeatureCollection
            feature_collection = {
                "type": "FeatureCollection",
                "features": serialized_data
            }

            with open(filename, 'w') as f:
                json.dump(feature_collection, f)

            self.stdout.write(self.style.SUCCESS(
                f"Created {filename} with {len(serialized_data)} MPAs"
            ))