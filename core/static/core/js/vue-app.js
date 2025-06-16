import {StandardAnomalyChart} from "./vue-chart-standard-anomaly.js";
import {QuantileChart} from "./vue-chart-quantile.js";
import {SpeciesChart} from "./vue-components-chart-species.js";
import {MPAInfo} from "./vue-components-mpa-info.js";
import {MPAControls} from "./vue-components-mpa-controls.js";
import {NetworkIndicators} from "./vue-chart-network-data.js";

const {createApp, ref, reactive, watch, computed, onMounted} = Vue;

const mapApp = createApp({
    delimiters: ['${', '}'],
    setup() {
        // State
        const state = reactive({
            mapLoading: false,
            selectedPolygon: null,
            mpa: {
                id: 0,
                name: '',
                url: '',
                class: '',
                km2: 0
            },
            dates: {
                selected: null,
                startDate: '',
                endDate: ''
            },
            depth: '',
            loading: false,
            activeTab: 'standard_anomaly_data',
            urls: {
                mpasWithTimeseriesList: '', // Will be populated from template
                timeseriesUrl: '',
                legendUrl: '',
                speciesUrl: '',
            },
            charts: {
                standardAnomalies: null,
                timeseries: null,
            },
            timeseriesData: null,
            selectedPolygons: [],
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
            }
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
                );
            }

            initCtrlKeyTracking();
        });

        function initialize(mpasUrl, timeseriesUrl, legendUrl, speciesUrl) {
            state.urls.mpasWithTimeseriesList = mpasUrl;
            state.urls.timeseriesUrl = timeseriesUrl;
            state.urls.legendUrl = legendUrl;
            state.urls.speciesUrl = speciesUrl;

            loadMPAPolygons();
            loadSpecies();
        }

        // Populate the tabs data structure
        const tabs = reactive({
            standard_anomaly_data: {title: 'Standard Anomalies'},
            timeseries_data: {title: 'Timeseries'},
            species_data: {title: 'Species Data'},
            network_data: {title: 'Network Data'},
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

        async function loadMPAPolygons() {
            if (!state.map || !state.urls.mpasWithTimeseriesList) return;

            state.mapLoading = true;
            try {
                // First fetch to get metadata and process first page
                const initialResponse = await fetch(state.urls.mpasWithTimeseriesList);
                const initialData = await initialResponse.json();

                if (!initialData.results || !Array.isArray(initialData.results)) {
                    console.error("Unexpected data format:", initialData);
                    return;
                }

                // Process first page results
                processMPAData(initialData.results);

                // Check if there are more pages to load
                if (!initialData.count || initialData.count <= initialData.results.length) {
                    return;
                }

                // Calculate total pages based on count and results per page
                const pageSize = initialData.results.length;
                const totalPages = Math.ceil(initialData.count / pageSize);

                // Create URLs for all pages (starting from page 2)
                const baseUrl = new URL(state.urls.mpasWithTimeseriesList, window.location.origin);
                const pagePromises = [];

                for (let page = 2; page <= totalPages; page++) {
                    const pageUrl = new URL(baseUrl);
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

        // Helper function to process MPA data and add to map

        function processMPAData(mpas) {
            mpas.forEach(mpa => {
                if (mpa.geometry) {
                    L.geoJSON(mpa.geometry, {
                        style: mpa.style,
                        onEachFeature: (feature, layer) => {
                            layer.bindPopup(mpa.properties.name || "Unnamed MPA");
                            layer.on('click', () => {
                                handlePolygonSelection(layer, mpa);
                            });
                        }
                    }).addTo(state.map);
                }
            });
        }

        function handlePolygonSelection(layer, mpa) {

            // Always update the MPA info panel with the most recently selected polygon
            state.selectedPolygon = {layer, mpa}
            if(state.isCtrlPressed) {
                state.selectedPolygon.layer.setStyle(mpa.style);
            }
            setMPA({
                id: mpa.properties.id,
                name: mpa.properties.name || 'Unknown MPA',
                url: mpa.properties.url || '',
                class: mpa.properties.class || '',
                km2: mpa.properties.area_km2 || ''
            });
        }

        function setMPA(mpa) {
            state.mpa.id = mpa.id
            state.mpa.name = mpa.name;
            state.mpa.url = mpa.url;
            state.mpa.class = mpa.class;
            state.mpa.km2 = mpa.km2;

            // When the new mpa is set, the vue-component-mpa-control.js module will update
            // its MPA and set new depths for the selected MPA, then it'll emit a depth-changed
            // signal which will call vue-app's setSelectedDepth function and update the data
            //getData();
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
                div.innerHTML += '<h4>MPA Classifications</h4><div id="legend-content">Loading...</div>';
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

        function setSelectedDateRange(dateRange) {
            if (typeof dateRange === 'object' && dateRange !== null) {
                // Handle dateRange object from MPAControls
                state.dates.startDate = dateRange.min;
                state.dates.endDate = dateRange.max;
            } else {
                // Handle direct min/max arguments
                state.dates.startDate = arguments[0] || state.dates.startDate;
                state.dates.endDate = arguments[1] || state.dates.endDate;
            }

            // Check canvas exists before attempting to draw
            const canvas = document.getElementById('chart-canvas');
            if (!canvas) {
                console.warn("Canvas element not found, delaying chart update");
                setTimeout(getData, 200);
                return;
            }

            getData();
        }

        function setSelectedDate(date) {
            state.dates.selected = date
        }

        function setSelectedDepth(depth) {
            state.depth = depth;
            getData();
        }

        async function getData() {
            state.loading = true;

            try {
                if (!state.mpa.id) {
                    console.warn("No MPA selected");
                    return;
                }

                // This endpoint will return a timeseries and climatology that can be used in multiple charts
                const tsUrl = new URL(state.urls.timeseriesUrl, window.location.origin);
                tsUrl.searchParams.set('mpa', state.mpa.id);
                tsUrl.searchParams.set('start_date', state.dates.startDate);
                tsUrl.searchParams.set('end_date', state.dates.endDate);

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

        return {
            state,
            tabs,
            initialize,
            setMPA,
            setSelectedDateRange,
            setSelectedDate,
            setSelectedDepth,
            getData,
            updateSelectedPolygons,
        };
    },
});

mapApp.component('standard-anomaly-chart', StandardAnomalyChart);
mapApp.component('quantile-chart', QuantileChart);
mapApp.component('species-chart', SpeciesChart);
mapApp.component('mpa-info', MPAInfo);
mapApp.component('mpa-controls', MPAControls);
mapApp.component('network-indicators', NetworkIndicators);

window.mapApp = mapApp;