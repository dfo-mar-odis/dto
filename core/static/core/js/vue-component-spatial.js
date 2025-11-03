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

export const SpatialAnalysis = {
    template: `
      <div class="card">
        <div class="card-body">
          <div class="row">
            <div class="col-3">
              <button 
                v-for="(layer, key) in layerFiles" 
                :key="key" 
                class="btn btn-outline-dark mb-1" 
                @click="changeLayer(key)"
                :class="{'active': activeLayer === key}">
                {{ layer.data.title }}
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
                    // file_name gets set in the watch function, and depends on the selected climate model. It follows
                    // the format [climate_model_id]_bottomTtrend.tif
                    file_name: null,
                    file_postfix: "_bottomTtrend.tif",
                    colors: trend_colour,
                    data: {
                        title: 'Bottom Temperature Trend',
                        label: 'Trend',
                        units: '°C/decade',
                        fixed: 4
                    }
                },
                mean_bottom_temp: {
                    // file_name gets set in the watch function, and depends on the selected climate model. It follows
                    // the format [climate_model_id]_meanBottomTemp.tif
                    file_name: null,
                    file_postfix: "_meanBottomTemp.tif",
                    colors: viridis_colour,
                    data: {
                        title: 'Mean Bottom Temperature',
                        label: 'Mean Bottom Temp.',
                        units: '°C',
                        fixed: 4
                    }
                },
                thermal_stress: {
                    // file_name gets set in the watch function, and depends on the selected climate model. It follows
                    // the format [climate_model_id]_meanThermalStress.tif
                    file_name: null,
                    file_postfix: "_meanThermalStress.tif",
                    colors: viridis_colour,
                    data: {
                        title: 'Mean Thermal Stress',
                        label: 'Mean Thermal Stress',
                        units: 'Weeks',
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
                    Object.keys(this.layerFiles).forEach(layer => {
                        this.layerFiles[layer].file_name = newValue + this.layerFiles[layer].file_postfix;
                    });
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
                // Initialize the map
                this.map = L.map('spatial-map', {
                    center: [43.75, -63.5],
                    zoom: 5,
                });

                this.addBaseLayer();
                this.addMapControls()

                if(this.climate_model) {
                    this.changeLayer('shelf_trend')
                }
            } else {
                console.error('Leaflet library not loaded');
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
            const colorbarControl = L.control({ position: 'bottomleft' });

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

        handleMouseOver(evt) {
            if(!this.geotiffLayer) {
                return;
            }

            const layer_props = this.layerFiles[this.activeLayer];
            const infoControl= document.getElementById('layer-info-control')
            const georaster = this.geotiffLayer.georasters[0];
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
        updateColorbar(min, max) {
            const colors = this.layerFiles[this.activeLayer].colors;
            const units = this.layerFiles[this.activeLayer].data.units;

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

        changeLayer(layerType) {
            if (this.activeLayer === layerType) return;

            this.activeLayer = layerType;

            // Remove current layer if it exists
            if (this.geotiffLayer) {
                this.map.removeLayer(this.geotiffLayer);
                this.geotiffLayer = null;
            }

            // Load the new layer
            const layer_props = this.layerFiles[this.activeLayer];
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
                    }).then(georaster => {
                        this.geotiffLayer = new GeoRasterLayer({
                            georaster: georaster,
                            opacity: 1.0,
                            resolution: 256,
                        });

                        this.geotiffLayer.addTo(this.map);
                        this.geotiffLayer.updateColors(this.set_color)

                        if (this.geotiffLayer) {
                            const min = this.geotiffLayer.georasters[0].mins[0];
                            const max = this.geotiffLayer.georasters[0].maxs[0];
                            this.updateColorbar(min, max);
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