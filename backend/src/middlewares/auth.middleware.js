import User from '../models/user.model.js'
import {CustomError} from '../utils/ApiError.js'
import { asyncHandler } from "../utils/asyncHandler.js";
import {validateGoogleAccessTokenDetailed , refreshAccessToken} from '../utils/Gtokens.js'
import jwt from "jsonwebtoken"
import users from '../models/user.cache.model.js';
//import passport from '../config/Gpassport.js';
import passport from 'passport';
export const authMiddleware = asyncHandler(async(req,res,next)=>{
   try {
    try{
     const  accessToken = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","");
     console.log(accessToken)
     if(!accessToken){
         throw new CustomError(401,"Unauthorized request");
     }
 
     const decodedToken = jwt.verify(accessToken,process.env.ACCESS_TOKEN_SECRET);
     
     const user = await  User.findById(decodedToken?._id).select("-password -refreshToken");
 
     if(!user){
         throw new CustomError(401,"Invalid access token");
     }
 
     req.user = user;
     next()
    }
    
    catch (err) {
       if (!req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized request" });
        const user = users.get(req.user.id);
       if (!user) return res.status(401).send('User not found. Please log in again.');
        const result=await validateGoogleAccessTokenDetailed(req.cookies.accessToken);
       if (!result.valid && result.reason === 'expired') {
        const newAccessToken = await refreshAccessToken(user);
       if (!newAccessToken) return res.status(401).send('Could not refresh access token. Please log in again.');
            res.cookie('accessToken', newAccessToken, {
              httpOnly: false,
              secure: false,
              sameSite: 'Strict',
              path: '/'
            });
         req.user = user;
         next()
     }
       if (!result.valid && result.reason === 'invalid') {
        return res.status(401).send('Invalid access token');
     }

    }
    } catch (error) {
      throw new CustomError(401,error?.message || "Invalid access token")
     }

 })