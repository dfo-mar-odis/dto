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

    data() {
        return {
            polygonsList: [],  // Our internal list of selected polygons
            isLoading: false,
            error: null,
            polygonsData: {}   // Will store data for each polygon when fetched
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
        }
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
                        polygon.data = climate_data.data;
                        polygon.quantile = climate_data.quantile;
                        polygon.min_delta = climate_data.min_delta;
                        polygon.max_delta = climate_data.max_delta;
                    }
                });

                this.isLoading = false;
            } catch (error) {
                this.error = "Failed to load data";
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
                polygon.data = climate_data.data;
                polygon.quantile = climate_data.quantile;
                polygon.min_delta = climate_data.min_delta;
                polygon.max_delta = climate_data.max_delta

                this.isLoading = false;
            } catch (error) {
                this.error = "Failed to load data";
                this.isLoading = false;
            }
        },
        getPolygonName(polygon) {
            return polygon.mpa.properties.name;
        }
    },

    template: `
        <div class="network-indicators">
            <h3 class="mb-3">Marine Heat/Cold Wave Indicators</h3>

            <div v-if="isLoading" class="loading text-center p-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Loading data...</p>
            </div>

            <div v-else-if="error" class="alert alert-danger">
                {{ error }}
            </div>

            <div v-else-if="!polygonsList.length" class="alert alert-info">
                Select one or more areas on the map by holding down the ctrl key to view wave indicators.
            </div>

            <div v-else>
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