import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

dotenv.config();
const app = express();
app.use(cors({
  origin: "https://pollution-dashboard-azure.vercel.app",
  methods: ["GET","POST"],
  allowedHeaders: ["Content-Type","token"],
  credentials: true
}));

app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(()=>console.log("Mongo Connected"))
  .catch(err=>console.log(err));

function getAQICategory(aqi){
  if(aqi<=50) return "Good";
  if(aqi<=100) return "Satisfactory";
  if(aqi<=200) return "Moderate";
  if(aqi<=300) return "Poor";
  if(aqi<=400) return "Very Poor";
  return "Severe";
}
function calcAQI(pm25,pm10,no2){
  const aqi = Math.max(pm25,pm10,no2);
  return {aqi,category:getAQICategory(aqi)};
}

const mail = nodemailer.createTransport({
  service:"gmail",
  auth:{user:process.env.ALERT_EMAIL,pass:process.env.ALERT_PASS}
});
function sendAlert(ward,aqi){
  if(aqi<300) return;
  mail.sendMail({
    to:process.env.ALERT_TO,
    subject:`AQI Alert — ${ward}`,
    text:`AQI is ${aqi}`
  }).catch(()=>{});
}

const PollutionSchema = new mongoose.Schema({
  wardNo:Number,
  ward:String,
  pm25:Number,
  pm10:Number,
  no2:Number,
  aqi:Number,
  category:String,
  lat:Number,
  lng:Number,
  date:{type:Date,default:Date.now},
  createdAt:{type:Date,default:Date.now}
});
const Pollution = mongoose.model("Pollution",PollutionSchema);

const UserSchema = new mongoose.Schema({
  email:String,
  password:String
});
const User = mongoose.model("User",UserSchema);

function auth(req,res,next){
  try{
    jwt.verify(req.headers.token,process.env.JWT_SECRET||"SECRET");
    next();
  }catch{
    res.status(401).json("Unauthorized");
  }
}

/* register admin once */
app.post("/api/register",async(req,res)=>{
  const hash = await bcrypt.hash(req.body.password,10);
  res.json(await User.create({email:req.body.email,password:hash}));
});

app.post("/api/login",async(req,res)=>{
  const u = await User.findOne({email:req.body.email});
  if(!u) return res.status(400).json("User not found");
  const ok = await bcrypt.compare(req.body.password,u.password);
  if(!ok) return res.status(400).json("Wrong password");
  const token = jwt.sign({id:u._id},process.env.JWT_SECRET||"SECRET");
  res.json({token});
});

app.get("/api/readings",async(req,res)=>{
  res.json(await Pollution.find().sort({createdAt:-1}));
});

app.post("/api/readings",auth,async(req,res)=>{
  const {aqi,category}=calcAQI(req.body.pm25,req.body.pm10,req.body.no2);
  const d = await Pollution.create({...req.body,aqi,category});
  sendAlert(d.ward,aqi);
  res.json(d);
});

app.listen(process.env.PORT || 5000, () =>
  console.log("Server running")
);
