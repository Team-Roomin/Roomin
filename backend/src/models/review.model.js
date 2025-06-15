const reviewsSchema = {
    _id: ObjectId,
    propertyId: ObjectId,
    reviewerId: ObjectId,
    
    rating: Number, // 1-5 stars
    title: String,
    review: String,
    photos: [String], // review photos
    
    // What they're rating
    ratings: {
        location: Number,
        value: Number,
        condition: Number,
        landlord: Number
    },
    
    isVerified: Boolean, // verified stay/visit
    
    // Responses
    ownerResponse: {
        message: String,
        respondedAt: Date
    },
    
    createdAt: Date,
    updatedAt: Date
};

db.reviews.createIndex({ propertyId: 1, createdAt: -1 });
db.reviews.createIndex({ reviewerId: 1 });
