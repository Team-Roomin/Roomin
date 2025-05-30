import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import passport from 'passport';
import users from '../models/user.cache.model.js';

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => done(null, users.get(id) || null));

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL,
}, (accessToken, refreshToken, profile, done) => {
  const user = { 
    id: profile.id,
    displayName: profile.displayName,
    accessToken,
    refreshToken
  };
  users.set(profile.id, user);
  done(null, user);
}));

export {passport};