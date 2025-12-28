import {useState,useEffect,useMemo} from "react";
const API = import.meta.env.VITE_API || "http://localhost:5000";
import axios from "axios";
import "./glass.css";
import {Line} from "react-chartjs-2";
import {Chart as ChartJS} from "chart.js/auto";
import {BrowserRouter,Routes,Route,useNavigate,useParams} from "react-router-dom";
import {MapContainer,TileLayer,Marker,Popup} from "react-leaflet";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import delhiWards from "./delhiWards";

/* ---------- LOGIN ---------- */
function Login({setToken}){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const nav=useNavigate();

  const login=async e=>{
    e.preventDefault();
    const r=await axios.post(`${API}/api/login`,{email,password});
    setToken(r.data.token);
    nav("/");
  };

  return(
    <div className="main">
      <div className="bg">
        <div className="glass animate-fade small">
          <h2>Admin Login</h2>
          <form onSubmit={login} className="glass-form-2">
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"/>
            <input value={password} type="password" onChange={e=>setPassword(e.target.value)} placeholder="Password"/>
            <button>Login</button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ---------- WARD PROFILE ---------- */
function WardProfile({data}){
  const {ward}=useParams();
  const list=data.filter(x=>x.ward===ward);
  const navWard=delhiWards.find(w=>w.name===ward);

  return(
    <div className="bg">
      <div className="glass animate-fade">
        <h2>{ward} — History</h2>

        <button onClick={()=>window.open(
          `https://www.google.com/maps/dir/?api=1&destination=${navWard?.lat},${navWard?.lng}`
        )}>Visit Ward</button>

        <Line data={{
          labels:list.map(r=>new Date(r.date).toLocaleDateString()),
          datasets:[
            {label:"PM2.5",data:list.map(r=>r.pm25),borderColor:"#4dabff"},
            {label:"PM10",data:list.map(r=>r.pm10),borderColor:"#ff5fa2"},
            {label:"NO₂",data:list.map(r=>r.no2),borderColor:"#ffb74d"}
          ]
        }}/>

        <table className="glass-table">
          <thead>
            <tr><th>Date</th><th>PM2.5</th><th>PM10</th><th>NO₂</th><th>AQI</th></tr>
          </thead>
          <tbody>
            {list.map(r=>(
              <tr key={r._id}>
                <td>{new Date(r.date).toDateString()}</td>
                <td>{r.pm25}</td><td>{r.pm10}</td><td>{r.no2}</td><td>{r.aqi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- DASHBOARD ---------- */
function Dashboard({token,setToken}){
  const [data,setData]=useState([]);
  const [search,setSearch]=useState("");
  const [range,setRange]=useState("all");
  const [err,setErr]=useState("");

  const [form,setForm]=useState({wardNo:"",ward:"",pm25:"",pm10:"",no2:"",date:""});

  const load=async()=>setData((await axios.get(`${import.meta.env.VITE_API}/api/readings`)).data);
  useEffect(()=>{load();},[]);

  const submit=async e=>{
    e.preventDefault();
    setErr("");

    const w=delhiWards.find(x=>x.no==form.wardNo || x.name.toLowerCase()===form.ward.toLowerCase());
    if(!w){setErr("❌ Invalid Ward Number / Name");return;}

    await axios.post(`${API}/api/readings`,{
      wardNo:w.no,
      ward:w.name,
      pm25:+form.pm25,
      pm10:+form.pm10,
      no2:+form.no2,
      date:form.date,
      lat:w.lat,
      lng:w.lng
    },{headers:{token}});

    setForm({wardNo:"",ward:"",pm25:"",pm10:"",no2:"",date:""});
    load();
  };

  const filtered=useMemo(()=>{
    let list=[...data];
    if(search) list=list.filter(x=>x.ward.toLowerCase().includes(search.toLowerCase()));
    const now=new Date();
    if(range==="7") list=list.filter(x=>new Date(x.date)>=now-7*864e5);
    if(range==="30") list=list.filter(x=>new Date(x.date)>=now-30*864e5);
    return list;
  },[data,search,range]);

  const averages=useMemo(()=>{
    const m={};
    filtered.forEach(x=>{
      if(!m[x.ward]) m[x.ward]={pm25:0,pm10:0,no2:0,c:0};
      m[x.ward].pm25+=x.pm25;m[x.ward].pm10+=x.pm10;m[x.ward].no2+=x.no2;m[x.ward].c++;
    });
    return Object.keys(m).map(w=>({
      ward:w,
      pm25:(m[w].pm25/m[w].c).toFixed(1),
      pm10:(m[w].pm10/m[w].c).toFixed(1),
      no2:(m[w].no2/m[w].c).toFixed(1)
    })).sort((a,b)=>b.pm25-a.pm25);
  },[filtered]);

  const downloadPDF=()=>{
    const doc = new jsPDF();
autoTable(doc,{
  head:[["Ward","PM2.5","PM10","NO₂","AQI"]],
  body:filtered.map(r=>[r.ward,r.pm25,r.pm10,r.no2,r.aqi])
});
doc.save("pollution.pdf");
  };

  const nav=useNavigate();

  return(
    <div className="bg">
      <div className="glass animate-fade">

        <h2>🌫 Ward-Wise Pollution Dashboard</h2>

        <div className="filters">
          <input placeholder="🔍 Search Ward" value={search} onChange={e=>setSearch(e.target.value)}/>
          <select value={range} onChange={e=>setRange(e.target.value)}>
            <option value="all">All Time</option>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
          </select>
          <button onClick={()=>downloadPDF()}>📄 PDF</button>
          {token ? <button onClick={()=>setToken("")}>Logout</button> : <button onClick={()=>nav("/login")}>Admin</button>}
        </div>

        {token &&
          <form onSubmit={submit} className="glass-form">
            <input placeholder="Ward No" value={form.wardNo} onChange={e=>setForm({...form,wardNo:e.target.value})}/>
            <input placeholder="Ward Name" value={form.ward} onChange={e=>setForm({...form,ward:e.target.value})}/>
            <input placeholder="PM2.5" value={form.pm25} onChange={e=>setForm({...form,pm25:e.target.value})}/>
            <input placeholder="PM10" value={form.pm10} onChange={e=>setForm({...form,pm10:e.target.value})}/>
            <input placeholder="NO₂" value={form.no2} onChange={e=>setForm({...form,no2:e.target.value})}/>
            <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
            <button>Add</button>
          </form>
        }

        {err && <p style={{color:"tomato"}}>{err}</p>}

        <Line data={{
          labels:filtered.map(r=>r.ward),
          datasets:[
            {label:"PM2.5",data:filtered.map(r=>r.pm25),borderColor:"#4dabff"},
            {label:"PM10",data:filtered.map(r=>r.pm10),borderColor:"#ff5fa2"},
            {label:"NO₂",data:filtered.map(r=>r.no2),borderColor:"#ffb74d"}
          ]
        }}/>

        <h3>🗺 Hotspot Map</h3>
        <MapContainer center={[28.61,77.21]} zoom={11} style={{height:"320px",borderRadius:"20px"}}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
          {filtered.map(r=>(
            r.lat && <Marker key={r._id} position={[r.lat,r.lng]}>
              <Popup>{r.ward} — AQI {r.aqi}</Popup>
            </Marker>
          ))}
        </MapContainer>

        <h3>🏆 Ward Ranking</h3>
        <table className="glass-table">
          <thead><tr><th>#</th><th>Ward</th><th>PM2.5</th><th>PM10</th><th>NO₂</th></tr></thead>
          <tbody>
            {averages.map((a,i)=>(
              <tr key={i} onClick={()=>nav(`/ward/${a.ward}`)} className="link">
                <td>{i+1}</td><td>{a.ward}</td><td>{a.pm25}</td><td>{a.pm10}</td><td>{a.no2}</td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>
    </div>
  );
}

/* ---------- APP ---------- */
export default function App(){
  const [token,setToken]=useState("");
  const [data,setData]=useState([]);

  useEffect(()=>{
    axios.get(`${API}/api/readings`).then(r=>setData(r.data));
  },[]);

  return(
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard token={token} setToken={setToken}/>}/>
        <Route path="/login" element={<Login setToken={setToken}/>}/>
        <Route path="/ward/:ward" element={<WardProfile data={data}/>}/>
      </Routes>
    </BrowserRouter>
  );
}
