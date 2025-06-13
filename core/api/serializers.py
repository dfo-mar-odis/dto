# core/serializers.py
import json

from rest_framework import serializers
from core import models

class MPAZonesSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.MPAZones
        fields = ['id', 'name_e', 'url_e', 'km2', 'classification', 'geometry']
        # Or specify fields: fields = ['id', 'name', 'km2', 'geom']

    def to_representation(self, instance):
        # Create a proper GeoJSON Feature object
        style_color = instance.classification.colour
        representation = {
            "type": "Feature",
            "style": {
                'color': style_color,
                'weight': 2,
                'opacity': 0.7,
                'fillColor': style_color,
                'fillOpacity': 0.5
            },
            "properties": {
                "id": instance.site_id,
                "name_e": instance.name_e,
                "url_e": instance.url_e,
                "class": instance.classification.name_e,
                "km2": instance.km2
            },
            "geometry": json.loads(instance.geom.geojson) if instance.geom else None
        }
        return representation


class SpeciesSerializer(serializers.ModelSerializer):
    # Create custom fields for choice fields
    grouping = serializers.SerializerMethodField()
    importance = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = models.Species
        fields = "__all__"

    def get_grouping(self, obj):
        if obj.grouping is None:
            return None
        return {
            'value': obj.grouping,
            'display': obj.get_grouping_display()
        }

    def get_importance(self, obj):
        if obj.importance is None:
            return None
        return {
            'value': obj.importance,
            'display': obj.get_importance_display()
        }

    def get_status(self, obj):
        return {
            'value': obj.status,
            'display': obj.get_status_display()
        }