import {NetworkIndicator} from './vue-components-network-indicator.js';

export const NetworkIndicators = {
    components: {
        NetworkIndicator
    },

    props: {
        timeseries_type: 1,
        selectedPolygon: {
            type: Object,
            default: null
        },
        selectedDate: {
            type: String,
            default: ''
        },
        dataUrl: {
            type: String,
            required: true
        },
        isCtrlPressed: false,
    },
    computed: {
        t() {
            return window.translations || {};
        },
    },
    data() {
        return {
            polygonsList: [],  // Our internal list of selected polygons
            isLoading: false,
            error: null,
            chart: null,
            polygonsData: {},   // Will store data for each polygon when fetched
            requestQueue: [], //queue for pending polygon requests
            catagories: {
                heatwave: ['rgb(220, 53, 69)', 'rgb(176, 42, 55)', (window.translations?.heat_wave || "Heat Wave")],
                abovenormal: ['rgba(220, 53, 69, 0.25)', 'rgba(176, 42, 55, 0.25)', (window.translations?.above_normal || "Above Normal")],
                belownormal: ['rgba(13, 110, 253, 0.25)', 'rgba(10, 88, 202, 0.25)', (window.translations?.below_normal || "Below Normal")],
                coldwave: ['rgb(13, 110, 253)', 'rgb(10, 88, 202)', (window.translations?.cold_wave || "Cold Wave")],
                unknown: ['rgb(25, 135, 84)', 'rgb(20, 108, 67)', "Error"]
            }
        }
    },

    watch: {
        selectedDate: {
            async handler(newDate) {
                // Don't process unless we have a complete valid date
                if (!newDate || !newDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    return;
                }

                // Clear any existing debounce timer
                if (this.dateUpdateTimer) {
                    clearTimeout(this.dateUpdateTimer);
                }

                // Set a new debounce timer
                this.dateUpdateTimer = setTimeout(async () => {

                    if (this.polygonsList.length > 0) {
                        this.polygonsList.forEach(poly => {
                            this.requestQueue.push(poly);
                        });
                        this.polygonsList = [];
                        if (!this.isLoading) {
                            await this.processRequestQueue();
                        }
                    }
                }, 1000);
            }
        },
        selectedPolygon: {
            handler(newPolygon) {
                if (newPolygon) {
                    this.togglePolygon(newPolygon);

                }
            },
            immediate: true
        },
    },

    methods: {
        async togglePolygon(polygon) {
            if (!polygon) return;

            if (!this.isCtrlPressed) {
                this.polygonsList = [];
                this.requestQueue = [];
            }

            const polygonId = polygon.mpa.properties?.id || polygon.mpa.id;

            // Check if polygon is already in our list
            const existingIndex = this.polygonsList.findIndex(p =>
                p.mpa.properties?.id === polygonId
            );

            if (existingIndex >= 0) {
                // Remove if already selected (toggle off)
                this.polygonsList.splice(existingIndex, 1);
                this.renderChart();
                return;
            }

            // or if it's already in the fetch queue remove it from the fetch queue
            const fetchQueueIndex = this.requestQueue.findIndex(p =>
                p.mpa.properties?.id === polygonId
            );

            if (fetchQueueIndex >= 0) {
                this.requestQueue.splice(fetchQueueIndex, 1);
            } else {
                // Add if not already selected (toggle on)
                // await this.fetchPolygonData(polygon)
                this.requestQueue.push(polygon);
                if(!this.isLoading) {
                    this.processRequestQueue();
                }
            }

        },
        async processRequestQueue() {
            if (this.requestQueue.length === 0) return;

            this.isLoading = true;
            // copy all the requested polygons to the processing queue then clear the request queue
            const polygonsToFetch = [...this.requestQueue];
            this.requestQueue = [] ;

            try {
                const url = new URL(this.dataUrl, window.location.origin);
                polygonsToFetch.forEach(polygon => {
                    url.searchParams.append('mpa_id', polygon.mpa.properties.id);
                });
                url.searchParams.set("date", this.selectedDate)
                url.searchParams.set("type", this.timeseries_type)

                const response = await fetch(url.toString());
                const data = await response.json();

                // Update polygons with fetched data
                polygonsToFetch.forEach(polygon => {
                    const id = polygon.mpa.properties.id;
                    if (data[id]) {
                        const climate_data = data[id];
                        this.setPolygonData(polygon, climate_data);
                        this.polygonsList.push(polygon);
                    }
                });

                this.isLoading = false;

                if (this.requestQueue.length > 0) {
                    await this.processRequestQueue();
                } else {
                    // Emit updated list to parent component
                    this.$emit('polygon-list-updated', this.polygonsList);

                    await this.$nextTick();
                    this.renderChart();
                }
            } catch (error) {
                this.error = "Failed to load data: " + error;
                this.isLoading = false;
            }
        },
        computeAnomaly(data) {
            if (data && data.ts_data !== undefined && data.climatology !== undefined) {
                return (Number(data.ts_data) - Number(data.climatology)) / Number(data.std_dev);
            }
        },
        setPolygonData(polygon, climate_data) {
            polygon.data = climate_data.data;
            polygon.quantile = climate_data.quantile;
            polygon.min_delta = climate_data.min_delta;
            polygon.max_delta = climate_data.max_delta;
            polygon.anomaly = this.computeAnomaly(polygon.data)
        },
        getPolygonName(polygon) {
            return polygon.mpa.properties.name;
        },
        getStatusClass(polygon) {
            if (!polygon.quantile) return '';

            const value = parseFloat(polygon.data.ts_data);
            const clim = parseFloat(polygon.data.climatology)
            const upperQ = parseFloat(polygon.quantile.upperq);
            const lowerQ = parseFloat(polygon.quantile.lowerq);

            if (value > upperQ) return this.catagories.heatwave;  // Heat wave (bg-danger)
            else if (value > clim) return this.catagories.abovenormal;  // bg-danger-subtle
            else if (value < lowerQ) return this.catagories.coldwave;  // Cold wave (bg-primary)
            else if (value < clim) return this.catagories.belownormal;  // bg-primary-subtle
            return this.catagories.unknown;  // Normal range (bg-success)
        },
        renderChart() {
            const ctx = this.$refs.chartCanvas.getContext('2d');

            if (this.chart) {
                this.chart.destroy();
            }

            // Format data for Chart.js
            const formattedData = {
                labels: [], // X-axis labels
                datasets: [{
                    data: [], // Y-axis values
                    backgroundColor: [],
                    borderColor: [],
                    borderWidth: 1
                }]
            };

            this.polygonsList.sort((a, b) => {
                return a.anomaly - b.anomaly;
            });
            this.polygonsList.forEach(poly => {
                let dataset = formattedData.datasets[0];
                let colour = this.getStatusClass(poly);

                formattedData.labels.push(this.getPolygonName(poly))
                dataset.data.push(poly.anomaly);
                dataset.backgroundColor.push(colour[0]);
                dataset.borderColor.push(colour[1]);
            });
            this.chart = new Chart(ctx, {
                type: 'bar',
                data: formattedData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: {
                        title: {
                            display: true,
                            text: (this.t.hot_cold_comparison || 'Hot/Cold wave comparison')
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: false,
                                generateLabels: () => [
                                    {
                                        text: this.catagories.coldwave[2] +' ( < 10% )',
                                        fillStyle: this.catagories.coldwave[0],
                                        strokeStyle: this.catagories.coldwave[1],
                                        lineWidth: 1,
                                        hidden: false
                                    },
                                    {
                                        text: this.catagories.belownormal[2] +' ( < 0 )',
                                        fillStyle: this.catagories.belownormal[0],
                                        strokeStyle: this.catagories.belownormal[1],
                                        lineWidth: 1,
                                        hidden: false
                                    },
                                    {
                                        text: this.catagories.abovenormal[2] +' ( > 0 )',
                                        fillStyle: this.catagories.abovenormal[0],
                                        strokeStyle: this.catagories.abovenormal[1],
                                        lineWidth: 1,
                                        hidden: false
                                    },
                                    {
                                        text: this.catagories.heatwave[2] +' ( > 90% )',
                                        fillStyle: this.catagories.heatwave[0],
                                        strokeStyle: this.catagories.heatwave[1],
                                        lineWidth: 1,
                                        hidden: false
                                    },

                                ]
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: (this.t?.standard_anomaly || 'Standardized Anomaly')
                            },
                        }
                    }
                }
            });
        }
    },

    template: `
        <div class="network-indicators">
            <h3 class="mb-3">{{ t.heat_cold_indicator || 'Marine Heat/Cold Wave Indicators' }}</h3>
            <div v-if="isLoading" class="loading text-center p-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">{{ t.loading || 'Loading...' }}</span>
                </div>
                <p class="mt-2">{{ t.loading || 'Loading...' }}</p>
            </div>

            <div v-else-if="error" class="alert alert-danger">
                {{ error }}
            </div>

            <div v-else-if="!polygonsList.length" class="alert alert-info">
                {{ t.select_areas_on_map || 'Select one or more areas on the map by holding down the ctrl key to view wave indicators.' }}
            </div>

            <div v-else>
                <div class="chart-container position-relative mb-2">
                <canvas ref="chartCanvas"></canvas>
                </div>

                <div class="row">
                    <div v-for="polygon in polygonsList" :key="polygon.mpa.properties.id" class="col-3">
                        <div class="card">
                            <div class="card-header bg-primary text-white mb-2" style="min-height: 4rem; display: flex; align-items: center; line-height: 1.2; overflow: hidden;">
                                {{ getPolygonName(polygon) }} : {{ selectedDate }}
                            </div>
                            <network-indicator
                                :data-point="polygon.data"
                                :quantile="polygon.quantile"
                                :min-delta="polygon.min_delta"
                                :max-delta="polygon.max_delta">
                            </network-indicator>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
}