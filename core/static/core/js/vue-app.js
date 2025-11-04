import {StandardAnomalyChart} from "./vue-chart-standard-anomaly.js";
import {SiteIndicatorsChart} from "./vue-chart-site-indicators.js";
import {QuantileChart} from "./vue-chart-quantile.js";
import {SpeciesChartContainer} from "./vue-components-species.js";
import {MPAInfo} from "./vue-components-mpa-info.js";
import {MPAControls} from "./vue-components-mpa-controls.js";
import {NetworkIndicators} from "./vue-chart-network-data.js";
import {HeatWaveIndicator} from "./vue-components-heat-wave-indicator.js";
import {SpatialAnalysis} from "./vue-component-spatial.js";

const {createApp, ref, reactive, watch, computed, onMounted} = Vue;

const mapApp = createApp({
    delimiters: ['${', '}'],
    setup() {
        // State
        const state = reactive({
            model_id: null,
            mapLoading: false,
            selectedPolygon: null,
            selectedPolygons: [],
            mpa: {
                id: 0,
                name: '',
                url: '',
                class: '',
                km2: 0,
                depths: []
            },
            // 1 for Bottom timeseries, 2 for Surface. This is how it's defined in the core.model
            // timeseries_type: 1,
            dates: {
                selected_date: null,
                start_date: '',
                end_date: ''
            },
            depth: '',
            loading: false,
            charts: {
                standardAnomalies: null,
                timeseries: null,
            },
            timeseriesData: null,
            isCtrlPressed: false,
            networkIndicatorData: {
                currentPoint: null,
                currentQuantile: null,
                quantileData: {
                    minDelta: null,
                    maxDelta: null
                }
            },

            // Track Cached Heatwave indicator data.
            networkDataCache: new Map(),
            networkDataCacheDate: null,

            filterMPAs: []
        });

        const paths = {
            urls: {
                climateBoundsUrl: '',
                mpasWithTimeseriesList: '', // Will be populated from template
                timeseriesUrl: '',
                legendUrl: '',
                speciesUrl: '',
                heatWaveIndicatorUrl: ''
            },
        }
        // Populate the tabs data structure
        // eg. this will set the first tab as the active tab
        // {
        //      activeTab: 'tab_id',
        //      tabList: { tab_id: { title: "label" }, tab1_id: { title: "label_1"}, ... }
        // }
        const tabs = reactive({});

        const highlightStyles = {
            primary: {
                color: '#5D3FD3',      // Deep purple border
                weight: 3,
                opacity: 0.9,
                fillColor: '#8A2BE2',  // Purple fill
                fillOpacity: 0.6
            },
            secondary: {
                color: '#9370DB',      // Medium purple border
                weight: 2,
                opacity: 0.8,
                fillColor: '#D8BFD8',  // Lavender fill
                fillOpacity: 0.5
            }
        }

        // Watch for date changes to invalidate cache
        watch(() => state.dates.selected_date, () => {
            // Clear cache when date changes
            state.networkDataCache.clear();
            state.networkDataCacheDate = null;
        })

        // Initialize everything
        onMounted(() => {
            // Using Esri World Imagery as satellite base map
            // const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
            //     attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri',
            //     maxZoom: 13
            // });
            const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
                maxZoom: 19
            });

            // Initialize map
            state.map = L.map('map', {
                center: [43.75, -63.5],
                zoom: 5,
                layers: [satellite],
            }); // Center on world view

            initCtrlKeyTracking();
        });

        function addFilterMPA(mpa_id) {
            state.filterMPAs.push(mpa_id)
        }

        function initCtrlKeyTracking() {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Control') state.isCtrlPressed = true;
            });

            document.addEventListener('keyup', (e) => {
                if (e.key === 'Control') state.isCtrlPressed = false;
            });
        }

        // Helper function to process MPA data and add to map

        function add_feature_popups(feature, layer) {
            // Don't bind tooltip initially - wait for mouseover
            layer.on('mouseover', (e) => {
                const content = getTooltipContent(layer, null);

                // Only bind tooltip if we have content
                if (content) {
                    if (!layer.getTooltip()) {
                        layer.bindTooltip(content, {
                            permanent: false,
                            direction: 'top',
                            opacity: 0.9
                        });
                    }
                    layer.openTooltip();
                }
            });

            layer.on('mouseout', () => {
                layer.closeTooltip();
            });

            layer.on('click', () => {
                handlePolygonSelection(layer, feature);
            });
        }

        async function add_geojson(geoJsonData, feature_popups_func) {

            // Filter MPAs if needed
            let filteredFeatures = geoJsonData.features;
            if (state.filterMPAs && state.filterMPAs.length > 0) {
                const mpaIdsToShow = new Set(state.filterMPAs);
                filteredFeatures = geoJsonData.features.filter(feature =>
                    mpaIdsToShow.has(feature.properties.id)
                );
            }

            // Create a new feature collection with filtered features
            const filteredGeoJson = {
                type: "FeatureCollection",
                features: filteredFeatures
            };

            if(feature_popups_func) {
                // Add to map
                state.mpaLayer = L.geoJSON(filteredGeoJson, {
                    style: feature => feature.style,
                    onEachFeature: (feature, layer) => {
                        feature_popups_func(feature, layer);
                    }
                }).addTo(state.map);
            } else {
                // Add to map
                state.mpaLayer = L.geoJSON(filteredGeoJson, {
                    style: feature => feature.style,
                    interactive: false
                }).addTo(state.map);
            }
        }

        async function loadAOIsForModel() {
            const modelId = state.model_id.toString().toUpperCase();
            const model_file = `${modelId}_domain.geojson`;
            const geojsonUrl = paths.polygons_dir + model_file;

            try {
                const response = await fetch(geojsonUrl);
                if (!response.ok) {
                    throw new Error(`Failed to load MPA data: ${response.statusText}`);
                }

                const geoJsonData = await response.json();
                add_geojson(geoJsonData, null);

                const legendContainer = document.getElementById('legend-container');
                const div = L.DomUtil.create('div', 'mb-2');
                div.id = "boundry-legend-content"
                div.innerHTML += '<h4>Model Domain </h4>';
                div.innerHTML += '<div><span style="background: ' + geoJsonData.features[0].style.color + '"></span> ' + geoJsonData.features[0].properties.name + '</div>';
                legendContainer.appendChild(div)
            } catch (error) {
                // there may not be a file for the area of interest. GLORYS for example doesn't have one
                console.warn("Error loading MPA polygons:", error);
            }
        }

        async function loadMPAPolygons() {

            const modelId = state.model_id.toString().toUpperCase();
            const model_file = `mpa_model_${modelId}.geojson`;
            const geojsonUrl = paths.polygons_dir + model_file;

            try {
                const response = await fetch(geojsonUrl);
                if (!response.ok) {
                    throw new Error(`Failed to load MPA data: ${response.statusText}`);
                }

                const geoJsonData = await response.json();
                add_geojson(geoJsonData, add_feature_popups);
                            // Create a legend control

                // Fetch classifications data from the endpoint
                fetch(paths.urls.legendUrl)
                    .then(response => response.json())
                    .then(data => {
                        const legendContainer = document.getElementById('legend-container');

                        legendContainer.innerHTML += '<h4>' + (window.translations?.mpa_classifications || 'MPA Classifications') + '</h4>';
                        const legendContent = L.DomUtil.create('div');
                        legendContent.id = 'legend-content'

                        // Populate legend with classification data
                        data.forEach(classification => {
                            legendContent.innerHTML +=
                                '<div><span style="background:' + classification.colour +
                                '"></span> ' + classification.name + '</div>';
                        });
                        legendContainer.appendChild(legendContent)
                    })
                    .catch(error => {
                        console.error('Error fetching classifications:', error);
                        document.getElementById('legend-content').innerHTML = 'Error loading legend data';
                    });
            } catch (error) {
                // there should be a file for the MPA polygons belonging to a model
                console.error("Error loading MPA polygons:", error);
            }
        }

        async function loadSpecies() {
            if (!paths.urls.speciesUrl) return;

            try {
                // First fetch to get metadata and process first page
                const initialResponse = await fetch(paths.urls.speciesUrl);
                const initialData = await initialResponse.json();

                if (!initialData || !Array.isArray(initialData)) {
                    console.error("Unexpected data format:", initialData);
                    return;
                }

                state.species = initialData;
            } catch (error) {
                console.error("Error loading species dataset:", error);
            }
        }

        function TS_getStatusClass(netdata) {
            if (!netdata.quantile) return '';

            const value = parseFloat(netdata.data.ts_data);
            const clim = parseFloat(netdata.data.clim);
            const upperQ = parseFloat(netdata.quantile.upperq);
            const lowerQ = parseFloat(netdata.quantile.lowerq);

            if (value > upperQ) return 'bg-danger';  // Heat wave
            else if (value > clim) return 'bg-danger-subtle';
            else if (value < lowerQ) return 'bg-primary'; // Cold wave
            else if (value < clim) return 'bg-primary-subtle';
            return 'bg-success';                     // Normal range
        }

        function formatNumber(num, places) {
            return num.toFixed(places)
        }

        function getTooltipContent(layer, netdata) {
            // Basic tooltip content with MPA name
            let content = `<div>${layer.feature.properties.name || "Unnamed MPA"}</div>`;

            // Add network indicators if a date is selected
            if (state.dates.selected_date) {
                const mpaId = layer.feature.properties.id;

                // Check if we need to fetch network data
                if (!state.networkDataCache.has(mpaId) ||
                    state.networkDataCacheDate !== state.dates.selected_date) {

                    // Fetch data for this specific MPA
                    fetchNetworkIndicatorDataForMPA(mpaId, layer);

                    // Return basic tooltip while loading
                    return `<div>${layer.feature.properties.name || "Unnamed MPA"}<br/><em>Loading...</em></div>`;
                }

                // Use cached data
                netdata = state.networkDataCache.get(mpaId);

                const curValue = (netdata.data.ts_data - netdata.data.climatology)
                const curAnom = curValue / netdata.data.std_dev
                let maxAnom = netdata.max_delta / netdata.data.std_dev
                if (curValue < netdata.data.climatology)
                    maxAnom = Math.abs(netdata.max_delta / netdata.data.std_dev)

                const percentage = Math.abs(curAnom) / maxAnom

                content = `
                <div class="row">
                    <div class="col text-center">` +
                    (window.translations?.total_average_bottom || 'Total Average Bottom') +
                    ` ${state.dates.selected_date}</div>
                </div>
                <div class="row">
                    <div class="col">
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar ${TS_getStatusClass(netdata)}" role="progressbar"
                                 style="width: ${percentage * 100}%"
                                 aria-valuenow="${percentage}"
                                 aria-valuemin="0"
                                 aria-valuemax="${maxAnom}">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="row">
                    <small class="form-text text-muted mt-1">${netdata.name}</small>
                </div>
                <div class="row">
                    <div class="col">
                    <table class="table table-sm text-center striped-columns">
                        <thead>
                            <tr>
                                <th>` + (window.translations?.abbreviated_std_anomaly || 'Std. Anom') + `</th>
                                <th>°C</th>
                                <th>` + (window.translations?.abbreviated_average || 'Avg') + `(°C)</th>
                                <th>σ</th>
                                <th>90%</th>
                                <th>10%</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${formatNumber(curAnom, 3)}</td>
                                <td>${formatNumber(netdata.data.ts_data, 3)}</td>
                                <td>${formatNumber(netdata.data.climatology, 3)}</td>
                                <td>${formatNumber(netdata.data.std_dev, 3)}</td>
                                <td>${formatNumber(netdata.quantile.upperq, 3)}</td>
                                <td>${formatNumber(netdata.quantile.lowerq, 3)}</td>
                            </tr>
                        </tbody>
                    </table>
                    </div>
                </div>`;

                const isTooltipOpen = layer.isTooltipOpen();

                layer.bindTooltip(content, {
                    permanent: false, // Set to true if you want tooltips always visible
                    direction: 'top', // Position relative to the feature (top, bottom, left, right, center)
                    opacity: 0.9 // Control tooltip opacity
                });

                if (isTooltipOpen) {
                    layer.openTooltip();
                }
            }

            return content;
        }

        function setMPA(mpa) {
            state.mpa.id = mpa.id
            state.mpa.name = mpa.name;
            state.mpa.url = mpa.url;
            state.mpa.class = mpa.class;
            state.mpa.km2 = mpa.km2;
            state.mpa.depths = mpa.depths;

        }

        function handlePolygonSelection(layer, feature) {

            const newPoly = {layer, feature}
            // If CTRL is pressed
            if (state.isCtrlPressed) {

                // If MPA is not the currently selected polygon
                const existingIndex = state.selectedPolygons.findIndex(
                    item => item.feature?.properties?.id === feature.properties.id
                );

                // If it's not in the Poly list
                //  set the style of other polys in the list to be active, but not primary
                //  highlight the new poly
                //  add it to the list
                // else
                //   Remove it from the Poly list
                //   reset its style
                if(feature.properties.id !== state.selectedPolygon.feature.properties.id) {
                    state.selectedPolygons.forEach((item, index) => {
                        item.layer.setStyle(highlightStyles.secondary);
                    });
                    if(existingIndex <= -1) {
                        state.selectedPolygons.push(newPoly)
                    }
                    newPoly.layer.setStyle(highlightStyles.primary)
                } else {
                    state.selectedPolygons.splice(existingIndex, 1);
                    newPoly.layer.setStyle(feature.style)
                }

            } else {
                // if CTRL isn't pressed
                //   reset the styles of all polys in the list
                //   clear the selected polygon list
                //   add the new poly as the only polygon
                state.selectedPolygons.forEach((item, index) => {
                    item.layer.setStyle(item.feature.style);
                });
                newPoly.layer.setStyle(highlightStyles.primary);
                state.selectedPolygons = [newPoly]
            }

            // make it the currently selected MPA
            // Always update the MPA info panel with the most recently selected polygon
            state.selectedPolygon = newPoly
            setMPA({
                id: feature.properties.id,
                name: feature.properties.name || 'Unknown MPA',
                url: feature.properties.url || '',
                class: feature.properties.class || '',
                km2: feature.properties.km2 || '',
                depths: feature.properties.depths || []
            });
            getData();
        }

        function updateSelectedPolygons(polygonList) {
            // Ensure polygonList is always an array
            polygonList = polygonList || [];

            // Create a set of IDs from the new polygon list for quick lookup
            const newPolygonIds = new Set(polygonList.map(p => p.mpa?.properties?.id));

            // Reset styles for polygons that are being removed from selection
            state.selectedPolygons.forEach(item => {
                if (!newPolygonIds.has(item.mpa?.properties?.id)) {
                    item.layer.setStyle(item.mpa.style);
                }
            });

            state.selectedPolygons = polygonList;
            state.selectedPolygons.forEach((item, index) => {
                const isLast = item === state.selectedPolygon;
                const style = isLast ? highlightStyles.primary : highlightStyles.secondary;
                item.layer.setStyle(style);
            });
        }

        function addLegend(map) {
            if (!state.map || !paths.urls.legendUrl) return;

            // Create a custom button control to hide and show the legend
            const legendToggle = L.Control.extend({
                options: {
                    position: 'bottomright'
                },

                onAdd: function () {
                    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control legend-toggle');
                    container.innerHTML = '<a href="#" title="Toggle Legend"><i class="fa fa-list"></i></a>';

                    L.DomEvent.on(container, 'click', function (e) {
                        e.preventDefault();
                        document.querySelector('.legend').classList.toggle('hidden');
                    });

                    return container;
                }
            });
            state.map.addControl(new legendToggle());

            const legend = L.control({position: 'bottomright'});

            legend.onAdd = function () {
                const div = L.DomUtil.create('div', 'info legend hidden');
                div.id = 'legend-container'

                return div;
            };

            legend.addTo(state.map);
        }

        function setSelectedDate(date) {
            if(date !== state.dates.selected_date) {
                state.dates.selected_date = date;
            }
        }

        function setSelectedDateRange(dateRange) {
            if (typeof dateRange === 'object' && dateRange !== null) {
                // Handle dateRange object from MPAControls
                state.dates = dateRange.date
            }

            // Check canvas exists before attempting to draw
            const canvas = document.getElementById('chart-canvas');
            if (!canvas) {
                setTimeout(getData, 200);
                return;
            }

            getData();
        }

        function setSelectedDepth(depth) {
            if(String(depth) != state.depth) {
                state.depth = String(depth);
                getData();
            }
        }

        async function fetchNetworkIndicatorDataForMPA(mpaId, layer) {
            if (!state.dates.selected_date || !paths.urls.heatWaveIndicatorUrl) return;

            try {
                const url = new URL(paths.urls.heatWaveIndicatorUrl, window.location.origin);
                url.searchParams.set('mpa_id', mpaId);
                url.searchParams.set('date', state.dates.selected_date);
                url.searchParams.set('type', state.timeseries_type);

                const response = await fetch(url.toString());

                if (!response.ok) {
                    throw new Error(`Network response error: ${response.status}`);
                }

                const data = await response.json();

                if (data[mpaId] && data[mpaId].data) {
                    // Cache the data
                    state.networkDataCache.set(mpaId, data[mpaId]);
                    state.networkDataCacheDate = state.dates.selected_date;

                    // Update the tooltip with the fetched data
                    getTooltipContent(layer, data[mpaId]);
                }
            } catch (error) {
                console.error(`Error fetching network indicator data for MPA ${mpaId}:`, error);
            }
        }

        async function getData() {
            state.loading = true;

            try {
                if (!state.mpa.id) {
                    return;
                }

                // This endpoint will return a timeseries and climatology that can be used in multiple charts
                const tsUrl = new URL(paths.urls.timeseriesUrl, window.location.origin);
                tsUrl.searchParams.set('mpa_id', state.mpa.id);
                tsUrl.searchParams.set('start_date', state.dates.start_date);
                tsUrl.searchParams.set('end_date', state.dates.end_date);
                tsUrl.searchParams.set('type', state.timeseries_type);

                // if depth isn't specified then it'll be None and will return the
                // Total Average Bottom Timeseries
                tsUrl.searchParams.set('depth', state.depth);

                const response = await fetch(tsUrl.toString());
                state.timeseriesData = await response.json();

            } catch (error) {
                console.error("Error fetching chart data:", error);
            } finally {
                state.loading = false;
            }
        }

        function updateNetworkIndicator(data) {
            state.networkIndicatorData = data;
        }

        async function initialize(model_id, polygons_dir, climateBoundsUrl, mpasUrl, timeseriesUrl, legendUrl, speciesUrl, heatWaveIndicatorUrl, timeseries_type, tabsData) {
            paths.polygons_dir = polygons_dir;
            state.model_id = model_id;
            paths.urls.climateBoundsUrl = climateBoundsUrl;
            paths.urls.mpasWithTimeseriesList = mpasUrl;
            paths.urls.timeseriesUrl = timeseriesUrl;
            paths.urls.legendUrl = legendUrl;
            paths.urls.speciesUrl = speciesUrl;
            paths.urls.heatWaveIndicatorUrl = heatWaveIndicatorUrl;

            state.timeseries_type = timeseries_type
            Object.assign(tabs, tabsData)

            if (!state.map) return;

            // Clear existing layers if any
            if (state.mpaLayer) {
                state.map.removeLayer(state.mpaLayer);
            }

            state.mapLoading = true;
            try {
                addLegend(state.map);
                // make sure AOI loads first
                await loadAOIsForModel();
                await loadMPAPolygons();
            } catch (error) {
                console.error("Error loading data:", error);
            } finally {
                setTimeout(() => {
                    state.mapLoading = false;
                }, 1000);
            }
            loadSpecies();
        }

        return {
            state,
            tabs,
            initialize,
            addFilterMPA,
            setMPA,
            setSelectedDate,
            setSelectedDateRange,
            setSelectedDepth,
            getData,
            updateSelectedPolygons,
            updateNetworkIndicator,
        };
    },
});

mapApp.component('standard-anomaly-chart', StandardAnomalyChart);
mapApp.component('site-indicators-chart', SiteIndicatorsChart);
mapApp.component('quantile-chart', QuantileChart);
mapApp.component('species-chart-container', SpeciesChartContainer);
mapApp.component('mpa-info', MPAInfo);
mapApp.component('mpa-controls', MPAControls);
mapApp.component('network-indicators', NetworkIndicators);
mapApp.component('heat-wave-indicator', HeatWaveIndicator);
mapApp.component('spatial-analysis', SpatialAnalysis);

window.mapApp = mapApp;