import {StandardAnomalyChart} from "./vue-chart-standard-anomaly.js";
import {TimeseriesChart} from "./vue-chart-timeseries.js";
import {MPAInfo} from "./vue-components-mpa-info.js";
import {MPAControls} from "./vue-components-mpa-controls.js";

const {createApp, ref, reactive, watch, computed, onMounted, nextTick} = Vue;

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
                depthsUrl: '',
                legendUrl: '',
            },
            charts: {
                standardAnomalies: null,
                timeseries: null,
            },
            timeseriesData: null
        });

        let chart = null;

        function initChart() {
            const canvas = document.getElementById('chart-canvas');
            if (!canvas) {
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.warn("Failed to get canvas context, retrying...");
                setTimeout(initChart, 200);
                return;
            }

            // Create chart only when canvas is ready
            try {
                chart = new Chart(ctx, {
                    // Your chart configuration
                });
            } catch (err) {
                console.error("Chart initialization error:", err);
            }
        }

        function setZoom(dateRange) {
            state.dates.startDate = dateRange.min;
            state.dates.endDate = dateRange.max;

            // Only update chart if it exists
            if (chart) {
                getData();
            } else {
                initChart();
            }
        }

        // Populate the tabs data structure
        const tabs = reactive({
            standard_anomaly_data: {title: 'Standard Anomalies'},
            ocean_data: {title: 'Timeseries'},
            species_data: {title: 'Species Data'},
            network_data: {title: 'Network Data'},
            indicator_data: {title: 'Indicators'}
        });

        // Initialize everything
        onMounted(() => {
            setTimeout(() => {
                initChart();
            }, 300);

            nextTick(() => {
                initChart();
            })

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

            loadMPAPolygons();

            // Initialize Anomaly chart with a check that the element exists
            setTimeout(() => {
                const anomalyChartElement = document.getElementById('mpa_ts_stda_chart');
                if (anomalyChartElement) {
                    state.charts.standardAnomalies = new StandardAnomalyChart(
                        'mpa_ts_stda_chart',
                        state.urls.anomalyUrl
                    );
                }
            }, 100);

            // Initialize map
            if (typeof MapApp !== 'undefined') {
                MapApp.init(
                    state.urls.mpasWithTimeseriesList,
                    state.urls.timeseriesUrl,
                    state.urls.depthsUrl,
                    state.urls.legendUrl
                );
            }
        });

        // Methods
        function setMapView(lat, lng, zoom) {
            if (state.map) {
                state.map.setView([lat, lng], zoom);
            }
        }

        function handleSetZoom(dateRange) {
            state.dates.startDate = dateRange.min;
            state.dates.endDate = dateRange.max;

            // Check if chart exists before updating
            if (chart && document.getElementById('chart-canvas')) {
                getData();
            } else {
                console.warn("Chart not ready, delaying update");
                setTimeout(getData, 100);
            }
        }

        function setZoom(dateRange) {
            if (typeof dateRange === 'object' && dateRange !== null) {
                // Handle dateRange object from MPAControls
                state.dates.startDate = dateRange.min;
                state.dates.endDate = dateRange.max;
            } else {
                // Handle direct min/max arguments
                state.dates.startDate = arguments[0] || state.dates.startDate;
                state.dates.endDate = arguments[1] || state.dates.endDate;
            }
            getData();
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

        // Helper function to process MPA data and add to map
        function processMPAData(mpas) {
            mpas.forEach(mpa => {
                if (mpa.geometry) {
                    L.geoJSON(mpa.geometry, {
                        style: mpa.style,
                        onEachFeature: (feature, layer) => {
                            layer.bindPopup(mpa.properties.name_e || "Unnamed MPA");
                            layer.on('click', () => {
                                // Reset previously selected polygon if exists
                                if (state.selectedPolygon) {
                                    state.selectedPolygon.setStyle(state.selectedPolygon.mpa.style);
                                }

                                // Highlight the selected polygon
                                layer.setStyle({
                                    color: '#B8860B',      // Dark green border
                                    weight: 3,
                                    opacity: 0.9,
                                    fillColor: '#FFD700',  // Lime green fill
                                    fillOpacity: 0.6
                                });

                                // Store reference to this polygon
                                state.selectedPolygon = layer;
                                state.selectedPolygon.mpa = mpa;

                                setMPA({
                                    id: mpa.properties.id,
                                    name: mpa.properties.name_e || 'Unknown MPA',
                                    url: mpa.properties.url_e || '',
                                    class: mpa.properties.class || '',
                                    km2: mpa.properties.area_km2 || ''
                                });
                            });
                        }
                    }).addTo(state.map);
                }
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

        function setMPA(mpa) {
            state.mpa.id = mpa.id
            state.mpa.name = mpa.name;
            state.mpa.url = mpa.url;
            state.mpa.class = mpa.class;
            state.mpa.km2 = mpa.km2;
            getData();
        }

        function setSelectedDate(date) {
            state.dates.selected = date;
            // You can still call your existing functions if needed during transition
            // window.set_selected_date();
        }

        function panFrame(years) {
            const minDate = new Date(state.dates.startDate);
            const maxDate = new Date(state.dates.endDate);

            minDate.setFullYear(minDate.getFullYear() + years);
            maxDate.setFullYear(maxDate.getFullYear() + years);

            state.dates.startDate = minDate.toISOString().split('T')[0];
            state.dates.endDate = maxDate.toISOString().split('T')[0];

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

                if (state.depth) {
                    tsUrl.searchParams.set('depth', state.depth);
                }

                const response = await fetch(tsUrl.toString());
                state.timeseriesData = await response.json();

            } catch (error) {
                console.error("Error fetching chart data:", error);
            } finally {
                state.loading = false;
            }
        }

        function initializeUrls(mpasUrl, timeseriesUrl, depthsUrl, legendUrl) {
            state.urls.mpasWithTimeseriesList = mpasUrl;
            state.urls.timeseriesUrl = timeseriesUrl;
            state.urls.depthsUrl = depthsUrl;
            state.urls.legendUrl = legendUrl;
        }

        return {
            state,
            tabs,
            initializeUrls,
            loadMPAPolygons,
            setMPA,
            setSelectedDate,
            setZoom,
            panFrame,
            getData,
        };
    },
});

mapApp.component('standard-anomaly-chart', StandardAnomalyChart);
mapApp.component('timeseries-chart', TimeseriesChart);
mapApp.component('mpa-info', MPAInfo);
mapApp.component('mpa-controls', MPAControls);

window.mapApp = mapApp;