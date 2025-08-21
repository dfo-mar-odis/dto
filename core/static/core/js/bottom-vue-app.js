import {StandardAnomalyChart} from "./vue-chart-standard-anomaly.js";
import {QuantileChart} from "./vue-chart-quantile.js";
import {SpeciesChartContainer} from "./vue-components-species.js";
import {MPAInfo} from "./vue-components-mpa-info.js";
import {MPAControls} from "./vue-components-mpa-controls.js";
import {NetworkIndicators} from "./vue-chart-network-data.js";
import {NetworkIndicator} from "./vue-components-network-indicator.js";

const {createApp, ref, reactive, watch, computed, onMounted} = Vue;

const mapApp = createApp({
    delimiters: ['${', '}'],
    setup() {
        // State
        const state = reactive({
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
            dates: {
                selected_date: null,
                start_date: '',
                end_date: ''
            },
            depth: '',
            loading: false,
            activeTab: 'timeseries_data',
            urls: {
                mpasWithTimeseriesList: '', // Will be populated from template
                timeseriesUrl: '',
                legendUrl: '',
                speciesUrl: '',
                networkIndicatorUrl: ''
            },
            charts: {
                standardAnomalies: null,
                timeseries: null,
            },
            timeseriesData: null,
            isCtrlPressed: false,
            highlightStyles: {
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
            },
            networkIndicatorData: {
                currentPoint: null,
                currentQuantile: null,
                quantileData: {
                    minDelta: null,
                    maxDelta: null
                }
            },
            filterMPAs: []
        });

        // Initialize everything
        onMounted(() => {
            // Using Esri World Imagery as satellite base map
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

            // Initialize map
            if (typeof MapApp !== 'undefined') {
                MapApp.init(
                    state.urls.mpasWithTimeseriesList,
                    state.urls.timeseriesUrl,
                    state.urls.legendUrl,
                    state.urls.speciesURL,
                    state.urls.networkIndicatorUrl,
                );
            }

            initCtrlKeyTracking();
        });

        function addFilterMPA(mpa_id) {
            state.filterMPAs.push(mpa_id)
        }

        function initialize(mpasUrl, timeseriesUrl, legendUrl, speciesUrl, networkIndicatorUrl) {
            state.urls.mpasWithTimeseriesList = mpasUrl;
            state.urls.timeseriesUrl = timeseriesUrl;
            state.urls.legendUrl = legendUrl;
            state.urls.speciesUrl = speciesUrl;
            state.urls.networkIndicatorUrl = networkIndicatorUrl;

            loadMPAPolygons();
            loadSpecies();
        }

        // Populate the tabs data structure
        const tabs = reactive({
            timeseries_data: {title: window.translations?.timeseries || 'Timeseries'},
            standard_anomaly_data: {title: window.translations?.standard_anomalies || 'Standard Anomalies'},
            species_data: {title: window.translations?.species_data || 'Species Data'},
            network_data: {title: window.translations?.network_data || 'Network Data'},
        });

        // Methods
        function setMapView(lat, lng, zoom) {
            if (state.map) {
                state.map.setView([lat, lng], zoom);
            }
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

        function processMPAData(mpas) {
            mpas.forEach(mpa => {
                if (mpa.geometry) {
                    L.geoJSON(mpa, {
                        style: mpa.style,
                        onEachFeature: (feature, layer) => {
                            layer.bindTooltip(mpa.properties.name || "Unnamed MPA", {
                                permanent: false, // Set to true if you want tooltips always visible
                                direction: 'top', // Position relative to the feature (top, bottom, left, right, center)
                                className: 'my-tooltip', // Add custom CSS class for styling
                                opacity: 0.9 // Control tooltip opacity
                            });
                            layer.on('click', () => {
                                handlePolygonSelection(layer, mpa);
                            });
                        }
                    }).addTo(state.map);
                }
            });
        }

        async function loadMPAPolygons() {
            if (!state.map || !state.urls.mpasWithTimeseriesList) return;

            const page_size = 5;
            state.mapLoading = true;
            try {
                // if you query the api with geometry=false you get the mpa metadata without the geometry
                // this loads much faster to help us determine how many polygons there'll be and how many
                // calls we'll have to make to load them all.
                const url = new URL(state.urls.mpasWithTimeseriesList, window.location.origin);
                url.searchParams.set('geometry', 'false'); // Add geometry=false to the query parameters
                url.searchParams.set('page_size', 1)
                if (state.filterMPAs) {
                    state.filterMPAs.forEach(mpa => {
                        url.searchParams.append('mpa_id', mpa);
                    });
                }

                const initialResponse = await fetch(url.toString());
                const initialData = await initialResponse.json();

                if (!initialData.count) {
                    // no polygons were returned
                    state.mapLoading = false;
                    return;
                }

                // Calculate total pages based on count and results per page
                const totalPages = Math.ceil(initialData.count / page_size);

                // Fetch and process all pages
                const pagePromises = [];
                for (let page = 1; page <= totalPages; page++) {
                    const pageUrl = new URL(state.urls.mpasWithTimeseriesList, window.location.origin);
                    pageUrl.searchParams.set('page_size', page_size)
                    if (state.filterMPAs) {
                        state.filterMPAs.forEach(mpa => {
                            pageUrl.searchParams.append('mpa_id', mpa);
                        });
                    }
                    pageUrl.searchParams.set('page', page.toString());

                    pagePromises.push(
                        fetch(pageUrl.toString())
                            .then(response => response.json())
                            .then(pageData => processMPAData(pageData.results || []))
                            .catch(err => console.error(`Error loading page ${page}:`, err))
                    );
                }
                // Load all remaining pages in parallel
                await Promise.all(pagePromises);

                state.mapLoading = false;
                fetchNetworkIndicatorData();
                addLegend();
            } catch (error) {
                console.error("Error loading MPA polygons:", error);
                state.mapLoading = false; // Make sure to stop loading on error
            }
        }

        async function loadSpecies() {
            if (!state.urls.speciesUrl) return;

            try {
                // First fetch to get metadata and process first page
                const initialResponse = await fetch(state.urls.speciesUrl);
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
                const curValue = (netdata.data.ts_data - netdata.data.clim)
                const curAnom = curValue / netdata.data.std_dev
                let maxAnom = netdata.max_delta / netdata.data.std_dev
                if (curValue < netdata.data.clim)
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

        function handlePolygonSelection(layer, mpa) {

            // Always update the MPA info panel with the most recently selected polygon
            state.selectedPolygon = {layer, mpa}
            if (state.isCtrlPressed) {
                state.selectedPolygon.layer.setStyle(mpa.style);
            }
            setMPA({
                id: mpa.properties.id,
                name: mpa.properties.name || 'Unknown MPA',
                url: mpa.properties.url || '',
                class: mpa.properties.class || '',
                km2: mpa.properties.km2 || '',
                depths: mpa.properties.depths || []
            });
        }

        // This forces the refresh of the network indicator data that's used in popups when hovering
        // over an area on the map
        async function fetchNetworkIndicatorData() {
            if (!state.dates.selected_date || !state.urls.networkIndicatorUrl) return;

            try {
                // Collect polygon layers and their IDs in a single pass
                const polygonLayersMap = new Map();
                state.map.eachLayer(layer => {
                    if (layer.feature?.properties?.id) {
                        polygonLayersMap.set(layer.feature.properties.id, layer);
                    }
                });

                if (polygonLayersMap.size === 0) return;

                // Use comma-separated IDs for a more compact URL
                const polygonIds = Array.from(polygonLayersMap.keys());
                const url = new URL(state.urls.networkIndicatorUrl, window.location.origin);

                // Add parameters using searchParams API
                url.searchParams.set('id', polygonIds.join(','));
                url.searchParams.set('date', state.dates.selected_date);

                const response = await fetch(url.toString());

                if (!response.ok) {
                    throw new Error(`Network response error: ${response.status}`);
                }

                const data = await response.json();

                // Update tooltips only for layers with returned data
                polygonLayersMap.forEach((layer, id) => {
                    if (data[id]) {
                        getTooltipContent(layer, data[id]);
                    }
                });
            } catch (error) {
                console.error("Error fetching network indicator data:", error);
            }
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
                const style = isLast ? state.highlightStyles.primary : state.highlightStyles.secondary;
                item.layer.setStyle(style);
            });
        }

        function addLegend(map) {
            if (!state.map || !state.urls.legendUrl) return;

            // Create a custom button control
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

            // Create a legend control
            const legend = L.control({position: 'bottomright'});

            legend.onAdd = function () {
                const div = L.DomUtil.create('div', 'info legend hidden');
                div.innerHTML += '<h4>' + (window.translations?.mpa_classifications || 'MPA Classifications') + '</h4><div id="legend-content">' + (window.translations?.loading || 'Loading...') + '</div>';
                return div;
            };

            state.map.addControl(new legendToggle());
            legend.addTo(state.map);

            // Fetch classifications data from the endpoint
            fetch(state.urls.legendUrl)
                .then(response => response.json())
                .then(data => {
                    const legendContent = document.getElementById('legend-content');
                    legendContent.innerHTML = '';

                    // Populate legend with classification data
                    data.forEach(classification => {
                        legendContent.innerHTML +=
                            '<div><span style="background:' + classification.colour +
                            '"></span> ' + classification.name + '</div>';
                    });
                })
                .catch(error => {
                    console.error('Error fetching classifications:', error);
                    document.getElementById('legend-content').innerHTML = 'Error loading legend data';
                });
        }

        function setSelectedDate(date) {
            state.dates.selected_date = date;
            fetchNetworkIndicatorData();
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
            fetchNetworkIndicatorData();
        }

        function setSelectedDepth(depth) {
            state.depth = String(depth);
            fetchNetworkIndicatorData();
            getData();
        }

        async function getData() {
            state.loading = true;

            try {
                if (!state.mpa.id) {
                    return;
                }

                // This endpoint will return a timeseries and climatology that can be used in multiple charts
                const tsUrl = new URL(state.urls.timeseriesUrl, window.location.origin);
                tsUrl.searchParams.set('mpa', state.mpa.id);
                tsUrl.searchParams.set('start_date', state.dates.start_date);
                tsUrl.searchParams.set('end_date', state.dates.end_date);

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
mapApp.component('quantile-chart', QuantileChart);
mapApp.component('species-chart-container', SpeciesChartContainer);
mapApp.component('mpa-info', MPAInfo);
mapApp.component('mpa-controls', MPAControls);
mapApp.component('network-indicators', NetworkIndicators);
mapApp.component('network-indicator', NetworkIndicator);

window.mapApp = mapApp;