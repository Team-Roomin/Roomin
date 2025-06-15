const Property = require('../models/Property');
const Bookmark = require('../models/Bookmark');
const Inquiry = require('../models/Inquiry');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');


class PropertyController {
    
    // GET /api/properties - Main search with filters 🔍
    static async getAllProperties(req, res) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                purpose, 
                type, 
                minPrice, 
                maxPrice, 
                city, 
                area,
                bedrooms,
                furnishing,
                parking,
                runningWater,
                sortBy = 'latest' 
            } = req.query;

            // Build filter object dynamically 🎯
            const filters = { 
                isActive: true, 
                moderationStatus: 'approved',
                status: 'available'
            };

            if (purpose) filters.purpose = purpose;
            if (type) filters.type = type;
            if (city) filters['location.address.city'] = new RegExp(city, 'i');
            if (area) filters['location.address.area'] = new RegExp(area, 'i');
            if (bedrooms) filters['details.bedrooms'] = parseInt(bedrooms);
            if (furnishing) filters['details.furnishing'] = furnishing;
            if (parking === 'bike') filters['amenities.parking.bike'] = true;
            if (parking === 'car') filters['amenities.parking.car'] = true;
            if (runningWater === 'true') filters['amenities.runningWater'] = true;

            // Price range filter 💰
            if (minPrice || maxPrice) {
                filters['price.amount'] = {};
                if (minPrice) filters['price.amount'].$gte = parseInt(minPrice);
                if (maxPrice) filters['price.amount'].$lte = parseInt(maxPrice);
            }

            // Sort options 📊
            let sortOptions = {};
            switch (sortBy) {
                case 'latest':
                    sortOptions = { postedDate: -1 };
                    break;
                case 'price_low':
                    sortOptions = { 'price.amount': 1 };
                    break;
                case 'price_high':
                    sortOptions = { 'price.amount': -1 };
                    break;
                case 'popular':
                    sortOptions = { 'views.total': -1 };
                    break;
                case 'featured':
                    sortOptions = { isFeatured: -1, postedDate: -1 };
                    break;
                default:
                    sortOptions = { postedDate: -1 };
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [properties, totalCount] = await Promise.all([
                Property.find(filters)
                    .populate('ownerId', 'fullName avatar isVerified memberSince phoneNumber')
                    .sort(sortOptions)
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                Property.countDocuments(filters)
            ]);

            const totalPages = Math.ceil(totalCount / parseInt(limit));

            res.json({
                success: true,
                data: {
                    properties,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages,
                        totalCount,
                        hasNext: parseInt(page) < totalPages,
                        hasPrev: parseInt(page) > 1
                    },
                    filters: req.query
                }
            });

        } catch (error) {
            console.error('Get properties error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch properties',
                error: error.message
            });
        }
    }

    // GET /api/properties/:id - Get single property 🏘️
    static async getPropertyById(req, res) {
        try {
            const { id } = req.params;
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid property ID'
                });
            }

            const property = await Property.findById(id)
                .populate('ownerId', 'fullName avatar isVerified memberSince phoneNumber email')
                .lean();

            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'Property not found'
                });
            }

            // Get related properties (same area/type) 🏠
            const relatedProperties = await Property.find({
                _id: { $ne: id },
                $or: [
                    { 'location.address.area': property.location.address.area },
                    { type: property.type }
                ],
                isActive: true,
                moderationStatus: 'approved',
                status: 'available'
            })
            .populate('ownerId', 'fullName avatar isVerified')
            .limit(4)
            .lean();

            res.json({
                success: true,
                data: {
                    property,
                    relatedProperties
                }
            });

        } catch (error) {
            console.error('Get property error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch property',
                error: error.message
            });
        }
    }

    // POST /api/properties - Create new listing (owners only) ✨
    static async createProperty(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            // Check if user is owner or admin
            if (req.user.role !== 'property_owner' && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Only property owners can create listings'
                });
            }

            // Generate unique AD ID 🆔
            const adId = await PropertyController.generateAdId();

            const propertyData = {
                ...req.body,
                ownerId: req.user._id,
                adId,
                views: { total: 0, unique: 0, daily: [] },
                interestedUsers: [],
                isActive: true,
                moderationStatus: 'pending',
                postedDate: new Date(),
                expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const property = new Property(propertyData);
            await property.save();

            await property.populate('ownerId', 'fullName avatar isVerified');

            res.status(201).json({
                success: true,
                message: 'Property listed successfully! Pending admin approval.',
                data: property
            });

        } catch (error) {
            console.error('Create property error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create property listing',
                error: error.message
            });
        }
    }

    // PUT /api/properties/:id - Update listing (owner only) 📝
    static async updateProperty(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const property = await Property.findById(id);
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'Property not found'
                });
            }

            // Check ownership or admin
            if (property.ownerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'You can only update your own properties'
                });
            }

            // Update property
            updates.updatedAt = new Date();
            if (req.user.role !== 'admin') {
                updates.moderationStatus = 'pending'; // Re-review after updates
            }

            const updatedProperty = await Property.findByIdAndUpdate(
                id,
                { $set: updates },
                { new: true, runValidators: true }
            ).populate('ownerId', 'fullName avatar isVerified');

            res.json({
                success: true,
                message: 'Property updated successfully',
                data: updatedProperty
            });

        } catch (error) {
            console.error('Update property error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update property',
                error: error.message
            });
        }
    }

    // DELETE /api/properties/:id - Delete listing 🗑️
    static async deleteProperty(req, res) {
        try {
            const { id } = req.params;

            const property = await Property.findById(id);
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'Property not found'
                });
            }

            // Check ownership or admin
            if (property.ownerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'You can only delete your own properties'
                });
            }

            // Soft delete (deactivate)
            await Property.findByIdAndUpdate(id, { 
                isActive: false, 
                updatedAt: new Date() 
            });

            // Clean up related data
            await Promise.all([
                Bookmark.deleteMany({ propertyId: id }),
                Inquiry.updateMany(
                    { propertyId: id }, 
                    { status: 'closed' }
                )
            ]);

            res.json({
                success: true,
                message: 'Property deleted successfully'
            });

        } catch (error) {
            console.error('Delete property error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete property',
                error: error.message
            });
        }
    }

    // POST /api/properties/:id/view - Increment view count 👀
    static async incrementView(req, res) {
        try {
            const { id } = req.params;
            const userIp = req.ip || req.connection.remoteAddress;
            const today = new Date().toISOString().split('T')[0];

            await Property.findByIdAndUpdate(id, {
                $inc: { 'views.total': 1 },
                $push: {
                    'views.daily': {
                        $each: [{ date: new Date(), userIp }],
                        $slice: -30 // Keep last 30 days
                    }
                }
            });

            res.json({
                success: true,
                message: 'View recorded'
            });

        } catch (error) {
            console.error('Increment view error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to record view',
                error: error.message
            });
        }
    }

    // POST /api/properties/:id/bookmark - Bookmark property 💖
    static async bookmarkProperty(req, res) {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            // Check if already bookmarked
            const existingBookmark = await Bookmark.findOne({
                userId: req.user._id,
                propertyId: id
            });

            if (existingBookmark) {
                return res.status(400).json({
                    success: false,
                    message: 'Property already bookmarked'
                });
            }

            const bookmark = new Bookmark({
                userId: req.user._id,
                propertyId: id,
                notes: notes || '',
                createdAt: new Date()
            });

            await bookmark.save();

            res.status(201).json({
                success: true,
                message: 'Property bookmarked successfully',
                data: bookmark
            });

        } catch (error) {
            console.error('Bookmark error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to bookmark property',
                error: error.message
            });
        }
    }

    // DELETE /api/properties/:id/bookmark - Remove bookmark 💔
    static async removeBookmark(req, res) {
        try {
            const { id } = req.params;

            const bookmark = await Bookmark.findOneAndDelete({
                userId: req.user._id,
                propertyId: id
            });

            if (!bookmark) {
                return res.status(404).json({
                    success: false,
                    message: 'Bookmark not found'
                });
            }

            res.json({
                success: true,
                message: 'Bookmark removed successfully'
            });

        } catch (error) {
            console.error('Remove bookmark error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to remove bookmark',
                error: error.message
            });
        }
    }

    // Helper function to generate unique AD ID
    static async generateAdId() {
        const year = new Date().getFullYear();
        const count = await Property.countDocuments({}) + 1;
        return `RR${year}${count.toString().padStart(6, '0')}`;
    }
}


module.exports = {
    PropertyController
};