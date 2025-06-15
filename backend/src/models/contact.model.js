import mongoose, { Schema } from "mongoose";

const contactSchema = new Schema({
    _id: ObjectId,
    propertyId: ObjectId,
    inquirerUserId: ObjectId, // who's asking
    ownerUserId: ObjectId, // who owns the property
    
    message: String,
    contactInfo: {
        phone: String,
        email: String,
        preferredTime: String
    },
    
    status: String, // "new", "replied", "closed"
    response: String, // owner's response
    
    createdAt: Date,
    respondedAt: Date
});

db.contact.createIndex({ propertyId: 1, createdAt: -1 });
db.contact.createIndex({ ownerUserId: 1, status: 1 });
db.contact.createIndex({ inquirerUserId: 1 });