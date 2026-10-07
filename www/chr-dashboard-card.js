/* ============================================================================
   Toyota C-HR — Status & History dashboard card  (custom:chr-dashboard-card)
   One self-contained card: KPIs + usage-history charts + 12V health trend.
   Reads live state from the toyota_chr integration and draws charts with
   Highcharts (loaded once from CDN). Add with a single line:

       type: custom:chr-dashboard-card

   Optional entity overrides (defaults shown):
       fuel:    sensor.toyota_c_hr_fuel_level
       hv:      sensor.toyota_c_hr_hv_battery_soc
       volt:    sensor.toyota_c_hr_12v_battery
       dtc:     sensor.toyota_c_hr_fault_codes
       speed:   sensor.toyota_c_hr_engine_... (speed)
       rpm:     sensor.toyota_c_hr_engine_rpm
       load:    sensor.toyota_c_hr_engine_load
       coolant: sensor.toyota_c_hr_coolant_temp
       in_range:binary_sensor.toyota_c_hr_in_range
   ----------------------------------------------------------------------------
   Re-render guard: DOM + charts are built ONCE; HA state pushes only update
   values and push chart points. Avoids the known "rebuild-on-every-poll" flicker.
   History charts pull from HA's recorder via the websocket history API.
   ============================================================================ */
const HC_SRC = "https://cdn.jsdelivr.net/npm/highcharts@12.1.2/highcharts.js";

class ChrDashboardCard extends HTMLElement {
  setConfig(config) {
    this._cfg = Object.assign({
      fuel: "sensor.toyota_c_hr_fuel_level",
      hv: "sensor.toyota_c_hr_hv_battery_soc",
      volt: "sensor.toyota_c_hr_12v_battery",
      dtc: "sensor.toyota_c_hr_fault_codes",
      speed: "sensor.toyota_c_hr_speed",
      rpm: "sensor.toyota_c_hr_engine_rpm",
      load: "sensor.toyota_c_hr_engine_load",
      coolant: "sensor.toyota_c_hr_coolant_temp",
      intake: "sensor.toyota_c_hr_intake_air_temp",
      ambient: "sensor.toyota_c_hr_ambient_temp",
      in_range: "binary_sensor.toyota_c_hr_in_range",
    }, config);
    this._built = false;
    this._charts = {};
    this._lastHistory = 0;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    this._updateValues();
    // Refresh history charts at most every 5 min (recorder data changes slowly).
    const now = Date.now();
    if (now - this._lastHistory > 5 * 60 * 1000) {
      this._lastHistory = now;
      this._loadHistory();
    }
  }

  _st(id) {
    const s = this._hass && this._hass.states[id];
    if (!s || s.state === "unknown" || s.state === "unavailable") return null;
    return s.state;
  }
  _n(id) { const v = this._st(id); return v === null ? null : parseFloat(v); }

  async _ensureHighcharts() {
    if (window.Highcharts) return;
    await new Promise((res, rej) => {
      const sc = document.createElement("script");
      sc.src = HC_SRC; sc.onload = res; sc.onerror = rej;
      document.head.appendChild(sc);
    });
  }

  _build() {
    const root = this.shadowRoot || this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host{--txt:#e9f1fb;--muted:#73839b;--line:rgba(255,255,255,.08);
              --cyan:#1fe0ff;--lime:#8aff00;--amber:#ffb020;--red:#ff3b5c;
              --violet:#9d7bff;--green:#2ee6a0;display:block}
        ha-card{padding:16px;color:var(--txt);
          background:radial-gradient(900px 400px at 85% -20%,rgba(31,224,255,.08),transparent 60%)}
        .h{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
        .h .t{font-size:17px;font-weight:700;display:flex;gap:8px;align-items:center}
        .pill{font-size:11px;padding:4px 10px;border-radius:999px;border:1px solid var(--line)}
        .sub{font-size:12px;color:var(--muted);margin-bottom:14px;display:flex;gap:14px;flex-wrap:wrap}
        .sec{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:16px 0 8px}
        .grid{display:grid;gap:10px}
        .k4{grid-template-columns:repeat(4,1fr)} .k2{grid-template-columns:1fr 1fr}
        @media(max-width:700px){.k4{grid-template-columns:repeat(2,1fr)}.k2{grid-template-columns:1fr}}
        .cell{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:14px;padding:12px}
        .lab{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
        .big{font-size:28px;font-weight:700;font-family:ui-monospace,monospace;line-height:1;margin-top:4px}
        .u{font-size:12px;color:var(--muted)}
        .s2{font-size:11px;color:var(--muted);margin-top:4px}
        .bar{height:7px;border-radius:5px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:9px}
        .bar>span{display:block;height:100%;border-radius:5px;transition:width .4s}
        .chart{height:190px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        td{padding:6px 0;border-bottom:1px solid var(--line)}
        td:last-child{text-align:right;font-family:ui-monospace,monospace;color:var(--muted)}
        tr:last-child td{border:none}
      </style>
      <ha-card>
        <div class="h">
          <div class="t">🚗 Toyota C-HR — Status &amp; History</div>
          <div class="pill" id="pill">—</div>
        </div>
        <div class="sub">
          <span>Fuel: <b id="sFuel" style="color:var(--txt)">—</b></span>
          <span>HV: <b id="sHv" style="color:var(--txt)">—</b></span>
          <span>12V: <b id="sVolt" style="color:var(--txt)">—</b></span>
        </div>

        <div class="sec">Vehicle State (last reading)</div>
        <div class="grid k4">
          <div class="cell">
            <div class="lab">Fuel &amp; Range</div>
            <div><span class="big" id="fuelV" style="color:var(--amber)">—</span><span class="u">%</span></div>
            <div class="s2" id="fuelSub"></div>
            <div class="bar"><span id="fuelBar" style="width:0%;background:var(--amber)"></span></div>
          </div>
          <div class="cell">
            <div class="lab">HV Battery</div>
            <div><span class="big" id="hvV" style="color:var(--lime)">—</span><span class="u">%</span></div>
            <div class="s2">hybrid pack SoC</div>
            <div class="bar"><span id="hvBar" style="width:0%;background:var(--lime)"></span></div>
          </div>
          <div class="cell">
            <div class="lab">12V Battery</div>
            <div><span class="big" id="voltV">—</span></div>
            <div class="s2" id="voltSub"></div>
          </div>
          <div class="cell">
            <div class="lab">Fault Codes</div>
            <div><span class="big" id="dtcV">—</span></div>
            <div class="s2" id="dtcSub"></div>
          </div>
        </div>

        <div class="sec">Usage History</div>
        <div class="grid k2">
          <div class="cell"><div class="lab">Speed activity · 7 days</div><div class="chart" id="cSpeed"></div></div>
          <div class="cell"><div class="lab">Engine load trend · 7 days</div><div class="chart" id="cLoad"></div></div>
        </div>
        <div class="grid k2" style="margin-top:10px">
          <div class="cell"><div class="lab">Fuel level trend · 30 days</div><div class="chart" id="cFuel"></div></div>
          <div class="cell"><div class="lab">Speed &amp; RPM · 2h</div><div class="chart" id="cSR"></div></div>
        </div>

        <div class="sec">Health Monitor</div>
        <div class="grid k2">
          <div class="cell"><div class="lab">12V voltage · 14 days (watch for decline)</div><div class="chart" id="cVolt"></div></div>
          <div class="cell">
            <div class="lab">Diagnostics &amp; last readings</div>
            <table>
              <tr><td>Coolant</td><td id="dCool">—</td></tr>
              <tr><td>Intake</td><td id="dIntake">—</td></tr>
              <tr><td>Ambient</td><td id="dAmb">—</td></tr>
              <tr><td>Engine load</td><td id="dLoad">—</td></tr>
              <tr><td>In range</td><td id="dRange">—</td></tr>
            </table>
          </div>
        </div>
      </ha-card>`;
    this._root = root;
    this._ensureHighcharts().then(() => this._initCharts()).catch(() => {});
  }

  _hcBase() {
    const g = (v, d) => d;
    return {
      chart: { backgroundColor: "transparent", spacing: [6,4,2,4] },
      credits: { enabled: false }, title: { text: null }, legend: { enabled: false },
      xAxis: { labels: { style: { color: "#73839b", fontSize: "9px" } }, lineColor: "rgba(255,255,255,.08)", tickLength: 0 },
      yAxis: { title: { text: null }, gridLineColor: "rgba(255,255,255,.05)", labels: { style: { color: "#73839b", fontSize: "9px" } } },
      tooltip: { backgroundColor: "#0f1620", borderColor: "rgba(255,255,255,.08)", style: { color: "#e9f1fb" } },
    };
  }

  _initCharts() {
    const HC = window.Highcharts, r = this._root, B = this._hcBase();
    if (!HC) return;
    this._charts.speed = HC.chart(r.getElementById("cSpeed"),
      { ...B, chart:{...B.chart,type:"column",height:190}, series:[{ data:[], color:"#1fe0ff", borderRadius:3 }] });
    this._charts.load = HC.chart(r.getElementById("cLoad"),
      { ...B, chart:{...B.chart,type:"areaspline",height:190}, series:[{ data:[], color:"#ffb020", lineWidth:2, marker:{enabled:false} }] });
    this._charts.fuel = HC.chart(r.getElementById("cFuel"),
      { ...B, chart:{...B.chart,type:"line",height:190}, series:[{ data:[], color:"#ffb020", lineWidth:2, marker:{enabled:false} }] });
    this._charts.sr = HC.chart(r.getElementById("cSR"),
      { ...B, chart:{...B.chart,type:"areaspline",height:190},
        yAxis:[{...B.yAxis},{...B.yAxis,opposite:true}],
        series:[{ name:"Speed", data:[], color:"#1fe0ff", lineWidth:2, marker:{enabled:false} },
                { name:"RPM", data:[], yAxis:1, type:"line", color:"#ffb020", lineWidth:2, marker:{enabled:false}, dashStyle:"ShortDot" }] });
    this._charts.volt = HC.chart(r.getElementById("cVolt"),
      { ...B, chart:{...B.chart,type:"spline",height:190},
        yAxis:{...B.yAxis, min:11.5, max:14.8,
          plotBands:[{from:11.5,to:12.2,color:"rgba(255,59,92,.12)"},{from:12.2,to:12.6,color:"rgba(255,176,32,.1)"}]},
        series:[{ data:[], color:"#2ee6a0", lineWidth:2, marker:{enabled:false} }] });
    this._loadHistory();
  }

  async _hist(entity, hours) {
    if (!this._hass) return [];
    const end = new Date(), start = new Date(end.getTime() - hours*3600*1000);
    try {
      const res = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: start.toISOString(), end_time: end.toISOString(),
        entity_ids: [entity], minimal_response: true, no_attributes: true,
      });
      const arr = (res && res[entity]) || [];
      return arr.map(p => [ (p.lu ? p.lu*1000 : Date.parse(p.last_changed)), parseFloat(p.s ?? p.state) ])
                .filter(p => !isNaN(p[1]));
    } catch (e) { return []; }
  }

  async _loadHistory() {
    if (!this._charts.volt) return;
    const c = this._cfg;
    const [spd7, load7, fuel30, spd2, rpm2, volt14] = await Promise.all([
      this._hist(c.speed, 168), this._hist(c.load, 168), this._hist(c.fuel, 720),
      this._hist(c.speed, 2), this._hist(c.rpm, 2), this._hist(c.volt, 336),
    ]);
    if (this._charts.speed) this._charts.speed.series[0].setData(spd7, true);
    if (this._charts.load)  this._charts.load.series[0].setData(load7, true);
    if (this._charts.fuel)  this._charts.fuel.series[0].setData(fuel30, true);
    if (this._charts.sr)  { this._charts.sr.series[0].setData(spd2, false); this._charts.sr.series[1].setData(rpm2, true); }
    if (this._charts.volt)  this._charts.volt.series[0].setData(volt14, true);
  }

  _updateValues() {
    const r = this._root, c = this._cfg; if (!r) return;
    const inR = this._st(c.in_range) === "on";
    const pill = r.getElementById("pill");
    pill.textContent = inR ? "● In range" : "🌙 Asleep / parked";
    pill.style.color = inR ? "var(--lime)" : "var(--muted)";
    pill.style.borderColor = inR ? "rgba(138,255,0,.35)" : "var(--line)";

    const fuel = this._n(c.fuel), hv = this._n(c.hv), volt = this._n(c.volt);
    const set = (id, v) => { const e = r.getElementById(id); if (e) e.textContent = v; };

    set("fuelV", fuel==null?"—":Math.round(fuel)); r.getElementById("fuelBar").style.width=(fuel||0)+"%";
    r.getElementById("fuelSub").textContent = fuel==null?"":"≈ "+Math.round((43*fuel/100)/4.8*100)+" km range";
    set("sFuel", fuel==null?"—":Math.round(fuel)+"%");

    set("hvV", hv==null?"—":Math.round(hv)); r.getElementById("hvBar").style.width=(hv||0)+"%";
    set("sHv", hv==null?"—":Math.round(hv)+"%");

    const vEl=r.getElementById("voltV"), vSub=r.getElementById("voltSub");
    if (volt==null){vEl.textContent="—";vSub.textContent="";set("sVolt","—");}
    else {
      vEl.textContent=volt.toFixed(1)+" V"; set("sVolt",volt.toFixed(1)+" V");
      if(volt<12.2){vEl.style.color="var(--red)";vSub.textContent="⚠ low — check battery";}
      else if(volt<12.6){vEl.style.color="var(--amber)";vSub.textContent="slightly low";}
      else{vEl.style.color="var(--green)";vSub.textContent="● healthy";}
    }

    const dtc=this._st(c.dtc), dEl=r.getElementById("dtcV"), dSub=r.getElementById("dtcSub");
    const clear = dtc==null||["0","None","unknown",""].includes(dtc);
    dEl.textContent = dtc==null?"0":dtc; dEl.style.color=clear?"var(--green)":"var(--red)";
    dSub.textContent = clear?"● no faults":"⚠ fault stored";

    const u=(id,id2,unit)=>{const v=this._st(id2);r.getElementById(id).textContent=v==null?"—":v+(unit||"");};
    u("dCool",c.coolant," °C"); u("dIntake",c.intake," °C"); u("dAmb",c.ambient," °C");
    u("dLoad",c.load," %"); r.getElementById("dRange").textContent = inR?"Yes":"No";
  }

  getCardSize() { return 12; }
}
customElements.define("chr-dashboard-card", ChrDashboardCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "chr-dashboard-card",
  name: "Toyota C-HR Status & History",
  description: "Full status + history dashboard (KPIs, usage charts, 12V health trend) in one card",
});
