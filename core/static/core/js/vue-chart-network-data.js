import {NetworkIndicator} from './vue-components-network-indicator.js';

export const NetworkIndicators = {
    components: {
        NetworkIndicator
    },

    props: {
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
                if (this.polygonsList.length > 0) {
                    await this.fetchAllPolygonsData();
                }
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
            }

            const polygonId = polygon.mpa.properties?.id || polygon.mpa.id;

            // Check if polygon is already in our list
            const existingIndex = this.polygonsList.findIndex(p =>
                p.mpa.properties?.id === polygonId
            );

            if (existingIndex >= 0) {
                // Remove if already selected (toggle off)
                this.polygonsList.splice(existingIndex, 1);
            } else {
                // Add if not already selected (toggle on)
                await this.fetchPolygonData(polygon)
                this.polygonsList.push(polygon);
            }

            // Emit updated list to parent component
            this.$emit('polygon-list-updated', this.polygonsList);

            // we have to wait a tick before rendering the chart to make sure the canvas,
            // laid out in the template section, was added to the DOM before drawing the
            // chart on screen.
            await this.$nextTick();
            this.renderChart();
        },
        async fetchAllPolygonsData() {
            if (!this.selectedDate || this.polygonsList.length === 0) return;

            try {
                this.isLoading = true;

                // Build query params with all polygon IDs
                const idParams = this.polygonsList.map(polygon =>
                    `id=${polygon.mpa.properties.id}`
                ).join('&');

                const url = `${this.dataUrl}?${idParams}&date=${this.selectedDate}`;
                const response = await fetch(url);
                const data = await response.json();

                // Update each polygon with its data
                this.polygonsList.forEach(polygon => {
                    const id = polygon.mpa.properties.id;
                    if (data[id]) {
                        const climate_data = data[id];
                        this.setPolygonData(polygon, climate_data)
                    }
                });

                this.isLoading = false;

                // we have to wait a tick before rendering the chart to make sure the canvas,
                // laid out in the template section, was added to the DOM before drawing the
                // chart on screen.
                await this.$nextTick();
                this.renderChart();
            } catch (error) {
                this.error = "Failed to load data: " + error;
                this.isLoading = false;
            }
        },
        async fetchPolygonData(polygon) {
            if(!this.selectedDate) return;
            try {
                this.isLoading = true;
                const response = await fetch(`${this.dataUrl}?id=${polygon.mpa.properties.id}&date=${this.selectedDate}`);
                const data = await response.json();

                const climate_data = data[polygon.mpa.properties.id]
                // Attach data directly to the polygon object
                this.setPolygonData(polygon, climate_data);

                this.isLoading = false;

            } catch (error) {
                this.error = "Failed to load data";
                this.isLoading = false;
            }
        },
        computeAnomaly(data) {
            if (data && data.ts_data !== undefined && data.clim !== undefined) {
                return (Number(data.ts_data) - Number(data.clim)) / Number(data.std_dev);
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
            const clim = parseFloat(polygon.data.clim)
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
                            <div class="card-body">
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
        </div>
    `
}