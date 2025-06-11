const MPAInfo = {
  props: ['mpa'],
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
                 href="/core/generate_pdf/">Generate PDF</a>
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
          <div class="col"><a :href="mpa.url">{{ mpa.url }}</a></div>
        </div>
        <div class="row">
          <div class="col-2"><b>km^2:</b></div>
          <div class="col">{{ mpa.km2 }}</div>
        </div>
      </div>
    </div>
  `
};