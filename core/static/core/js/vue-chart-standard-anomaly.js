// Export the component definition instead of registering it immediately
export const StandardAnomalyChart = {
    props: {
        timeseries_type: 1,
        mpa: {
            type: Object,
            default: () => ({})
        },
        dataUrl: String,  // Make sure this prop is defined
        isActive: Boolean
    },

    computed: {
        t() {
            return window.translations || {};
        },
    },

    data() {
        return {
            loading: false,
            chart: null,
            chartData: null
        };
    },

    watch: {
        mpa: {
            handler: 'fetchChartData',
            deep: true
        },
        isActive(newValue) {
            if (newValue && this.mpa.id) {
                this.fetchChartData();
            }
        }
    },

    methods: {
        async fetchChartData() {
            if (!this.mpa.id || !this.dataUrl) return;

            this.loading = true;

            // Build the URL with parameters
            const url = new URL(this.dataUrl, window.location.origin);
            url.searchParams.set('mpa', this.mpa.id);
            url.searchParams.set('type', this.timeseries_type)

            // Fetch and update the chart
            fetch(url.toString())
                .then(response => response.json())
                .then(data => {
                    this.chartData = data;
                    this.updateChart();
                })
                .catch(error => {
                    console.error("Error fetching chart data:", error);
                })
                .finally(() => {
                    this.loading = false;
                });
        },

        updateChart() {
            if (!this.chartData) return;
            this.renderChart();
        },

        formatChartData() {
            // Check if data and required properties exist
            if (!this.chartData || !this.chartData.dates || !this.chartData.values) {
                console.warn('Invalid chart data received:', this.chartData);
                return {
                    datasets: []
                };
            }

            // Ensure arrays are valid
            const dates = this.chartData.dates;
            const values = this.chartData.values;

            if (!Array.isArray(dates) || !Array.isArray(values)) {
                console.warn('Chart data properties are not arrays:', this.chartData);
                return {datasets: []};
            }

            // Create data points by combining dates and values arrays
            const dataPoints = [];
            const length = Math.min(dates.length, values.length);

            for (let i = 0; i < length; i++) {
                // Skip data points with invalid values
                if (values[i] === null || values[i] === undefined) {
                    continue;
                }

                dataPoints.push({
                    x: new Date(dates[i]),
                    y: parseFloat(values[i])
                });
            }

            // Return formatted data structure for Chart.js
            return {
                datasets: [{
                    label: 'Standard Anomaly',
                    data: dataPoints,
                    borderColor: '#4285F4',
                    backgroundColor: 'rgba(66, 133, 244, 0.1)',
                    tension: 0.1,
                    pointRadius: 3
                }]
            };
        },

        renderChart() {
            const ctx = this.$refs['chartCanvas'].getContext('2d');

            if (this.chart) {
                this.chart.destroy();
            }

            // Format data for Chart.js
            const formattedData = this.formatChartData();
            // Set up dynamic background colors based on values
            if (formattedData.datasets[0] && formattedData.datasets[0].data) {
                formattedData.datasets[0].backgroundColor = formattedData.datasets[0].data.map(point =>
                    point.y < 0 ? 'rgba(66, 133, 244, 0.7)' : 'rgba(234, 67, 53, 0.7)' // Blue for negative, red for positive
                );
                formattedData.datasets[0].borderColor = formattedData.datasets[0].data.map(point =>
                    point.y < 0 ? 'rgba(66, 133, 244, 1)' : 'rgba(234, 67, 53, 1)'
                );
                // Remove line styling properties
                delete formattedData.datasets[0].tension;
                delete formattedData.datasets[0].pointRadius;
            }
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
                            text: (window.translations?.standard_anomalies || 'Standard Anomalies') + ' - ' + (this.mpa.name || '')
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: false,
                                generateLabels: () => [
                                    {
                                        text: (window.translations?.above_normal || 'Above Normal') +' ( > 0)',
                                        fillStyle: 'rgba(234, 67, 53, 0.7)',
                                        strokeStyle: 'rgba(234, 67, 53, 1)',
                                        lineWidth: 1,
                                        hidden: false
                                    },
                                    {
                                        text: (window.translations?.below_normal || 'Below Normal') +' ( < 0)',
                                        fillStyle: 'rgba(66, 133, 244, 0.7)',
                                        strokeStyle: 'rgba(66, 133, 244, 1)',
                                        lineWidth: 1,
                                        hidden: false
                                    }
                                ]
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'year',
                                displayFormats: {
                                    month: 'YYYY'
                                }
                            },
                            title: {
                                display: true,
                                text: window.translations?.year || 'Year'
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: (window.translations?.standard_anomaly || 'Standardized Anomaly')
                            },
                            suggestedMin: -3,
                            suggestedMax: 3
                        }
                    }
                }
            });
        },
    },

    mounted() {
        if (this.isActive && this.mpa.id) {
            this.fetchChartData();
        }
    },

    beforeUnmount() {
        if (this.chart) {
            this.chart.destroy();
        }
    },

    template: `
        <div class="chart-container position-relative">
          <div v-if="loading" class="chart-loading-overlay">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">{{ t.loading || 'Loading...' }}</span>
            </div>
          </div>
          <canvas ref="chartCanvas"></canvas>
          <div v-if="!mpa.name" class="text-center text-muted mt-5 pt-5">
            <i class="bi bi-map"></i>
            <p>{{ t.select_mpa_on_map_anomaly || 'Select an MPA on the map to view standard anomaly data' }}</p>
          </div>
        </div>
        `,
};