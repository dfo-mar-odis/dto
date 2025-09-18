// Export the component definition instead of registering it immediately
export const SiteIndicatorsChart = {
    props: {
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
            isLoading: false,
            chartData: {},
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
            if ( !this.isActive || !this.mpa ) {
                return;
            }

            // Build the URL with parameters
            const url = new URL(this.dataUrl, window.location.origin);
            url.searchParams.append('mpa_id', this.mpa.id);

            this.isLoading = true;
            this.chartData = {}

            // Fetch and update the chart
            fetch(url.toString())
                .then(response => response.json())
                .then(data => {
                    // We should only ever be getting data from one MPA in this setup
                    const indicators = data[0].indicators
                    indicators.forEach(indicator => {
                       this.chartData[indicator.indicator_id] = indicator;
                    });

                    this.$nextTick(() => {
                        this.renderCharts();
                    });
                })
                .catch(error => {
                    console.error("Error fetching chart data:", error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        },

        formatChartData(chart_data) {
            const dataPoints = chart_data.map(data => ({x: new Date(data.year+"-01-01"), y: parseFloat(data.value)})); // Extract values

            const backgroundColor = dataPoints.map(point => point.y < 0 ? 'rgba(66, 133, 244, 0.7)' : 'rgba(234, 67, 53, 0.7)');
            const borderColor = dataPoints.map(point => point.y < 0 ? 'rgba(66, 133, 244, 0.7)' : 'rgba(234, 67, 53, 0.7)');

            const dataset = {
                label: "%",
                data: dataPoints,
                borderColor: borderColor,
                backgroundColor: backgroundColor,
            }

            // Return formatted data structure for Chart.js
            return {
                datasets: [dataset]
            };
        },

        renderCharts() {
            const chartDataKeys = Object.keys(this.chartData);
            chartDataKeys.forEach(key => this.renderChart(key));
        },

        renderChart(chart_id) {
            const chart_data = this.chartData[chart_id];
            const ctx = this.$refs['chartCanvas_'+chart_id][0].getContext('2d');

            if (this.chartData[chart_id]['chart']) {
                this.chartData[chart_id]['chart'].destroy();
            }

            // Format data for Chart.js
            const formattedData = this.formatChartData(chart_data.data);

            this.chartData[chart_id]['chart'] = new Chart(ctx, {
                type: 'bar',
                data: formattedData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: false,
                    plugins: {
                        title: {
                            display: true,
                            text: chart_data.title + ' - ' + (this.mpa.name || '')
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
                                text: chart_data.unit
                            },
                            suggestedMin: -3,
                            suggestedMax: 3
                        }
                    }
                }
            });
        },
    },

    template: `
    <div class="mb-2" v-for="(data, chart_id) in chartData" :key="chart_id">
      <div class="chart-container position-relative">
        <div v-if="isLoading" class="chart-loading-overlay">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">{{ t.loading || 'Loading...' }}</span>
          </div>
        </div>
          <canvas :ref="'chartCanvas_' + chart_id"></canvas>
        <div v-if="!mpa" class="text-center text-muted mt-5 pt-5">
          <i class="bi bi-map"></i>
          <p>Select an MPA on the map</p>
        </div>
      </div>
    </div>
    `,
};