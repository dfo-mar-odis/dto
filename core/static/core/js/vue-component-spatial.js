const trend_colour = [{r: 59, g: 76, b: 124}, {r: 255, g: 255, b: 255}, {r: 254, g: 250, b: 240},
    {r: 254, g: 246, b: 225}, {r: 254, g: 242, b: 211}, {r: 254, g: 238, b: 196}, {r: 254, g: 234, b: 181},
    {r: 254, g: 230, b: 167}, {r: 254, g: 226, b: 152}, {r: 253, g: 221, b: 141}, {r: 253, g: 214, b: 135},
    {r: 253, g: 208, b: 129}, {r: 253, g: 201, b: 122}, {r: 253, g: 195, b: 116}, {r: 253, g: 188, b: 110},
    {r: 253, g: 181, b: 104}, {r: 253, g: 175, b: 98}, {r: 252, g: 167, b: 93}, {r: 250, g: 158, b: 89},
    {r: 249, g: 150, b: 85}, {r: 248, g: 141, b: 82}, {r: 247, g: 132, b: 78}, {r: 246, g: 124, b: 74},
    {r: 244, g: 115, b: 70}, {r: 243, g: 107, b: 66}, {r: 239, g: 99, b: 62}, {r: 235, g: 91, b: 58},
    {r: 231, g: 83, b: 55}, {r: 227, g: 75, b: 51}, {r: 224, g: 67, b: 47}, {r: 220, g: 59, b: 44},
    {r: 216, g: 51, b: 40}, {r: 211, g: 44, b: 38}, {r: 204, g: 37, b: 38}, {r: 197, g: 31, b: 38},
    {r: 191, g: 25, b: 38}, {r: 184, g: 18, b: 38}, {r: 178, g: 12, b: 38}, {r: 171, g: 6, b: 38},
    {r: 165, g: 0, b: 38}];

const viridis_colour = [{r: 68, g: 1, b: 84}, {r: 68, g: 1, b: 84}, {r: 70, g: 10, b: 93},
    {r: 71, g: 19, b: 101}, {r: 72, g: 27, b: 109}, {r: 72, g: 35, b: 116}, {r: 71, g: 44, b: 122},
    {r: 70, g: 51, b: 127}, {r: 68, g: 58, b: 131}, {r: 66, g: 65, b: 134}, {r: 62, g: 73, b: 137},
    {r: 60, g: 80, b: 139}, {r: 57, g: 86, b: 140}, {r: 54, g: 93, b: 141}, {r: 50, g: 100, b: 142},
    {r: 48, g: 106, b: 142}, {r: 45, g: 112, b: 142}, {r: 43, g: 117, b: 142}, {r: 40, g: 124, b: 142},
    {r: 38, g: 130, b: 142}, {r: 36, g: 135, b: 142}, {r: 34, g: 141, b: 141}, {r: 32, g: 147, b: 140},
    {r: 31, g: 153, b: 138}, {r: 31, g: 159, b: 136}, {r: 32, g: 164, b: 134}, {r: 37, g: 171, b: 130},
    {r: 84, g: 197, b: 104}, {r: 42, g: 176, b: 127}, {r: 50, g: 182, b: 122}, {r: 59, g: 187, b: 117},
    {r: 72, g: 193, b: 110}, {r: 96, g: 202, b: 96}, {r: 110, g: 206, b: 88}, {r: 127, g: 211, b: 78},
    {r: 142, g: 214, b: 69}, {r: 157, g: 217, b: 59}, {r: 173, g: 220, b: 48}, {r: 192, g: 223, b: 37},
    {r: 208, g: 225, b: 28}, {r: 223, g: 227, b: 24}, {r: 239, g: 229, b: 28}, {r: 253, g: 231, b: 37}]

const colour_sets = {
    "trend": trend_colour,
    "viridis": viridis_colour
}

export const SpatialAnalysis = {
    template: `
      <div class="card">
        <div class="card-body">
          <div v-if="Object.keys(layerFiles).length <= 0">
            There is no data for this Climate Model
          </div>
          <div v-else>
            <div class="row">
              <div class="col-3">
                <div class="row">
                  <div class="col">
                    <div class="accordion">
                      <div class="accordion-item" v-for="(layer, key) in layerFiles" :key="key">
                        <div class="accordion-header">
                          <button
                              class="accordion-button collapsed"
                              data-bs-toggle="collapse"
                              :data-bs-target="'#collapse-' + key"
                              :aria-expanded="false"
                              :aria-controls="'collapse-' + key">
                            {{ layer.data.title }}
                          </button>
                        </div>
                        <div :id="'collapse-' + key" class="accordion-collapse collapse">
                          <div class="accordion-body">
                            <div class="row">
                              <button
                                  v-for="(raster, index) in layer.data.rasters" :key="index"
                                  class="btn btn-sm col-auto me-1 mb-1"
                                  :class="{'btn-primary': activeRaster === raster.label, 'btn-secondary': activeRaster !== raster.label}"
                                  @click="changeLayer(key, raster.label)">
                                {{ raster.label }}
                              </button>
                            </div>
                            <div>{{ layer.data.description }}</div>
                            <div v-if="layer.data.references">
                              References:
                              <ul>
                                <li v-for="ref in layer.data.references" :key="ref">
                                  <a :href="ref" target="_blank">{{ ref }}</a>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col">
                <div id="spatial-map" style="height: 500px;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`,

    props: {
        climate_model: null,
        isActive: Boolean,
        path_to_geofolder: "",
        path_to_mpafolder: "",
        raster_set_url: null,
    },

    data() {
        return {
            map: null,
            geotiffLayer: null,
            activeRaster: null,
            activeLayer: null,
            layerFiles: {}
        };
    },

    computed: {},

    mounted() {
        this.loadLayerFiles();
        if (this.layerFiles.length > 0) {
            this.initMap();
        }
    },

    watch: {
        isActive(newValue) {
            if (newValue) {
                // Force the map to recalculate its container size
                this.$nextTick(() => {
                    try {
                        this.map.invalidateSize();
                        // this.map.fitBounds(this.geotiffLayer.getBounds());
                    } catch {
                        console.log("map not ready");
                    }
                });
            }
        },
        climate_model: {
            handler: async function (newValue, oldValue) {
                if (!newValue) return;

                await this.fetchLayerFiles();

                if (!this.map) {
                    this.$nextTick(() => {
                        const mapContainer = document.getElementById('spatial-map');
                        if (mapContainer) {
                            this.initMap();
                        }
                    });
                }
                ;

                const aboutTextElement = document.getElementById('div_col_id_about_button_text');

                if (this.layerFiles.length === 0) {
                    // No rasters for this climate model
                    this.activeLayer = null;
                    if (this.geotiffLayer) {
                        try {
                            this.map.removeLayer(this.geotiffLayer);
                        } catch (e) {
                        }
                        this.geotiffLayer = null;
                    }
                    if (aboutTextElement) {
                        aboutTextElement.textContent = "No data for this climate model";
                    }
                }

                // Initialize the active layer after fetching
                const availableKeys = Object.keys(this.layerFiles);
                if (availableKeys.length > 0) {
                    this.changeLayer(availableKeys[0]);
                } else {
                    this.changeLayer(null);
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
                // Initialize the map
                this.map = L.map('spatial-map', {
                    center: [43.875, -61.33333],
                    zoom: 6,
                });

                this.addBaseLayer();
                this.addMapControls()
                this.loadMpaFile();

            } else {
                console.error('Leaflet library not loaded');
            }
        },

        async fetchLayerFiles() {
            this.layerFiles = {};
            if (!this.climate_model) {
                return;
            }

            try {
                const url = new URL(this.raster_set_url, window.location.origin);
                url.searchParams.set('model_name', this.climate_model);

                const response = await fetch(url.toString());
                if (!response.ok) {
                    throw new Error(`Failed to fetch layer files: ${response.status}`);
                }
                const data = await response.json();

                data.results.forEach(raster_set => {
                    const entry = {}
                    entry.colors = colour_sets[raster_set.color.name];
                    entry.data = {};
                    entry.data.title = raster_set.title;
                    entry.data.label = raster_set.label;
                    entry.data.description = raster_set.description;
                    entry.data.units = raster_set.units;
                    entry.data.fixed = raster_set.precision;

                    if (raster_set.rasters.length > 0) {
                        entry.data.rasters = []
                        raster_set.rasters.forEach(raster => {
                            entry.data.rasters.push(raster)
                        });
                    }

                    if (raster_set.references.length > 0) {
                        entry.data.references = [];
                        raster_set.references.forEach(reference => {
                            entry.data.references.push(reference.citation);
                        });
                    }
                    const newEntryKey = Object.keys(this.layerFiles).length; // Use the next available number as the key
                    this.layerFiles[newEntryKey] = entry;
                });
            } catch (error) {
                console.error("Error fetching layer files:", error);
            }
        },

        async loadLayerFiles() {
            await this.fetchLayerFiles();

            // Initialize the active layer after fetching
            const availableKeys = Object.keys(this.layerFiles);
            if (availableKeys.length > 0) {
                this.changeLayer(availableKeys[0]);
            }
        },

        addBaseLayer() {
            // L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
            //     attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri',
            //     maxZoom: 13
            // }).addTo(this.map);
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                maxZoom: 19
            }).addTo(this.map);
        },

        addMapControls() {
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

            // Add mousemove handler to show pixel values
            this.map.on('mousemove', this.handleMouseOver);

            // Create colorbar control
            const colorbarControl = L.control({position: 'bottomleft'});

            colorbarControl.onAdd = function () {
                const colorbar = L.DomUtil.create('div', 'colorbar');
                colorbar.id = "colorbar-ramp";
                colorbar.style.height = '20px';
                colorbar.style.background = 'linear-gradient(to right, red, orange, yellow, green, cyan, blue)';
                colorbar.style.border = '1px solid #ccc';
                colorbar.style.padding = '5px';
                colorbar.style.textAlign = 'center';

                const cb_col = L.DomUtil.create('div', 'col');
                cb_col.append(colorbar);

                const cb_row = L.DomUtil.create('div', 'row');
                cb_row.append(cb_col);

                const lbl_col_min = L.DomUtil.create('div', 'col-auto ms-2');
                lbl_col_min.id = "colorbar-min"
                lbl_col_min.textContent = "Min";

                const lbl_units = L.DomUtil.create('div', 'col');
                lbl_units.id = "colorbar-units"
                lbl_units.textContent = "(units)";

                const lbl_col_max = L.DomUtil.create('div', 'col-auto me-2');
                lbl_col_max.id = "colorbar-max"
                lbl_col_max.textContent = "Max";

                const lbl_row = L.DomUtil.create('div', 'row');
                lbl_row.append(lbl_col_min);
                lbl_row.append(lbl_units);
                lbl_row.append(lbl_col_max);

                this._div = L.DomUtil.create('div', 'colorbar-container border border-black border-3');
                this._div.style.background = "#FFF";
                this._div.append(cb_row);
                this._div.append(lbl_row);
                // this._div.innerHTML = `<span id="colorbar-min">Min</span> <span id="colorbar-max" style="float: right;">Max</span>`;
                return this._div;
            };

            colorbarControl.addTo(this.map);
        },

        loadMpaFile() {
            if (!this.map) {
                return;
            }

            const model_file = `mpa_model_${this.climate_model}.geojson`;
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

        handleMouseOver(evt) {
            if (!this.activeLayer || !this.activeRaster) {
                return;
            }

            const layer_props = this.layerFiles[this.activeLayer];
            const infoControl = document.getElementById('layer-info-control')
            const rasterData = layer_props.loadedRasters.find(raster => raster.label === this.activeRaster);
            const georaster = rasterData.georaster;
            const latlng = evt.latlng;
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
        },

        // Function to update the colorbar
        updateColorbar() {
            const layerProps = this.layerFiles[this.activeLayer]
            const min = layerProps.globalMin;
            const max = layerProps.globalMax;

            const colors = layerProps.colors;
            const units = layerProps.data.units;

            const gradient = colors.map(color => `rgb(${color.r}, ${color.g}, ${color.b})`).join(', ');
            const colorbar = document.getElementById('colorbar-ramp');
            if (colorbar) {
                colorbar.style.background = `linear-gradient(to right, ${gradient})`;
            }

            const minLabel = document.getElementById('colorbar-min');
            const unitsLabel = document.getElementById('colorbar-units');
            const maxLabel = document.getElementById('colorbar-max');
            if (minLabel && maxLabel) {
                minLabel.textContent = min.toFixed(4);
                unitsLabel.textContent = "(" + units + ")";
                maxLabel.textContent = max.toFixed(4);
            }
        },

        async changeLayer(layerType, selectedRaster = null) {
            if (layerType === null) {
                this.activeLayer = null;
                this.activeRaster = null;
                return;
            }
            if (this.activeLayer !== layerType) {
                // Remove all layers from the previous active layer
                if (this.activeLayer && this.layerFiles[this.activeLayer]?.loadedRasters) {
                    this.layerFiles[this.activeLayer].loadedRasters.forEach(raster => {
                        this.map.removeLayer(raster.layer);
                    });
                }

                // Set the new active layer and load its rasters
                this.activeLayer = layerType;
                const layerProps = this.layerFiles[this.activeLayer];

                await this.loadGeoTiff(layerProps.data.rasters);
                // this.layerFiles[this.activeLayer].data.rasters.forEach(raster => {
                //     this.displayRaster(raster.label, true);
                // });
                this.updateColorbar();
            }

            const layerProps = this.layerFiles[this.activeLayer];
            selectedRaster = selectedRaster || layerProps.data.rasters[0].label;
            this.displayRaster(selectedRaster, true);
        },

        displayRaster(selectedRaster, reloadColors = false) {
            const activeRasterData = this.layerFiles[this.activeLayer].loadedRasters.find(r => r.label === this.activeRaster);
            const newRasterData = this.layerFiles[this.activeLayer].loadedRasters.find(r => r.label === selectedRaster);
            if (activeRasterData) {
                this.map.removeLayer(activeRasterData.layer); // Hide raster
                this.activeRaster = null;
            }
            this.map.addLayer(newRasterData.layer); // Show raster
            this.activeRaster = selectedRaster;

            if (reloadColors) {
                newRasterData.layer.updateColors(this.set_color)
            }
        },

        async loadGeoTiff(rasters) {
            if (!rasters || rasters.length === 0) return;

            const rasterPromises = rasters.map(raster => {
                const url = this.path_to_geofolder + raster.file_name;
                return fetch(url)
                    .then(response => {
                        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                        return response.arrayBuffer();
                    })
                    .then(arrayBuffer => parseGeoraster(arrayBuffer))
                    .then(georaster => {
                        const layer = new GeoRasterLayer({
                            georaster: georaster,
                            resolution: 256,
                        });

                        return {
                            label: raster.label,
                            file_name: raster.file_name,
                            georaster: georaster,
                            layer: layer,
                        };
                    });
            });

            try {
                this.layerFiles[this.activeLayer].loadedRasters = await Promise.all(rasterPromises);

                let globalMin = Infinity;
                let globalMax = -Infinity;

                this.layerFiles[this.activeLayer].loadedRasters.forEach(raster => {
                    const {mins, maxs} = raster.georaster;
                    globalMin = Math.min(globalMin, mins[0]);
                    globalMax = Math.max(globalMax, maxs[0]);
                });
                this.layerFiles[this.activeLayer].globalMin = globalMin
                this.layerFiles[this.activeLayer].globalMax = globalMax
            } catch (error) {
                console.error('Error loading rasters:', error);
            }
        },

        set_color(values) {
            const layerProps = this.layerFiles[this.activeLayer];
            const colors = layerProps.colors;
            const min = layerProps.globalMin;
            const max = layerProps.globalMax;
            const value = values[0];

            const normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));
            const numSegments = colors.length - 1;
            const segment = Math.min(Math.floor(normalizedValue * numSegments), numSegments - 1);
            const segmentPosition = (normalizedValue * numSegments) - segment;

            const color1 = colors[segment];
            const color2 = colors[segment + 1];

            const r = Math.round(color1.r + segmentPosition * (color2.r - color1.r));
            const g = Math.round(color1.g + segmentPosition * (color2.g - color1.g));
            const b = Math.round(color1.b + segmentPosition * (color2.b - color1.b));

            return `rgba(${r}, ${g}, ${b}, 1.0)`;
        },
    },

    beforeUnmount() {
        if (this.map) {
            this.map.remove();
        }
    }
};