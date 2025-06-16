export const MPAInfo = {
    props: {
        generatePdfUrl: {
            type: String,
            default: ''
        },
        mpa: {
            type: Object,
            default: null
        },
        dates: {
            type: Object,
            default: () => ({})
        },
        depth: {
            type: String,
            default: ''
        }
    },
    computed: {
        completePdfUrl() {
            if (!this.mpa || !this.mpa.id) return this.generatePdfUrl;

            let url = this.generatePdfUrl;
            let separator = '&';
            url += `?mpa=${this.mpa.id}`;
            if (this.dates) {
                if (this.dates.startDate) {
                    url += `${separator}start_date=${this.dates.startDate}`;
                }
                if (this.dates.endDate) {
                    url += `${separator}end_date=${this.dates.endDate}`;
                }
                if (this.dates.selectedDate) {
                    url += `${separator}selected_date=${this.dates.selectedDate}`;
                }
            }

            url += `${separator}depth=${this.depth || ''}`;

            return url;
        }
    },
    template: `
    <div class="card">
      <div class="card-header">
        <div class="card-title">
          <div class="row">
            <div class="col-1">
              <img class="img-fluid" src="/static/icons/favicon.png">
            </div>
            <div class="col">
              <h2>MPA Description</h2>
            </div>
            <div class="col-auto">
              <a id="btn_id_pdf" class="btn btn-primary" :style="{ display: mpa.name ? 'block' : 'none' }"
                 :href="completePdfUrl">Generate PDF</a>
            </div>
          </div>
        </div>
      </div>
      <div class="card-body">
        <div class="row">
          <div class="col-2"><b>Name:</b></div>
          <div class="col">{{ mpa.name }}</div>
        </div>
        <div class="row">
          <div class="col-2"><b>Classification:</b></div>
          <div class="col"><a :href="mpa.classification">{{ mpa.class }}</a></div>
        </div>
        <div class="row">
          <div class="col-2"><b>URL:</b></div>
          <div class="col"><a v-if="mpa.url" :href="mpa.url">Additional Information</a></div>
        </div>
        <div class="row">
          <div class="col-2"><b>km^2:</b></div>
          <div v-if="mpa.km2" class="col">{{ mpa.km2 }}</div>
        </div>
      </div>
    </div>
  `
};