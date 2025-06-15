import mongoose, { Schema } from "mongoose";




const propertiesSchema  = new Schema({
    _id: ObjectId,
    adId: String, // custom format like "RR2024001" - unique & user-friendly
    ownerId: ObjectId, // ref to users collection
    
    // Basic Property Info
    purpose: String, // enum: "residential_property", "commercial_property", "property_on_sale"
    type: String, // enum: "single_room", "two_rooms", "1bhk", "2bhk", "3bhk", "flat", "house", "bungalow", "apartment", "residential_land"
    status: String, // enum: "available", "sold", "rented", "under_review"
    
    // Pricing 💰
    price: {
        amount: Number,
        currency: String, // default "INR"
        isNegotiable: Boolean,
        securityDeposit: Number, // for rentals
        maintenanceCharges: Number,
        pricePerSqFt: Number // for land/sale properties
    },
    
    // Property Details
    details: {
        floor: String, // "ground_floor", "1st_floor", "2nd_floor", etc.
        totalFloors: Number,
        area: {
            builtUp: Number, // in sq ft
            carpet: Number,
            plot: Number // for houses/bungalows
        },
        furnishing: String, // "unfurnished", "semi_furnished", "fully_furnished"
        ageOfProperty: Number, // in years
        facing: String, // "north", "south", "east", "west"
        balconies: Number,
        bathrooms: Number,
        bedrooms: Number
    },
    
    // Amenities & Features ✨
    amenities: {
        parking: {
            bike: Boolean,
            car: Boolean,
            spots: Number
        },
        runningWater: Boolean,
        electricity: Boolean,
        wifi: Boolean,
        gym: Boolean,
        elevator: Boolean,
        security: Boolean,
        garden: Boolean,
        powerBackup: Boolean,
        airConditioning: Boolean,
        modularKitchen: Boolean,
        nearbyMetro: Boolean,
        petFriendly: Boolean
    },
    
    // Location Data 📍
    location: {
        address: {
            street: String,
            area: String,
            city: String,
            state: String,
            country: String,
            pincode: String,
            landmark: String
        },
        coordinates: {
            type: "Point",
            coordinates: [Number, Number] // [longitude, latitude]
        },
        // Nearby places for better search
        nearbyPlaces: [{
            name: String,
            type: String, // "school", "hospital", "mall", "metro"
            distance: Number // in km
        }]
    },
    
    // Media & Content 📸
    media: {
        photos: [{
            url: String,
            caption: String,
            isPrimary: Boolean, // for thumbnail
            uploadedAt: Date
        }],
        videos: [{
            url: String,
            thumbnail: String,
            duration: Number // in seconds
        }],
        virtualTour: String // 360° tour URL
    },
    
    // Description & Marketing
    title: String,
    description: String,
    highlights: [String], // key selling points
    rules: [String], // house rules for tenants
    
    // Analytics & Tracking 📊
    views: {
        total: Number,
        unique: Number,
        daily: [{
            date: Date,
            count: Number
        }]
    },
    
    // Interested users (for lead management)
    interestedUsers: [{
        userId: ObjectId,
        contactedAt: Date,
        status: String // "interested", "visited", "applied", "rejected"
    }],
    
    // Dates & Status
    availability: {
        availableFrom: Date,
        leaseDuration: Number, // in months
        moveInFlexibility: String // "immediate", "within_week", "within_month"
    },
    
    // Admin stuff
    isActive: Boolean,
    isFeatured: Boolean, // for premium listings
    isVerified: Boolean,
    moderationStatus: String, // "pending", "approved", "rejected"
    rejectionReason: String,
    
    // Timestamps
    postedDate: Date,
    expiryDate: Date,
    createdAt: Date,
    updatedAt: Date
});

// Indexes for Properties (this is where the magic happens! ⚡)
db.properties.createIndex({ adId: 1 }, { unique: true });
db.properties.createIndex({ ownerId: 1 });
db.properties.createIndex({ purpose: 1, type: 1, status: 1 }); // compound for filters
db.properties.createIndex({ "price.amount": 1 });
db.properties.createIndex({ "location.coordinates": "2dsphere" }); // geo queries
db.properties.createIndex({ "location.address.city": 1, "location.address.area": 1 });
db.properties.createIndex({ isActive: 1, moderationStatus: 1 });
db.properties.createIndex({ postedDate: -1 }); // latest first
db.properties.createIndex({ "views.total": -1 }); // popular first
db.properties.createIndex({ isFeatured: 1, postedDate: -1 }); // featured listings

// Text search index for descriptions, titles, etc.
db.properties.createIndex({
    title: "text",
    description: "text",
    "location.address.area": "text",
    "location.address.city": "text"
});
