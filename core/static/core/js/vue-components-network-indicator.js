export const NetworkIndicator = {
    props: {
        mpa_indicator: {
            type: Object,
            default: null
        },
    },
    computed: {
        t() {
            return window.translations || {};
        },
    },
    data() {
        return {
        };
    },

    watch: {
    },

    methods: {
        // set the colour for the indicator bar
        getStatusClass() {
            return 'bg-success';                     // default
        },
        formatValue(value) {
            return parseFloat(value).toFixed(2);
        }
    },

    template: `
    <div class="card mb-2">
        <div class="card-header bg-primary text-white mb-2">
            <div class="card-title">
              <span>{{ mpa_indicator.mpa.name }}</span>
            </div>
        </div>
      <div class="card-body">
            <div v-for="indicator in mpa_indicator.indicators" class="mb-1 card bg-body-tertiary">
              <div class="container">
                <div class="row">
                  <div class="col"><span class="bi bi-question-circle me-1"
                                         :title="indicator.description + (indicator.weight ? '\\n\\nWeight: ' + indicator.weight : '')"></span>
                    {{ indicator.title }} : {{ indicator.year }}
                  </div>
                </div>
                <div v-for="val in indicator.data" class="row">
                    <div class="col-auto">{{val.year}} : {{ formatValue(val.value) }}</div>
                    <div class="col">
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar" 
                                 :class="'bg-' + val.colorbar" 
                                 role="progressbar" 
                                 :aria-valuenow="val.value" 
                                 :aria-valuemin="val.min" 
                                 :aria-valuemax="val.max" 
                                 :style="{ width: val.width + '%' }">
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            </div>
      </div>
</div>`,
};