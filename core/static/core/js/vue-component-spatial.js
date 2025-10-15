export const SpatialAnalysis = {
    template: `
      <div class="card">
        <div class="card-header">
          <div class="card-title h4">Spatial Analysis</div>
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-3">
              <button class="btn btn-outline-dark mb-1" @click="changeLayer('shelf_trend')"
                      :class="{'active': activeLayer === 'shelf_trend'}">Bottom Temperature Trend
              </button>
            </div>
            <div class="col">
              <div id="spatial-map" style="height: 500px;"></div>
            </div>
          </div>
        </div>
      </div>`,

    props: {
        climate_model: null,
        isActive: Boolean,
        path_to_geofolder: "",
        path_to_mpafolder: ""
    },

    data() {
        return {
            map: null,
            geotiffLayer: null,
            activeRaster: null,
            activeLayer: null,
            layerFiles: {
                shelf_trend: {
                    file_name: null,
                    colors: [
                        {r: 255, g: 0, b: 0},     // Red (hottest)
                        {r: 255, g: 165, b: 0},  // Orange
                        {r: 255, g: 255, b: 0},  // Yellow
                        {r: 0, g: 255, b: 0},    // Green
                        {r: 0, g: 255, b: 255},  // Cyan
                        {r: 0, g: 0, b: 255},    // Blue (coldest)
                    ],
                    data: {
                        label: 'Trend',
                        units: '°C',
                        fixed: 4
                    }
                }
            }
        };
    },

    mounted() {
        this.initMap();
    },

    watch: {
        isActive(newValue) {
            if (newValue) {
                // Force the map to recalculate its container size
                this.$nextTick(() => {
                    try {
                        this.map.invalidateSize();
                        this.map.fitBounds(this.geotiffLayer.getBounds());
                    } catch {
                        console.log("map not ready");
                    }
                });
            }
        },
        climate_model: {
            handler(newValue, oldValue) {
                if (newValue) {
                    this.layerFiles.shelf_trend.file_name = newValue + "_bottomTtrend.tif";

                    const active = this.activeLayer == null ? 'shelf_trend' : this.activeLayer;
                    // the layer won't reload if active == this.activeLayer
                    this.activeLayer = null;
                    this.changeLayer(active);
                    this.loadMpaFile(newValue);
                }
            },
            deep: true,
            immediate: true
        },
    },

    methods: {
        initMap() {
            // Make sure Leaflet is available
            if (typeof L !== 'undefined') {

                const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                    maxZoom: 19
                });
                // Initialize the map
                this.map = L.map('spatial-map', {
                    center: [43.75, -63.5],
                    zoom: 5,
                    layers: [satellite],
                });

                // Create info control for displaying raster values
                const infoControl = L.control({position: 'bottomright'});
                infoControl.onAdd = function () {
                    this._div = L.DomUtil.create('div', 'info');
                    this._div.id = 'layer-info-control';
                    this._div.style.background = 'white';
                    this._div.style.padding = '5px';
                    this._div.style.border = '1px solid #ccc';
                    this._div.innerHTML = 'Hover over the map';
                    return this._div;
                };
                infoControl.addTo(this.map);

                if(this.climate_model) {
                    this.changeLayer('shelf_trend')
                }
            } else {
                console.error('Leaflet library not loaded');
            }
        },

        async loadMpaFile(climate_model) {
            const model_file = `mpa_model_${climate_model}.geojson`;
            const geojsonUrl = this.path_to_mpafolder + model_file;
            fetch(geojsonUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Could not load MPA Json file: ${response.status}`);
                    }
                    return response.json();
                })
                .then(geoJsonData => {
                    const filteredGeoJson = {
                        type: "FeatureCollection",
                        features: geoJsonData.features
                    };
                    L.geoJSON(filteredGeoJson, {
                        interactive: false
                    }).addTo(this.map);
                })
                .catch(error => {
                    console.error('Error loading or parsing MPA Json file:', error);
                });
        },

        changeLayer(layerType) {
            if (this.activeLayer === layerType) return;

            this.activeLayer = layerType;

            // Remove current layer if it exists
            if (this.geotiffLayer) {
                this.map.removeLayer(this.geotiffLayer);
                this.geotiffLayer = null;
            }

            // Load the new layer
            const layer_props = this.layerFiles[layerType];
            this.loadGeoTiff(layer_props);
        },

        set_color(values) {
            const min = this.geotiffLayer.georasters[0].mins[0];
            const max = this.geotiffLayer.georasters[0].maxs[0];
            const value = values[0];
            const colors = this.layerFiles[this.activeLayer].colors;
            // Convert to percentage (0-1 range)
            const normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));

            // Determine which color segment to use
            const numSegments = colors.length - 1;
            const segment = Math.min(Math.floor(normalizedValue * numSegments), numSegments - 1);
            const segmentPosition = (normalizedValue * numSegments) - segment;

            // Interpolate between segment colors
            const color1 = colors[segment];
            const color2 = colors[segment + 1];

            const r = Math.round(color1.r + segmentPosition * (color2.r - color1.r));
            const g = Math.round(color1.g + segmentPosition * (color2.g - color1.g));
            const b = Math.round(color1.b + segmentPosition * (color2.b - color1.b));

            return `rgba(${r}, ${g}, ${b}, 1.0)`;
        },

        loadGeoTiff(layer_props) {
            if(layer_props.file_name == null) {
                return;
            }

            const url = this.path_to_geofolder + layer_props.file_name
            try {
                // Create an absolute URL to ensure web workers can resolve it properly
                const absoluteUrl = new URL(url, window.location.origin).href;

                // Alternative approach: fetch first, then parse
                fetch(absoluteUrl)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }
                        return response.arrayBuffer();
                    })
                    .then(arrayBuffer => {
                        return parseGeoraster(arrayBuffer);
                    })
                    .then(georaster => {
                        const georasterLayer = new GeoRasterLayer({
                            georaster: georaster,
                            opacity: 1.0,
                            resolution: 256,
                        });

                        georasterLayer.addTo(this.map);
                        this.geotiffLayer = georasterLayer;

                        georasterLayer.updateColors(this.set_color)
                        // Add mousemove handler to show pixel values
                        this.map.on('mousemove', (evt) => {
                            const latlng = evt.latlng;
                            let infoControl = document.getElementById('layer-info-control');
                            try {
                                // Access the georaster directly and use its values method
                                const x = Math.floor((latlng.lng - georaster.xmin) / georaster.pixelWidth);
                                const y = Math.floor((georaster.ymax - latlng.lat) / georaster.pixelHeight);

                                // Check if within bounds
                                if (x >= 0 && x < georaster.width && y >= 0 && y < georaster.height) {
                                    const value = georaster.values[0][y][x];
                                    if (value !== undefined && value !== null && value !== -9999 && value !== 0) {
                                        infoControl.innerHTML = `<b>${layer_props.data.label}: ${parseFloat(value).toFixed(layer_props.data.fixed)} ${layer_props.data.units}</b>`;
                                    } else {
                                        infoControl.innerHTML = 'No data at this point';
                                    }
                                } else {
                                    infoControl.innerHTML = 'Outside data area';
                                }
                            } catch (e) {
                                console.error('Error getting value:', e);
                                infoControl.innerHTML = 'Outside data area';
                            }
                        });

                        const bounds = georasterLayer.getBounds();
                        if (bounds && bounds.isValid()) {
                            this.map.fitBounds(bounds);
                        }
                    })
                    .catch(error => {
                        console.error('Error loading or parsing GeoTIFF:', error);
                    });
            } catch (error) {
                console.error('Error in loadGeoTiff function:', error);
            }
        }
    },

    beforeUnmount() {
        if (this.map) {
            this.map.remove();
        }
    }
};