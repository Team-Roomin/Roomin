import express from 'express';
import cors from 'cors'
import cookieParser from 'cookie-parser';
import session from './config/Gsession.js';
import passport from './config/Gpassport.js';
const app = express();


// CORS configuration
app.use(cors(
  {
    origin: process.env.CORS_ORIGIN,
    credentials: true
  }
))

// Json Parser configuration
app.use(express.json({
    limit: "16kb"
}))

// URL encoding configuration
app.use(express.urlencoded({
    extended: true,
    limit: "16kb"
}))


// For Static files configuration
app.use(express.static("public"))

// Setting up cookie parser
app.use(cookieParser());

//seting up for Google OAuth
app.use(session)
app.use(passport.initialize());
app.use(passport.session());


// importing Routes
import userRoutes from './routes/user.routes.js'

// Setting the routes
app.use('/v1/users/',userRoutes);


export { app }


