import mongoose, { Schema } from "mongoose";

const bookmarksSchema = new Schema({
    _id: ObjectId,
    userId: ObjectId, // who bookmarked
    propertyId: ObjectId, // what property
    notes: String, // personal notes
    createdAt: Date
});

db.bookmarks.createIndex({ userId: 1, propertyId: 1 }, { unique: true });
db.bookmarks.createIndex({ userId: 1, createdAt: -1 });