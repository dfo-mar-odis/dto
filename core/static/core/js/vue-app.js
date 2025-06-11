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
                zoomMin: '2019-01-01',
                zoomMax: '2024-01-01'
            },
            depth: '',
            loading: false,
            activeTab: 'standard_anomaly_data',
            urls: {
                mpasWithTimeseriesList: '', // Will be populated from template
                timeseriesUrl: '',
                anomalyUrl: '',
                depthsUrl: '',
                stdaChartUrl: ''
            },
            charts: {
                standardAnomalies: null
            }
        });

        // Populate the tabs data structure
        const tabs = reactive({
            standard_anomaly_data: {title: 'Standard Anomalies'},
            ocean_data: {title: 'Ocean Data'},
            species_data: {title: 'Species Data'},
            network_data: {title: 'Network Data'},
            indicator_data: {title: 'Indicators'}
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

            loadMPAPolygons();

            // Initialize charts
            if (window.ChartComponents && window.ChartComponents.StandardAnomaliesChart) {
                state.charts.standardAnomalies = new ChartComponents.StandardAnomaliesChart(
                    'mpa_ts_stda_chart',
                    state.urls.anomalyUrl
                );
            }

            // Initialize map
            if (typeof MapApp !== 'undefined') {
                MapApp.init(
                    state.urls.mpasWithTimeseriesList,
                    state.urls.timeseriesUrl,
                    state.urls.anomalyUrl,
                    state.urls.depthsUrl
                );
            }
        });

        // Methods
        function setMapView(lat, lng, zoom) {
            if (state.map) {
                state.map.setView([lat, lng], zoom);
            }
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
                8

                state.mapLoading = false;
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
                                    state.selectedPolygon.setStyle({
                                        color: '#E06377',
                                        weight: 2,
                                        opacity: 0.7,
                                        fillColor: '#FF7F50',
                                        fillOpacity: 0.4
                                    });
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

        function setZoom(min, max) {
            state.dates.zoomMin = min || state.dates.zoomMin;
            state.dates.zoomMax = max || state.dates.zoomMax;
            getData();
        }

        function panFrame(years) {
            const minDate = new Date(state.dates.zoomMin);
            const maxDate = new Date(state.dates.zoomMax);

            minDate.setFullYear(minDate.getFullYear() + years);
            maxDate.setFullYear(maxDate.getFullYear() + years);

            state.dates.zoomMin = minDate.toISOString().split('T')[0];
            state.dates.zoomMax = maxDate.toISOString().split('T')[0];

            getData();
        }

        async function getData() {
            state.loading = true;

            try {
                if (!state.mpa.id) {
                    console.warn("No MPA selected");
                    return;
                }

                // Set the standard anomalies tab as active when an MPA is selected
                state.activeTab = 'standard_anomaly_data';

                // Check if we have a valid chart object
                if (state.charts.standardAnomalies) {
                    // Construct URL with MPA parameters
                    const chartUrl = new URL(state.urls.anomalyUrl, window.location.origin);
                    chartUrl.searchParams.set('mpa', state.mpa.id);
                    chartUrl.searchParams.set('start_date', state.dates.zoomMin);
                    chartUrl.searchParams.set('end_date', state.dates.zoomMax);

                    if (state.depth) {
                        chartUrl.searchParams.set('depth', state.depth);
                    }

                    // Update the chart with new data
                    await state.charts.standardAnomalies.updateData(chartUrl.toString());

                    // Update any UI elements with MPA info
                    document.getElementById('selected-mpa-name').textContent = state.mpa.name;
                    document.getElementById('selected-mpa-area').textContent = `${state.mpa.km2} km²`;
                }
            } catch (error) {
                console.error("Error fetching chart data:", error);
            } finally {
                state.loading = false;
            }
        }

        function initializeUrls(mpasUrl, timeseriesUrl, anomalyUrl, depthsUrl, stdaChartUrl) {
            console.log("Initializing URLs:", {anomalyUrl});
            state.urls.mpasWithTimeseriesList = mpasUrl;
            state.urls.timeseriesUrl = timeseriesUrl;
            state.urls.anomalyUrl = anomalyUrl;
            state.urls.depthsUrl = depthsUrl;
            state.urls.stdaChartUrl = stdaChartUrl;
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