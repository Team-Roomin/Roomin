import mongoose, { Schema } from "mongoose";
// import bcrypt from 'bcrypt';
// import jwt from 'jsonwebtoken';
import {generateRefreshToken, generateAccessToken,isPasswordCorrect,preSaveMiddleware,isOTPValid,isValidToken} from '../utils/ModelMethods.js'

const userSchema = new Schema(
    {
        username:{
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        dob:{
            type: String,
            required: true,
        
        },
        phoneNo: {
            type: String,
            required: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        fullName: {
            type: String,
            required: true,
            trim:true,
            index: true,
        },
        profileImage:{
            type: String, //Cloudinary Url
            default: "profile"

        },
        coverImage:{
            type: String, //Cloudinary Url
            default: "Cover"
        },
        
        password:{
            type: String,
            required: [true,'Password is required'] 
        },
        refreshToken:{
            type: String,
        }
        ,
        role:{
            type:String,
            enum:["User","Admin"],
            default: "User"
        },
        verified:{
            type:Boolean,
            default: false
        },
        otp: {
            type: String,
        },
        otpTimestamp:{
            type: Date,
        },
        token:{
            type:String,
        },
        tokenTimestamp:{
            type: Date,
        },
        
    
    },
    {
        timeseries: true,
    }
)

userSchema.pre("save",preSaveMiddleware);
userSchema.methods.isPasswordCorrect = isPasswordCorrect;
userSchema.methods.generateAccessToken = generateAccessToken;
userSchema.methods.generateRefreshToken = generateRefreshToken;
userSchema.methods.isOTPValid = isOTPValid;
userSchema.methods.isValidToken = isValidToken;


const User = mongoose.model('User',userSchema);
export default User



const usersSchema = {
    _id: ObjectId, // MongoDB auto-generated
    email: String, // unique identifier
    username: String, // unique, for @mentions vibes
    password: String, // hashed with bcrypt ofc 🔐
    fullName: String,
    phoneNumber: String,
    avatar: String, // profile pic URL
    role: String, // enum: "normal_user", "property_owner", "admin"
    
    // Profile info
    bio: String,
    location: {
        city: String,
        state: String,
        country: String,
        coordinates: {
            type: "Point",
            coordinates: [Number, Number] // [longitude, latitude]
        }
    },
    
    // User stats & activity
    memberSince: Date,
    lastActive: Date,
    isVerified: Boolean, // for trust factor ✅
    verificationDocuments: [{
        type: String, // "aadhar", "pan", "driving_license"
        documentUrl: String,
        isVerified: Boolean
    }],
    
    // Preferences for better UX
    preferences: {
        budget: {
            min: Number,
            max: Number
        },
        preferredLocations: [String],
        notifications: {
            email: Boolean,
            sms: Boolean,
            push: Boolean
        }
    },
    
    // Timestamps
    createdAt: Date,
    updatedAt: Date
};

// Index suggestions for Users
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.users.createIndex({ "location.coordinates": "2dsphere" }); // for geo queries