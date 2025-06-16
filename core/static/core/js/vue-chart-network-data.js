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
        togglePolygon(polygon) {
            if (!polygon) return;

            if(!this.isCtrlPressed) {
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
                this.polygonsList.push(polygon);
            }

            // Emit updated list to parent component
            this.$emit('polygon-list-updated', this.polygonsList);
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
                <div class="row mb-2">
                    <div v-for="polygon in polygonsList" :key="polygon.mpa.properties.id" class="col-3">
                        <div class="card">
                            <div class="card-header bg-primary text-white">
                                {{ getPolygonName(polygon) }}
                            </div>
                            <div class="card-body">
                                <!-- We'll replace this with NetworkIndicator components once we implement data fetching -->
                                <p>Selected area: {{ getPolygonName(polygon) }}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
}