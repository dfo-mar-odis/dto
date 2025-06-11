// vue-standard-anomaly-chart.js
// This needs to be registered before the app is mounted

(function () {
    // Ensure this runs after Vue and before app mounting
    if (typeof mapApp !== 'undefined') {
        mapApp.component('standard-anomaly-chart', {
            props: {
                mpa: {
                    type: Object,
                    default: () => ({})
                },
                startDate: String,
                endDate: String,
                depth: [String, Number],
                chartUrl: String,  // Make sure this prop is defined
                isActive: Boolean
            },

            data() {
                return {
                    loading: false,
                    chart: null,
                    chartData: null
                };
            },

            template: `
            <div class="chart-container position-relative">
              <div v-if="loading" class="chart-loading-overlay">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>
              <canvas ref="chartCanvas"></canvas>
              <div v-if="!mpa.name" class="text-center text-muted mt-5 pt-5">
                <i class="bi bi-map"></i>
                <p>Select an MPA on the map to view standard anomaly data</p>
              </div>
            </div>
          `,

            watch: {
                chartUrl: {
                    immediate: true,
                    handler(newUrl) {
                        console.log("Chart URL updated:", newUrl);
                        if (newUrl && this.mpa && this.mpa.id) {
                            this.fetchChartData();
                        }
                    }
                },
                mpa: {
                    handler(newMpa) {
                        if (newMpa && newMpa.name) {
                            this.fetchChartData();
                        }
                    },
                    deep: true
                },
                startDate() {
                    if (this.mpa.id) this.fetchChartData();
                },
                endDate() {
                    if (this.mpa.id) this.fetchChartData();
                },
                depth() {
                    if (this.mpa.id) this.fetchChartData();
                },
                isActive(val) {
                    if (val && this.chart) {
                        this.$nextTick(() => this.chart.resize());
                    }
                }
            },

            methods: {
                async fetchChartData() {
                    // Add debugging and validation
                    console.log("fetchChartData called with URL:", this.chartUrl);

                    if (!this.mpa.id) {
                        console.warn("No MPA selected");
                        return;
                    }

                    if (!this.chartUrl) {
                        console.error("Chart URL is undefined");
                        return;
                    }

                    this.loading = true;

                    try {
                        const url = new URL(this.chartUrl, window.location.origin);
                        url.searchParams.set('mpa', this.mpa.id);
                        url.searchParams.set('start_date', this.startDate);
                        url.searchParams.set('end_date', this.endDate);

                        if (this.depth) {
                            url.searchParams.set('depth', this.depth);
                        }

                        console.log("Fetching data from:", url.toString());
                        const response = await fetch(url.toString());

                        if (!response.ok) {
                            throw new Error(`Failed to fetch chart data: ${response.status}`);
                        }

                        this.chartData = await response.json();
                        this.renderChart();
                    } catch (error) {
                        console.error("Error fetching anomaly chart data:", error);
                    } finally {
                        this.loading = false;
                    }
                },

                renderChart() {
                    const ctx = this.$refs.chartCanvas.getContext('2d');

                    if (this.chart) {
                        this.chart.destroy();
                    }

                    // Format data for Chart.js
                    const formattedData = this.formatChartData(this.chartData);

                    this.chart = new Chart(ctx, {
                        type: 'line',
                        data: formattedData,
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                title: {
                                    display: true,
                                    text: `Standard Anomalies - ${this.mpa.id}`
                                },
                                tooltip: {
                                    mode: 'index',
                                    intersect: false
                                },
                                legend: {
                                    position: 'bottom'
                                }
                            },
                            scales: {
                                x: {
                                    type: 'time',
                                    time: {
                                        unit: 'month',
                                        displayFormats: {
                                            month: 'MMM YYYY'
                                        }
                                    },
                                    title: {
                                        display: true,
                                        text: 'Date'
                                    }
                                },
                                y: {
                                    title: {
                                        display: true,
                                        text: 'Standard Anomaly'
                                    },
                                    suggestedMin: -3,
                                    suggestedMax: 3
                                }
                            }
                        }
                    });
                },

                formatChartData(data) {
                    return {
                        datasets: [
                            {
                                label: 'Standard Anomaly',
                                data: this.chart.value.dates.map((date, index) => ({
                                    x: new Date(date),
                                    y: this.chart.value.values[index]
                                })),
                                borderColor: 'rgb(75, 192, 192)',
                                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                                borderWidth: 2,
                                fill: true
                            }
                        ]
                    };
                }
            },

            mounted() {
                if (this.mpa && this.mpa.id) {
                    this.fetchChartData();
                }
            },

            beforeUnmount() {
                if (this.chart) {
                    this.chart.destroy();
                }
            }
        });
    } else {
        console.error("mapApp not found, component cannot be registered");
    }
})();