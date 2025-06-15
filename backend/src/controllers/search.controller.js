const Property = require('../models/Property');
const User = require('../models/User');
const Bookmark = require('../models/Bookmark');
const Inquiry = require('../models/Inquiry');
const Review = require('../models/Review');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');


class SearchController {
    
    // GET /api/search - Advanced search with NLP 🤖
    static async advancedSearch(req, res) {
        try {
            const { q, ...filters } = req.query;
            
            let searchPipeline = [];

            // Text search if query provided
            if (q) {
                searchPipeline.push({
                    $match: {
                        $text: { $search: q },
                        isActive: true,
                        moderationStatus: 'approved'
                    }
                });
                // Add text score for relevance
                searchPipeline.push({
                    $addFields: { 
                        textScore: { $meta: "textScore" } 
                    }
                });
            } else {
                searchPipeline.push({
                    $match: { 
                        isActive: true, 
                        moderationStatus: 'approved' 
                    }
                });
            }

            // Apply additional filters
            const filterMatch = {};
            Object.keys(filters).forEach(key => {
                if (filters[key] && key !== 'page' && key !== 'limit') {
                    filterMatch[key] = filters[key];
                }
            });

            if (Object.keys(filterMatch).length > 0) {
                searchPipeline.push({ $match: filterMatch });
            }

            // Populate owner info
            searchPipeline.push({
                $lookup: {
                    from: 'users',
                    localField: 'ownerId',
                    foreignField: '_id',
                    as: 'owner',
                    pipeline: [
                        { $project: { fullName: 1, avatar: 1, isVerified: 1 } }
                    ]
                }
            });

            // Sort by relevance if text search, otherwise by date
            if (q) {
                searchPipeline.push({ $sort: { textScore: -1, postedDate: -1 } });
            } else {
                searchPipeline.push({ $sort: { postedDate: -1 } });
            }

            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;

            searchPipeline.push({ $skip: skip }, { $limit: limit });

            const results = await Property.aggregate(searchPipeline);

            res.json({
                success: true,
                data: {
                    results,
                    query: q,
                    filters,
                    count: results.length
                }
            });

        } catch (error) {
            console.error('Advanced search error:', error);
            res.status(500).json({
                success: false,
                message: 'Search failed',
                error: error.message
            });
        }
    }

    // GET /api/properties/nearby - Geo search 📍
    static async nearbyProperties(req, res) {
        try {
            const { lat, lng, radius = 5000 } = req.query; // radius in meters

            if (!lat || !lng) {
                return res.status(400).json({
                    success: false,
                    message: 'Latitude and longitude are required'
                });
            }

            const properties = await Property.find({
                'location.coordinates': {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [parseFloat(lng), parseFloat(lat)]
                        },
                        $maxDistance: parseInt(radius)
                    }
                },
                isActive: true,
                moderationStatus: 'approved',
                status: 'available'
            })
            .populate('ownerId', 'fullName avatar isVerified')
            .limit(50)
            .lean();

            res.json({
                success: true,
                data: {
                    properties,
                    center: { lat: parseFloat(lat), lng: parseFloat(lng) },
                    radius: parseInt(radius)
                }
            });

        } catch (error) {
            console.error('Nearby search error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to find nearby properties',
                error: error.message
            });
        }
    }

    // GET /api/properties/featured - Featured listings ⭐
    static async getFeaturedProperties(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;

            const properties = await Property.find({
                isFeatured: true,
                isActive: true,
                moderationStatus: 'approved',
                status: 'available'
            })
            .populate('ownerId', 'fullName avatar isVerified')
            .sort({ postedDate: -1 })
            .limit(limit)
            .lean();

            res.json({
                success: true,
                data: properties
            });

        } catch (error) {
            console.error('Featured properties error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch featured properties',
                error: error.message
            });
        }
    }

    // GET /api/properties/trending - Most viewed properties 🔥
    static async getTrendingProperties(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const days = parseInt(req.query.days) || 7;

            const dateFilter = new Date();
            dateFilter.setDate(dateFilter.getDate() - days);

            const properties = await Property.find({
                isActive: true,
                moderationStatus: 'approved',
                status: 'available',
                postedDate: { $gte: dateFilter }
            })
            .populate('ownerId', 'fullName avatar isVerified')
            .sort({ 'views.total': -1 })
            .limit(limit)
            .lean();

            res.json({
                success: true,
                data: properties,
                period: `${days} days`
            });

        } catch (error) {
            console.error('Trending properties error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch trending properties',
                error: error.message
            });
        }
    }
}



module.exports = {
    SearchController,
};