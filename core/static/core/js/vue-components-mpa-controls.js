export const MPAControls = {
    props: {
        mpa: Object,
        timeseries_type: {
            type: Number,
            default: 1
        },
        maxDateUrl: {
            type: String,
            required: true
        },
    },
    computed: {
        t() {
            return window.translations || {};
        }
    },
    data() {
        return {
            state: {
                depth: "",
                dates: {
                    start_date: null,
                    end_date: null,
                    selected_date: null
                },
                depths: [],
            },
            debounceTimer: null
        };
    },
    watch: {
        mpa: {
            handler(newMpa, oldMpa) {
                // Reset depth selection when MPA changes
                this.state.depth = "";
                // Fetch new depths for this MPA
                this.state.depths = newMpa.depths
                    .filter(depth => depth !== null)
                    .map(depth => [depth, `${depth} m`]);
                this.setSelectedDepth();
            },
            deep: true
        },
        'state.dates.start_date': function (newVal, oldVal) {
            // Emit only when we have a complete date value and it has changed
            if (newVal &&
                newVal.match(/^\d{4}-\d{2}-\d{2}$/) &&
                newVal !== oldVal) {
                this.setDateRange();
            }
        },
        'state.dates.end_date': function (newVal, oldVal) {
            // Emit only when we have a complete date value and it has changed
            if (newVal &&
                newVal.match(/^\d{4}-\d{2}-\d{2}$/) &&
                newVal !== oldVal) {
                this.setDateRange();
            }
        },
        'state.dates.selected_date': function (newVal, oldVal) {
            // Emit only when we have a complete date value and it has changed
            if (newVal &&
                newVal.match(/^\d{4}-\d{2}-\d{2}$/) &&
                newVal !== oldVal) {
                this.setSelectedDate(newVal);
            }
        },

    },
    mounted() {
        // This endpoint will return a timeseries and climatology that can be used in multiple charts
        const tsUrl = new URL(this.maxDateUrl, window.location.origin);

        // We need to tell the url call that we only want dates for bottom data
        tsUrl.searchParams.set('type', this.timeseries_type);

        // Fetch the max date from the server when component is mounted
        fetch(tsUrl.toString())
            .then(response => response.json())
            .then(data => {
                // Calculate start date (5 years before end date)
                const startDate = new Date(data.max_date);
                startDate.setFullYear(startDate.getFullYear() - 5);

                const defaultEndDate = new Date(data.max_date);
                defaultEndDate.setDate(defaultEndDate.getDate() - 1);

                // Update component state
                this.state.dates.end_date = defaultEndDate.toISOString().split('T')[0];
                this.state.dates.start_date = startDate.toISOString().split('T')[0];
                this.state.dates.selected_date = this.state.dates.end_date;

                // Initialize with default zoom range
                this.$nextTick(() => {
                    this.setDateRange();
                });
            })
            .catch(error => {
                console.error("Failed to fetch max date:", error);
            });

    },
    methods: {
        panFrame(years) {
            // Create new Date objects from current values
            const startDate = new Date(this.state.dates.start_date);
            const endDate = new Date(this.state.dates.end_date);

            // Add years to both dates
            startDate.setFullYear(startDate.getFullYear() + years);
            endDate.setFullYear(endDate.getFullYear() + years);

            // Convert back to YYYY-MM-DD format
            this.state.dates.start_date = startDate.toISOString().split('T')[0];
            this.state.dates.end_date = endDate.toISOString().split('T')[0];

            // Emit the pan-frame event with the years value
            this.$emit('pan-frame', years);

        },

        setSelectedDate(date) {
            // If a date is provided, update the selected date
            if (date) {
                const formattedDate = date instanceof Date
                    ? date.toISOString().split('T')[0]
                    : date;

                // Validate the date is after 1800-01-01
                const minDate = new Date('1800-01-01');
                const selectedDate = new Date(formattedDate);

                if (!isNaN(selectedDate.getTime()) && selectedDate >= minDate) {
                    this.state.dates.selected_date = formattedDate;

                    // Emit an event for the selected date
                    clearTimeout(this.debounceTimer);
                    this.debounceTimer = setTimeout(() => {
                        this.$emit('selected-date-changed', this.state.dates.selected_date);
                    }, 1000);
                }
            }
        },

        setDateRange() {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => {
                this.$emit('date-range-change', {
                    date: this.state.dates
                });
            }, 1000);
        },

        setSelectedDepth() {
            // Fetch data based on selected depth
            this.$emit('depth-selected', this.state.depth);
        },

    },

    template: `
        <div class="card">
            <div class="card-body">
                <div class="row justify-content-center">
                    <div v-if="timeseries_type==1" class="col-auto align-content-center">
                        <label for="btm_depth">{{ t.bottom_depth || 'Bottom Depth' }}</label>
                        <select class="form-select" id="btm_depth"
                            v-model="state.depth"
                            @change="setSelectedDepth(state.depth)">
                            <option v-for="depth in state.depths" 
                                    :key="depth[0]" 
                                    :value="depth[0]">
                                {{ depth[1] }}
                            </option>
                            <option value="">{{ t.total_average_bottom_timeseries || 'Total Average Bottom Timeseries' }}</option>
                        </select>
                    </div>
                    <div class="col-auto align-content-center mt-4">
                        <button type="button" class="btn btn-secondary me-1" :title="'-10 ' + (t.year_s || 'year(s)')"
                                @click="panFrame(-10)"><<<</button>
                        <button type="button" class="btn btn-secondary me-1" :title="'-5 ' + (t.year_s || 'year(s)')"
                                @click="panFrame(-5)"><<</button>
                        <button type="button" class="btn btn-secondary" :title="'-1 ' + (t.year_s || 'year(s)')"
                                @click="panFrame(-1)"><</button>
                    </div>
                    <div class="col">
                        <label for="date_min" class="form-label">{{ t.start_date || 'Start Date' }}</label>
                        <input id="date_min" type="date" class="form-control"
                               v-model="state.dates.start_date"
                               @change="setDateRange"
                               max="9999-12-31"/>
                    </div>
                    <div class="col">
                        <label for="selected_date"
                               class="form-label">{{ t.selected_date || 'Selected Date' }}</label>
                        <input id="selected_date" type="date" class="form-control"
                               v-model="state.dates.selected_date"
                               @change="setSelectedDate(state.dates.selected_date)"
                               max="9999-12-31"/>
                    </div>
                    <div class="col">
                        <label for="date_end" class="form-label">{{ t.end_date || 'End Date' }}</label>
                        <input id="date_end" type="date" class="form-control"
                               v-model="state.dates.end_date"
                               @change="setDateRange"
                               max="9999-12-31"/>
                    </div>
                    <div class="col-auto align-content-center mt-4">
                        <button type="button" class="btn btn-secondary me-1" :title="'+1 ' + (t.year_s || 'year(s)')"
                                @click="panFrame(1)">></button>
                        <button type="button" class="btn btn-secondary me-1" :title="'+5 ' + (t.year_s || 'year(s)')"
                                @click="panFrame(5)">>></button>
                        <button type="button" class="btn btn-secondary" :title="'+10 ' + (t.year_s || 'year(s)')"
                                @click="panFrame(10)">>>></button>
                    </div>
                </div>
            </div>
        </div>
    `,
};