import validator from "validator";
import bcrypt from "bcrypt";
import userModel from "../models/userModel.js";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import Stripe from "stripe"
import razorpay from "razorpay"
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.json({ success: false, message: "Missing details" });
    }
    if (!validator.isEmail(email)) {
      return res.json({ success: false, message: "Missing details" });
    }
    //validationg strong password
    if (password.length < 8) {
      return res.json({ success: false, message: "Enter a strong password" });
    }
    //hashing user password
    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(password, salt);
    const userData = {
      name,
      email,
      password: hashedPass,
    };
    const newUser = new userModel(userData);
    const user = await newUser.save();
    //_id
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ success: true, token });
  } catch (error) {
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
};
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.json({ success: false, message: "User not Found" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (isMatch) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
      res.json({ success: true, token });
    } else {
      res.json({ success: false, message: "invalid credentials" });
    }
  } catch (error) {
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
};
//api to get iser profile data
const getProfile = async (req, res) => {
  try {
    const { userId } = req.body;
    const userData = await userModel.findById(userId).select("-password");
    res.json({ success: true, userData });
  } catch (error) {
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
};
//api to update user profile
const updateProfile = async (req, res) => {
  try {
    const { userId, name, phone, address, dob, gender } = req.body;
    const imageFile = req.file;
    if (!name || !phone || !dob || !gender) {
      return res.json({ success: false, message: "Data Missing" });
    }
    await userModel.findByIdAndUpdate(userId, {
      name,
      phone,
      address: JSON.parse(address),
      dob,
      gender,
    });
    if (imageFile) {
      //upload image to cloudinary
      const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
        resource_type: "image",
      });
      const imageUrl = imageUpload.secure_url;
      await userModel.findByIdAndUpdate(userId, { image: imageUrl });
    }
    res.json({ success: true, message: "Profile Updated" });
  } catch (error) {
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
};
////API TO BOOK APOINTMENT'
const bookAppointment = async (req, res) => {
  try {
    const { userId, docId, slotDate, slotTime } = req.body;
    const doctorData = await doctorModel.findById(docId).select("-password");
    if (!doctorData.available) {
      return res.json({ success: false, message: "Doctor not available" });
    }
    
    let slots_booked = doctorData.slots_booked;
    
    // Checking for slot availability
    if (!slots_booked[slotDate]) {
      slots_booked[slotDate] = [];
    }
    
    if (slots_booked[slotDate].includes(slotTime)) {
      return res.json({ success: false, message: "Slot not available" });
    } else {
      slots_booked[slotDate].push(slotTime);
    }
    
    const userData = await userModel.findById(userId).select("-password");
    
    // Create appointment data, ensuring correct field names
    const appointmentData = {
      userId,
      docId,
      userData,
      doctorData, // Ensure this matches the schema
      amount: doctorData.fee,
      slotTime,
      slotDate,
      date: Date.now(),
    };
    
    const newAppointment = new appointmentModel(appointmentData);
    await newAppointment.save();
    
    // Save updated slots
    await doctorModel.findByIdAndUpdate(docId, { slots_booked });
    
    res.json({ success: true, message: "Appointment Booked" });
    
  } catch (error) {
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
};
//api to get user appointments for frontend my-appointment page
const listAppointment=async (req,res) => {
  try {
    const{userId}=req.body;
    const appointments=await appointmentModel.find({userId});
     res.json({success:true,appointments});
  } catch (error) {
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
}
//API to cancel appointment
const cancelAppointment=async (req,res) => {
  
  try {
  const {userId,appointmentId}=req.body;
  const appointmentData=await appointmentModel.findById(appointmentId);
  if(appointmentData.userId!=userId){
return res.json({success:false,message:"Unauthorized action"});
  }  
  await appointmentModel.findByIdAndUpdate(appointmentId,{cancelled:true});
  //releasing doctors slot
  const {docId,slotDate,slotTime}=appointmentData;
  const doctorData=await doctorModel.findById(docId);
  let slots_booked=doctorData.slots_booked;
  slots_booked[slotDate]=slots_booked[slotDate].filter(e=>e!==slotTime)
  await doctorModel.findByIdAndUpdate(docId,{slots_booked});
  res.json({success:true,message:"Appointment Cancelled"});
  } catch (error) {
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
}
//api for payment gateway

const paymentRayzorPay=async (req,res) => {
  try {
    const {appointmentId}=req.body;
    const appointmentData=await appointmentModel.findById(appointmentId);
    if(!appointmentData || appointmentData.cancelled){
      return res.json({success:false,message:"Appointment is cancelled or Not Found"})
    }
  //creating options for razor pay 
  const options={
    amount:appointmentData.amount*100,
    currency:process.env.CURRENCY,
    receipt:appointmentId,
  }
  //creation of an Order
  const order=await stripe.checkout.sessions.create(
    options
  )
  res.json({success:true,order})
  } catch (error) {
    console.error(error.message);
    res.json({ success: false, message: error.message });
  }
 
}
export { registerUser, loginUser, getProfile, updateProfile, bookAppointment,listAppointment,cancelAppointment,paymentRayzorPay};
