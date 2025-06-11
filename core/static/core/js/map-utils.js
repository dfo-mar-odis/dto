// core/static/core/js/map-utils.js
const MapApp = {
    // Extended state management
    state: {
        map: null,
        selectedLayer: null,
        previousLayers: [],
        mpaId: null,
        polygonLayers: {} // Store references to all polygon layers by ID
    },

    // AJAX utility to reduce repetition
    ajax: function(url, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: url,
                method: method,
                data: data,
                success: resolve,
                error: (error) => {
                    console.error("AJAX Error:", error);
                    reject(error);
                }
            });
        });
    },

    // Initialize the standard anomaly chart
    initStandardAnomalyChart: function(chart) {
        // Create chart if it doesn't exist in global scope
        window.standard_anomalies_chart = chart;

        // Store reference in state for consistency
        this.state.standardAnomalyChart = window.standard_anomalies_chart;

        // Add date change listener
        date_update_listeners.push((date) => {
            if (this.state.standardAnomalyChart && date) {
                this.state.standardAnomalyChart.setSelectedDate(date);
            }
        });
    },

    // Improved updateStdAnomalies method with better error handling
    updateStdAnomalies: function(data) {
        if (!data || !data.dates || !data.values) {
            console.warn("Invalid anomaly data received");
            return;
        }

        if (this.state.standardAnomalyChart) {
            this.state.standardAnomalyChart.updateData(data.dates, data.values);
        } else if (window.standard_anomalies_chart) {
            window.standard_anomalies_chart.updateData(data.dates, data.values);
        } else {
            console.warn("Standard anomaly chart not initialized");
        }
    },

    // Initialize the map and load MPAs
    initMap: function(mapElementId, mpaUrl, options = {}) {
        const mapOptions = {
            center: options.center || [44.666830, -61.531500],
            zoom: options.zoom || 5,
        };

        this.state.map = L.map(mapElementId, mapOptions).setView(mapOptions.center, mapOptions.zoom);

        L.tileLayer(
            "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                "attribution": "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors",
                "maxZoom": 19,
                "minZoom": 0,
                "opacity": 1,
                "subdomains": "abc"
            }
        ).addTo(this.state.map);

        this.loadPolygons(mpaUrl);
    },


    // Load polygons with pagination handling
    loadPolygons: function(baseUrl) {
        $("#map").hide();
        $("#map_loading").addClass("loader-lg");

        const fetchAllPages = (url) => {
            $.ajax({
                method: "GET",
                url: url,
                success: (data) => {
                    try {
                        // Process this page of results
                        if (data.results && Array.isArray(data.results)) {
                            data.results.forEach(mpa => this.parsePolygonData(this.state.map, mpa));
                        } else {
                            console.warn("Unexpected data format:", data);
                        }

                        // If there's a next page, fetch it
                        if (data.next) {
                            fetchAllPages(data.next);
                        } else {
                            // All pages loaded, complete the operation
                            $("#map_loading").removeClass("loader-lg");
                            $("#map").show();
                        }
                    } catch (err) {
                        console.error("Error processing polygon data:", err);
                        $("#map_loading").removeClass("loader-lg");
                        $("#map").show();
                    }
                },
                error: (error_data) => {
                    console.error("Failed to load map data:", error_data);
                    $("#map_loading").removeClass("loader-lg");
                    $("#map").show();
                    alert("Failed to load map data. Please try refreshing the page.");
                }
            });
        };

        // Start fetching pages
        fetchAllPages(baseUrl);
    },

    parsePolygonData: function(map, mpa) {
        try {
            let geo = L.geoJson(mpa, {
                style: function(feature) {
                    return {
                        color: "#000",
                        weight: 1,
                        fillColor: feature.style?.color || "#3388ff",
                        fillOpacity: 0.8,
                    };
                }
            });

            // Store reference to the layer
            if (mpa.id) {
                this.state.polygonLayers[mpa.id] = geo;
            }

            // Create tooltip content
            const titleHtml = `<div class="row"><div class="col"><b>${mpa.properties.name_e || mpa.name_e}</b></div></div>`;
            geo.bindTooltip(titleHtml);

            // Add popup with more details
            const popupContent = `
                <div>
                    <h5>${mpa.properties.name_e || mpa.name_e}</h5>
                    <p>Area: ${(mpa.properties.km2 ? parseFloat(mpa.properties.km2).toFixed(2) : "N/A")} km²</p>
                    ${mpa.properties.url_e || mpa.url_e ?
                      `<a href="${mpa.properties.url_e || mpa.url_e}" target="_blank">More information</a>` : ''}
                </div>
            `;
            geo.bindPopup(popupContent);

            // Add click event handler
            geo.on('click', (e) => {
                this.handlePolygonClick(e, mpa);
            });

            // Add hover events
            geo.on('mouseover', (e) => {
                e.target.setStyle({
                    weight: 3,
                    opacity: 1
                });
            });

            geo.on('mouseout', (e) => {
                e.target.setStyle({
                    weight: 1,
                    opacity: 0.8
                });

                // Reset style if this isn't the selected layer
                if (this.state.selectedLayer !== e.target) {
                    geo.setStyle({
                        fillColor: mpa.style?.color || "#3388ff",
                    });
                }
            });

            geo.addTo(map);
        } catch (err) {
            console.error("Error creating polygon:", err, mpa);
        }
    },

    // Method to update charts with timeseries data
    updateCharts: function(data) {
        // Check if charts exist in the global scope
        if (window.charts && window.charts['mpa_ts_quantile_chart']) {
            const chart = window.charts['mpa_ts_quantile_chart'];
            const qsData = data.data;
            const dateLabels = qsData.map(value => Date.parse(value.date));
            const tsData = qsData.map(value => value.ts_data);
            const climData = qsData.map(value => value.clim);

            chart.mpaId = this.state.mpaId;
            chart.dialMax = data.max_delta;
            chart.dialMin = data.min_delta;

            // Update chart data
            chart.updateData(dateLabels, tsData, climData);

            // Set selected date if one is available
            const selectedDate = this.getSelectedDate();
            if (selectedDate) {
                chart.setSelectedDate(selectedDate);
            }
        }
    },

    // Add getData method to fetch timeseries data
    getData: function() {
        if (!this.state.mpaId) return;

        const minDate = $("#zoom_min").val();
        const maxDate = $("#zoom_max").val();
        const btmDepth = $("#btm_depth").val();

        const timeseriesUrl = `${this.timeseriesUrl}?mpa=${this.state.mpaId}&depth=${btmDepth}&start_date=${minDate}&end_date=${maxDate}`;

        // Show loading indicator
        $("#div_id_quantile_card").addClass("loader");
        $("#div_id_stda_card").addClass("loader");

        $.ajax({
            method: "GET",
            url: timeseriesUrl,
            success: (data) => {
                if (data && data.data) {
                    // Process timeseries data
                    this.updateCharts(data);
                } else {
                    console.warn("No data returned from timeseries query");
                }
            },
            error: (error) => {
                console.error("Error fetching timeseries data:", error);
            },
            complete: () => {
                // Hide loading indicators
                $("#div_id_quantile_card").removeClass("loader");
                $("#div_id_stda_card").removeClass("loader");
            }
        });

        // Also get standard anomaly data
        const anomalyUrl = `${this.anomalyUrl}?mpa=${this.state.mpaId}&depth=${btmDepth}`;

        $.ajax({
            method: "GET",
            url: anomalyUrl,
            success: (data) => {
                if (data) {
                    this.updateStdAnomalies(data);
                }
            },
            error: (error) => {
                console.error("Error fetching anomaly data:", error);
            }
        });
    },

    // Method to update standard anomalies chart
    updateStdAnomalies: function(data) {
        if (window.standard_anomalies_chart) {
            window.standard_anomalies_chart.updateData(data.dates, data.values);
        }
    },

    // Add utility method for date handling
    getSelectedDate: function() {
        const selectedDateStr = $('#selected_date').val();
        return selectedDateStr ? new Date(selectedDateStr) : null;
    },

    getSelectedDateString: function(date) {
        if (!date) return null;

        const day = ("0" + date.getDate()).slice(-2);
        const month = ("0" + (date.getMonth() + 1)).slice(-2);
        return `${date.getFullYear()}-${month}-${day}`;
    },

    // Setup event handlers for UI elements
    setupEventHandlers: function() {
        $("#btm_depth").on('change', () => {
            if (this.state.mpaId) {
                this.getData();
            }
        });

        $("#zoom_min, #zoom_max").on('change', () => {
            if (this.state.mpaId) {
                this.getData();
            }
        });

        $("#selected_date").on('change', () => {
            const date = this.getSelectedDate();
            if (date) {
                const dateStr = this.getSelectedDateString(date);
                if (window.charts && window.charts['mpa_ts_quantile_chart']) {
                    window.charts['mpa_ts_quantile_chart'].setSelectedDate(date);
                }

                if (this.state.mpaId) {
                    this.addNetworkIndicators(dateStr);
                }
            }
        });
    },

    // Add network indicators
    addNetworkIndicators: function(date) {
        if (!this.state.mpaId || !date) return;

        const url = `network-indicators/?mpa=${this.state.mpaId}&date=${date}`;
        $("#div_id_network_card").addClass("loader");

        $.ajax({
            method: "GET",
            url: url,
            success: (data) => {
                $("#div_id_network_card").html(data);
            },
            error: (error) => {
                console.error("Error loading network indicators:", error);
            },
            complete: () => {
                $("#div_id_network_card").removeClass("loader");
            }
        });
    },

    // Handle polygon click events
    handlePolygonClick: function(e, map) {
        const resetColor = e.layer.feature.style.color;

        if (e.originalEvent.ctrlKey) {
            // Handle ctrl+click for multi-selection
            if (!this.state.previousLayers.includes(e.layer)) {
                this.state.previousLayers.push(e.layer);
            } else {
                this.state.previousLayers = this.state.previousLayers.filter(layer => layer !== e.layer);
                e.layer.setStyle({fillColor: resetColor});
            }
        } else {
            // Regular click - clear previous selections
            this.state.previousLayers.forEach(layer => {
                layer.setStyle({fillColor: resetColor});
            });
            this.state.previousLayers = [e.layer];
        }

        // Update selected layer
        if (this.state.selectedLayer) {
            this.state.selectedLayer.setStyle({fillColor: resetColor});
        }

        this.state.previousLayers.forEach(layer => {
            layer.setStyle({fillColor: "#00ffff"});
        });

        this.state.selectedLayer = e.layer;
        this.state.selectedLayer.setStyle({fillColor: "#ffff00"});

        // Update MPA ID
        const feature = this.state.selectedLayer.feature;
        this.state.mpaId = feature.properties.id;

        // Update UI with MPA info
        this.updateMpaInfo(feature);

        this.getData();
    },

    // Update MPA information in the UI
    updateMpaInfo: function(feature) {
        // Update UI elements with MPA info
        const $btnPdf = $("#btn_id_pdf");
        $btnPdf.attr("href", this.getLink("pdf_url"));
        $btnPdf.show();

        $("#mpa_name").text(feature.properties.name_e);

        const $mpaUrl = $("#mpa_url a");
        $mpaUrl.attr("href", feature.properties.url_e);
        $mpaUrl.text(feature.properties.url_e);

        $("#mpa_km2").text(feature.properties.km2 ? parseFloat(feature.properties.km2).toFixed(2) : "N/A");

        // Load depths for this MPA
        this.getDepths();
    },

    // Get link with proper parameters
    getLink: function(baseUrl) {
        if (!this.state.mpaId) return "#";

        const minDate = $("#zoom_min").val();
        const maxDate = $("#zoom_max").val();
        const btmDepth = $("#btm_depth").val();

        let url = baseUrl + "?mpa=" + this.state.mpaId;
        url = url + "&depth=" + btmDepth;
        url = url + "&start_date=" + minDate;
        url = url + "&end_date=" + maxDate;

        return url;
    },

    // Get depths for the selected MPA
    getDepths: function() {
        if (!this.state.mpaId) return;

        const url = `${this.depthsUrl}?mpa=${this.state.mpaId}`;

        $.ajax({
            method: "GET",
            url: url,
            success: (data) => {
                const $depthSelect = $("#btm_depth");
                $depthSelect.empty();

                data.depths.forEach(depth => {
                    $depthSelect.append(new Option(depth[0], depth[0]));
                });

                if (data.depths.length > 0) {
                    $depthSelect.val(data.depths[0][0]);
                    // Load data for the selected MPA and depth
                    this.getData();
                }
            },
            error: (error) => {
                console.error("Error loading depths:", error);
            }
        });
    },

    // Pan the time frame by the specified number of years
    panFrame: function(years) {
        const minDate = new Date($("#zoom_min").val());
        const maxDate = new Date($("#zoom_max").val());

        minDate.setFullYear(minDate.getFullYear() + years);
        maxDate.setFullYear(maxDate.getFullYear() + years);

        $("#zoom_min").val(minDate.toISOString().split('T')[0]);
        $("#zoom_max").val(maxDate.toISOString().split('T')[0]);

        if (this.state.mpaId) {
            this.getData();
        }
    },

    // Trigger actions when an MPA is selected
    triggerMpaSelection: function(mpa) {
        // To be implemented: update UI, load data, etc.
        console.log("MPA selected:", mpa);
        // This is a placeholder for future functionality
    },

     // Update init to setup event handlers
    init: function(mpaUrl, timeseriesUrl, anomalyChart, anomalyUrl, depthsUrl) {
        // Store URLs for later use
        this.timeseriesUrl = timeseriesUrl;
        this.anomalyUrl = anomalyUrl;
        this.depthsUrl = depthsUrl;

        // Initialize map
        this.initMap('map', mpaUrl);

        // Initialize standard anomaly chart
        this.initStandardAnomalyChart(anomalyChart);

        // Setup event handlers
        this.setupEventHandlers();

        // Make the panFrame function globally accessible
        window.pan_frame = (years) => {
            this.panFrame(years);
        };
    }
};