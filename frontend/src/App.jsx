import { useState, useEffect, useMemo } from "react";
const API = import.meta.env.VITE_API || "http://localhost:5000";
import axios from "axios";
import "./glass.css";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS } from "chart.js/auto";
import { BrowserRouter, Routes, Route, useNavigate, useParams } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import delhiWards from "./delhiWards";

/* ---------- LOGIN ---------- */
function Login({ setToken }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const nav = useNavigate();

  const login = async e => {
    e.preventDefault();
    const r = await axios.post(`${API}/api/login`, { email, password });
    setToken(r.data.token);
    nav("/");
  };
return (
  <div className="login-wrapper">
    <div className="mountain-bg">
      <div className="mountain layer1"></div>
      <div className="mountain layer2"></div>
      <div className="mountain layer3"></div>
    </div>

    <div className="login-card animate-fade">
      <h2 className="logintitle">Login</h2>

      <form onSubmit={login} className="login-form">
        <div className="input-group">
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email ID"/>
        </div>

        <div className="input-group">
          <input value={password} type="password" onChange={e=>setPassword(e.target.value)} placeholder="Password"/>
        </div>


        <button className="login-btn">Login</button>

      </form>
    </div>
  </div>
);
}
/* ---------- WARD PROFILE ---------- */
function WardProfile({ data, token }) {
  const { ward } = useParams();

  // ✅ local state for this ward only
  const [list, setList] = useState([]);

  const navWard = delhiWards.find(w => w.name === ward);

  // ✅ sync when data or ward changes
  useEffect(() => {
    setList(data.filter(x => x.ward === ward));
  }, [data, ward]);

const deleteRecord = async (id) => {
  if (!window.confirm("Delete this record?")) return;

  try {
    await axios.delete(`${API}/api/readings/${id}`, {
      headers: { token }
    });

    setList(prev => prev.filter(r => r._id !== id));
  } catch (err) {
    console.error("Delete failed:", err.response?.data || err.message);
    alert("Delete failed. Are you logged in as admin?");
  }
};


  return (
    <div className="app-wrapper dashboard-ui">
      <div className="glass animate-fade">
        <div className="dashboard-scroll">
        <h2  className="title_h2" >{ward} — History</h2>

        <button className="visit_button"
          onClick={() =>
            window.open(
              `https://www.google.com/maps/dir/?api=1&destination=${navWard?.lat},${navWard?.lng}`
            )
          }
        >
          Visit Ward
        </button>

        <Line
          data={{
            labels: list.map(r => new Date(r.date).toLocaleDateString()),
            datasets: [
              { label: "PM2.5", data: list.map(r => r.pm25), borderColor: "#4dabff" },
              { label: "PM10",  data: list.map(r => r.pm10), borderColor: "#ff5fa2" },
              { label: "NO₂",   data: list.map(r => r.no2),  borderColor: "#ffb74d" },
              { label: "SO₂",   data: list.map(r => r.so2 || 0), borderColor: "#81c784" }
            ]
          }}
        />

        <table className="glass-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>PM2.5</th>
              <th>PM10</th>
              <th>NO₂</th>
              <th>SO₂</th>
              <th>AQI</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map(r => (
              <tr key={r._id}>
                <td>{new Date(r.date).toDateString()}</td>
                <td>{r.pm25}</td>
                <td>{r.pm10}</td>
                <td>{r.no2}</td>
                <td>{r.so2}</td>
                <td>{r.aqi}</td>
                <td>
                  <button
                    style={{
                      background: "tomato",
                      color: "#fff",
                      border: "none",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      cursor: "pointer"
                    }}
                    onClick={() => deleteRecord(r._id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
          </div>
      </div>
    </div>
  );
}

/* ---------- DASHBOARD ---------- */
function Dashboard({ token, setToken }) {
  const [data, setData] = useState([]);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("all");
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    wardNo: "",
    ward: "",
    pm25: "",
    pm10: "",
    no2: "",
    so2: "",
    date: ""
  });

  // NEW: role-based views
  const [role, setRole] = useState("govt"); // "govt" | "citizen" | "researcher"
  const isGovt = role === "govt";
  const isCitizen = role === "citizen";
  const isResearcher = role === "researcher";

  // OpenAQ se live data helper
  const fetchLiveForWard = async (wardName) => {
    try {
      const station = wardName; // simple mapping

      const r = await axios.get(
        `${API}/api/live/${encodeURIComponent(station)}`
      );
     const { pm25, pm10, no2, so2, aqi } = r.data;

if (pm25 == null && pm10 == null && no2 == null) {
  alert("Live data not available for this station.");
  return;
}

setForm(f => ({
  ...f,
  ward: wardName,
  pm25: pm25 != null ? String(pm25) : "",
  pm10: pm10 != null ? String(pm10) : "",
  no2:  no2  != null ? String(no2)  : "",
  so2:  so2  != null ? String(so2)  : "",
  date: new Date().toISOString().slice(0, 10)
}));


      // setForm(f => ({
      //   ...f,
      //   ward: wardName,
      //   pm25: String(pm25.toFixed(1)),
      //   pm10: String(pm10.toFixed(1)),
      //   no2: String(no2.toFixed(1)),
      //   date: new Date().toISOString().slice(0, 10)
      // }));

    } catch (err) {
      console.error(err);
      alert("Failed to fetch live data.");
    }
  };

  const load = async () => {
    const res = await axios.get(`${API}/api/readings`);
    setData(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async e => {
    e.preventDefault();
    setErr("");

    const w = delhiWards.find(
      x =>
        x.no == form.wardNo ||
        x.name.toLowerCase() === form.ward.toLowerCase()
    );
    if (!w) {
      setErr("❌ Invalid Ward Number / Name");
      return;
    }

    await axios.post(
      `${API}/api/readings`,
      {
        wardNo: w.no,
        ward: w.name,
        pm25: +form.pm25,
        pm10: +form.pm10,
        no2: +form.no2,
        so2: +form.so2,
        date: form.date,
        lat: w.lat,
        lng: w.lng
      },
      { headers: { token } }
    );

    setForm({
      wardNo: "",
      ward: "",
      pm25: "",
      pm10: "",
      no2: "",
      so2: "",
      date: ""
    });
    load();
  };

  const filtered = useMemo(() => {
    let list = [...data];
    if (search) {
      list = list.filter(x =>
        x.ward.toLowerCase().includes(search.toLowerCase())
      );
    }
    const now = new Date();
    if (range === "7") list = list.filter(x => new Date(x.date) >= now - 7 * 864e5);
    if (range === "30") list = list.filter(x => new Date(x.date) >= now - 30 * 864e5);
    return list;
  }, [data, search, range]);

  const averages = useMemo(() => {
    const m = {};
    filtered.forEach(x => {
      if (!m[x.ward]) m[x.ward] = { pm25: 0, pm10: 0, no2: 0, c: 0 };
      m[x.ward].pm25 += x.pm25;
      m[x.ward].pm10 += x.pm10;
      m[x.ward].no2 += x.no2;
      m[x.ward].c++;
    });
    return Object.keys(m)
      .map(w => ({
        ward: w,
        pm25: (m[w].pm25 / m[w].c).toFixed(1),
        pm10: (m[w].pm10 / m[w].c).toFixed(1),
        no2: (m[w].no2 / m[w].c).toFixed(1)
      }))
      .sort((a, b) => b.pm25 - a.pm25);
  }, [filtered]);

 const downloadPDF = () => {
  const doc = new jsPDF();

  // 🔹 SORT DATA: latest date first
  const sortedData = [...filtered].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  // PDF Title
  doc.setFontSize(14);
  doc.text("Ward-wise Pollution Report", 14, 15);

  autoTable(doc, {
    startY: 22,
    head: [["Date", "Ward", "PM2.5", "PM10", "NO₂", "SO₂", "AQI"]],
    body: sortedData.map(r => [
      new Date(r.date).toLocaleDateString(),
      r.ward,
      r.pm25,
      r.pm10,
      r.no2,
      r.so2 ?? "-",
      r.aqi
    ]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [41, 128, 185] }
  });

  doc.save("pollution.pdf");
};

  const nav = useNavigate();

const chartOptions = {
  responsive: true,
  plugins: {
    legend: {
      labels: {
        color: "#ffffff",
        font: { size: 13 }
      }
    },
    tooltip: {
      backgroundColor: "#111",
      titleColor: "#fff",
      bodyColor: "#fff"
    }
  },
  scales: {
    x: {
      ticks: { color: "#ccc", font: { size: 12 } },
      grid: { color: "rgba(255,255,255,0.06)" }
    },
    y: {
      ticks: { color: "#ccc", font: { size: 12 } },
      grid: { color: "rgba(255,255,255,0.06)" }
    }
  }
};


  return (
    <div className="app-wrapper">
      <div className="glass animate-fade">
        <h2 className="mera_h2">🌫 Ward-Wise Pollution Dashboard</h2>

        {/* Role switch */}
        <div style={{ display:"flex",padding:'2rem', gap:"2rem", justifyContent:"flex-end", marginBottom:"8px" }}>
          <button
            onClick={() => setRole("govt")}
            // style={{
            //   padding:"2rem 2rem",
            //   borderRadius:"999px",
            //   border:isGovt ? "1px solid #fff" : "1px solid rgba(255,255,255,.3)",
            //   background:isGovt ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.08)",
            //   fontSize:"1.5rem"
            // }}
          >
            Government
          </button>
          <button
            onClick={() => setRole("citizen")}
            // style={{
            //   padding:"2rem 4rem",
            //   borderRadius:"999px",
            //   border:isCitizen ? "1px solid #fff" : "1px solid rgba(255,255,255,.3)",
            //   background:isCitizen ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.08)",
            //   fontSize:"1.5rem"
            // }}
          >
            Citizen
          </button>
          <button
            onClick={() => setRole("researcher")}
            // style={{
            //   padding:"2rem 2rem",
            //   borderRadius:"999px",
            //   border:isResearcher ? "1px solid #fff" : "1px solid rgba(255,255,255,.3)",
            //   background:isResearcher ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.08)",
            //   fontSize:"1.5rem"
            // }}
          >
            Researcher
          </button>
        </div>

        {/* Filters */}
        
        <div className="filters">
          <style> </style>
          <input className="my_search"
            placeholder="🔍 Search Ward"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {(isGovt || isResearcher) && (
            <select value={range} onChange={e => setRange(e.target.value)}>
              <option value="all">All Time</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
            </select>
          )}

          {(isGovt || isResearcher) && (
            <button className="pdf_button" onClick={downloadPDF}>📄 PDF</button>
          )}

          {isGovt && (
            token ? (
              <button className="logout_button" onClick={() => setToken("")}>Logout</button>
            ) : (
              <button className="logout_button" onClick={() => nav("/login")}>Admin</button>
            )
          )}
        </div>

        {/* Govt-only admin tools */}
        {isGovt && token && (
          <button
            style={{ marginBottom: "10px" }}
            type="button"
            onClick={() => fetchLiveForWard(form.ward || "Anand Vihar")}
          >
            ⚡ Use Live Data (OpenAQ)
          </button>
        )}

        {isGovt && token && (
          <form onSubmit={submit} className="glass-form">
            <input
              placeholder="Ward No"
              value={form.wardNo}
              onChange={e => setForm({ ...form, wardNo: e.target.value })}
            />
            <input
              placeholder="Ward Name"
              value={form.ward}
              onChange={e => setForm({ ...form, ward: e.target.value })}
            />
            <input
              placeholder="PM2.5"
              value={form.pm25}
              onChange={e => setForm({ ...form, pm25: e.target.value })}
            />
            <input
              placeholder="PM10"
              value={form.pm10}
              onChange={e => setForm({ ...form, pm10: e.target.value })}
            />
            <input
              placeholder="NO₂"
              value={form.no2}
              onChange={e => setForm({ ...form, no2: e.target.value })}
            />
            <input
              placeholder="SO₂"
              value={form.so2}
              onChange={e => setForm({ ...form, so2: e.target.value })}
            />
            <input
              type="date"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
            />
            <button>Add</button>
          </form>
        )}

        {err && <p style={{ color: "tomato" }}>{err}</p>}
        <div className="dashboard-grid">
  <div className="panel">
    <Line
        options={chartOptions}
          data={{
            labels: filtered.map(r => r.ward),
            datasets: [
              { label: "PM2.5", data: filtered.map(r => r.pm25), borderColor: "#4dabff" },
              { label: "PM10",  data: filtered.map(r => r.pm10), borderColor: "#ff5fa2" },
              { label: "NO₂",   data: filtered.map(r => r.no2),  borderColor: "#ffb74d" },
              { label: "SO₂", data: filtered.map(r => r.so2 || 0), borderColor: "#81c784" }
            ]
          }}
        />
  </div>

  <div className="panel">
    <h3>🗺 Hotspot Map</h3>
    <MapContainer
      center={[28.61, 77.21]}
      zoom={11}
      className="map-box"
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {filtered.map(r =>
        r.lat && (
          <Marker key={r._id} position={[r.lat, r.lng]}>
            <Popup>{r.ward} — AQI {r.aqi}</Popup>
          </Marker>
        )
      )}
    </MapContainer>
  </div>
</div>

        <h3>🏆 Ward Ranking</h3>
        <div className="ward-card-grid">
          {averages.map((a, i) => (
            <div
              key={i}
              className="ward-card link"
              onClick={() => nav(`/ward/${a.ward}`)}
            >
              <div className="ward-card-left">
                <span className="ward-rank">#{i + 1}</span>
                <h4 className="ward-name">{a.ward}</h4>
              </div>
              <div className="ward-card-arrow">➜</div>
            </div>
          ))}
        </div>

        {/* Citizen health advisory */}
        {isCitizen && (
          <div style={{
            marginTop:"16px",
            padding:"12px 16px",
            borderRadius:"16px",
            background:"rgba(255,255,255,.05)",
            border:"1px solid rgba(255,255,255,.12)"
          }}>
            <h3>🩺 Health Advisory</h3>
            <p style={{ fontSize:"14px", opacity:.9 }}>
              High PM2.5 levels? Avoid outdoor running, keep windows closed, and use N95 masks
              during peak hours, especially for children and elderly.
            </p>
          </div>
        )}

        {/* Researcher note */}
        {isResearcher && (
          <div style={{
            marginTop:"16px",
            padding:"12px 16px",
            borderRadius:"16px",
            background:"rgba(255,255,255,.05)",
            border:"1px solid rgba(255,255,255,.12)"
          }}>
            <h3>📊 Data Access</h3>
            <p style={{ fontSize:"14px", opacity:.9 }}>
              Use the PDF export for quick ward-wise reports. Future scope: CSV / API endpoints
              for time-series analysis and integration with Jupyter notebooks.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- APP ---------- */
export default function App() {
const [token, setToken] = useState(
  localStorage.getItem("token") || ""
);
  const [data, setData] = useState([]);

  useEffect(() => {
    axios.get(`${API}/api/readings`).then(r => setData(r.data));
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Dashboard token={token} setToken={setToken} />}
        />
        <Route
          path="/login"
          element={<Login setToken={setToken} />}
        />
        <Route
          path="/ward/:ward"
          element={<WardProfile data={data} token={token} />}
        />
      </Routes>
    </BrowserRouter>
  );
}