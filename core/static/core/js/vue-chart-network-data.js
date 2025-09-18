import {NetworkIndicator} from './vue-components-network-indicator.js';

// Indicator Data Structure
//
// PolygonDataList: [
// {
//     mpa: {
//         id: int // site_id for the mpa
//         name: String // name of the MPA zone
//     },
//     indicators: [
//     {
//           indicator_meta_data:
//           {
//               title: String // Name of the indicator
//               description: String // description of the indicator
//               min: float // the min value for this indicators dataset
//               max: float // the max value for this indicators dataset
//               weight: int // how much weight is given to this Indicator based on the MPA
//               data: [
//               {
//                   year: int // year this value represents
//                   value: float // value of the indicator for this year
//                   width: float // percentage of the filled colourbar
//                   colourbar: string // Bootstrap colour (success, danger, warning, etc.)
//               },
//               {...},
//               {...}
//               ]
//           }
//     }]
// }]
export const NetworkIndicators = {
    components: {
        NetworkIndicator
    },

    props: {
        isActive: {
            type: Boolean,
            default: false
        },
        selectedPolygon: Object,
        selectedPolygons: Array,
        selectedDate: {
            type: String,
            default: ''
        },
        dataUrl: {
            type: String,
            required: true
        },
    },
    computed: {
        t() {
            return window.translations || {};
        },
    },
    data() {
        return {
            polygonList: [], // Our internal list of current polygon ids that we acquired data for
            requestQueue: [], //queue for pending polygon requests
            polygonDataList: [], // Acquired data
            isLoading: false,
            error: null,
            chart: null,
        }
    },

    watch: {
        selectedDate: {
            handler(newPolygon) {
                this.requestData();
            }
        },
        selectedPolygon:{
            handler(newPolygon) {
                this.requestData();
            }
        },
        isActive: {
            handler(newVal) {
                this.requestData();
            }
        }
    },

    methods: {
        requestData() {
            if ( !this.isActive ) {
                return;
            }
            if (!this.selectedPolygons || (this.selectedPolygons && !this.selectedPolygons.length)) {
                return;
            }

            // Build the URL with parameters
            const year = this.selectedDate.split('-')[0];
            const url = new URL(this.dataUrl, window.location.origin);
            this.selectedPolygons.forEach(poly => {
                url.searchParams.append('mpa_id', poly.mpa.properties.id);
            });
            url.searchParams.append('year', year);

            this.isLoading = true;
            // Fetch and update the chart
            fetch(url.toString())
                .then(response => response.json())
                .then(data => {
                    this.polygonDataList = data;
                    this.computeAggregateHealth();
                    this.$nextTick(() => {
                        this.renderChart();
                    });
                })
                .catch(error => {
                    console.error("Error fetching chart data:", error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        },
        computeAggregateHealth() {
            this.polygonDataList.forEach(poly => {
                // mpa metadata level
                let indicator_sum = 0;
                let weight_sum = 0;
                let min_year = 0;
                let max_year = 0;
                poly.indicators.forEach(indicator =>{
                    // Indicator metadata level
                    let data_sum = 0;
                    indicator.data.forEach(data => {
                        // we use the width because it's already a percentage for the indicator
                        // that puts the indicators value between the min and max for its dataset
                        data_sum += (data.width !== 'nan') ? parseFloat(data.width) : 0;
                        min_year = min_year == 0 ? parseInt(data.year) : Math.min(min_year, parseInt(data.year));
                        max_year = max_year == 0 ? parseInt(data.year) : Math.min(max_year, parseInt(data.year));
                    });
                    weight_sum += indicator.weight;
                    indicator_sum += (data_sum / indicator.data.length) * indicator.weight;
                });

                const overall_health = indicator_sum / weight_sum;
                const overall_health_indicator = {
                    title: "Aggregate Condition",
                    description: "Weighted average of all present indicators",
                    min: 0,
                    max: 100,
                    data: [
                        {
                            year: (min_year !== max_year) ? (min_year + " - " + max_year) : min_year,
                            value: overall_health,
                            width: overall_health,
                            colourbar: "primary"
                        }
                    ]
                }
                poly.indicators.unshift(overall_health_indicator)
            });

            // sort the list in assending order
            this.polygonDataList.sort((a, b) => {
                const valueA = a.indicators[0]?.data[0]?.value || 0;
                const valueB = b.indicators[0]?.data[0]?.value || 0;
                return valueA - valueB;
            });
        },
        getFormattedData() {
            const formattedData = {
                labels: [], // X-axis labels
                datasets: [{
                    data: [], // Y-axis values
                    backgroundColor: [],
                    borderColor: [],
                    borderWidth: 1
                }]
            };

            this.polygonDataList.forEach(poly => {
                formattedData.labels.push(poly.mpa.name)
                let dataset = formattedData.datasets[0];
                dataset.data.push(poly.indicators[0].data[0].value);
                dataset.backgroundColor.push('rgba(0, 0, 255, 0.5)');
            });
            return formattedData;
        },

        renderChart() {
            const ctx = this.$refs.networkChartCanvas.getContext('2d');

            if (this.chart) {
                this.chart.destroy();
            }

            // Format data for Chart.js
            const formattedData = this.getFormattedData();

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
                            text: "Aggregate Condition Comparison"
                        },
                        legend: {
                            position: 'bottom',
                            labels: {
                                usePointStyle: false,
                                generateLabels: () => [
                                ]
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: "Aggregate Condition (%)"
                            },
                        }
                    }
                }
            });
        }
    },

    template: `
        <div class="network-indicators">
            <div class="row">
                <div class="col">
                    <div class="chart-container position-relative mb-2">
                        <div v-if="isLoading" class="chart-loading-overlay">
                            <div class="spinner-border text-primary" role="status">
                              <span class="visually-hidden">{{ t.loading || 'Loading...' }}</span>
                            </div>
                        </div>
                        <canvas ref="networkChartCanvas"></canvas>
                        <div v-if="!polygonDataList.length" class="text-center text-muted mt-5 pt-5">
                            <i class="bi bi-map"></i>
                            <p>No data for selected MPA for the selected Date</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div v-for="polygon in polygonDataList" class="col-6">
                    <network-indicator :mpa_indicator="polygon">
                    </network-indicator>
                </div>
            </div>
        </div>
    `
}