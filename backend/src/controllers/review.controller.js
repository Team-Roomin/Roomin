
const Property = require('../models/Property');
const User = require('../models/User');
const Bookmark = require('../models/Bookmark');
const Inquiry = require('../models/Inquiry');
const Review = require('../models/Review');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');


class ReviewController {
    
    // POST /api/properties/:id/reviews - Add review ✍️
    static async createReview(req, res) {
        try {
            const { id } = req.params;
            const { rating, title, review, ratings, photos } = req.body;

            // Check if property exists
            const property = await Property.findById(id);
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'Property not found'
                });
            }

            // Check if user has already reviewed this property
            const existingReview = await Review.findOne({
                propertyId: id,
                reviewerId: req.user._id
            });

            if (existingReview) {
                return res.status(400).json({
                    success: false,
                    message: 'You have already reviewed this property'
                });
            }

            const newReview = new Review({
                propertyId: id,
                reviewerId: req.user._id,
                rating: Math.max(1, Math.min(5, rating)), // Ensure 1-5 range
                title,
                review,
                photos: photos || [],
                ratings: {
                    location: ratings?.location || rating,
                    value: ratings?.value || rating,
                    condition: ratings?.condition || rating,
                    landlord: ratings?.landlord || rating
                },
                isVerified: false, // TODO: Implement verification logic
                createdAt: new Date()
            });

            await newReview.save();
            await newReview.populate('reviewerId', 'fullName avatar isVerified');

            res.status(201).json({
                success: true,
                message: 'Review added successfully',
                data: newReview
            });

        } catch (error) {
            console.error('Create review error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add review',
                error: error.message
            });
        }
    }

    // GET /api/properties/:id/reviews - Get reviews 📖
    static async getPropertyReviews(req, res) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 10, sortBy = 'latest' } = req.query;

            let sortOptions = {};
            switch (sortBy) {
                case 'latest':
                    sortOptions = { createdAt: -1 };
                    break;
                case 'oldest':
                    sortOptions = { createdAt: 1 };
                    break;
                case 'highest_rating':
                    sortOptions = { rating: -1 };
                    break;
                case 'lowest_rating':
                    sortOptions = { rating: 1 };
                    break;
                default:
                    sortOptions = { createdAt: -1 };
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [reviews, totalCount, avgRating] = await Promise.all([
                Review.find({ propertyId: id })
                    .populate('reviewerId', 'fullName avatar isVerified memberSince')
                    .sort(sortOptions)
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                Review.countDocuments({ propertyId: id }),
                Review.aggregate([
                    { $match: { propertyId: mongoose.Types.ObjectId(id) } },
                    {
                        $group: {
                            _id: null,
                            avgRating: { $avg: '$rating' },
                            avgLocation: { $avg: '$ratings.location' },
                            avgValue: { $avg: '$ratings.value' },
                            avgCondition: { $avg: '$ratings.condition' },
                            avgLandlord: { $avg: '$ratings.landlord' }
                        }
                    }
                ])
            ]);

            res.json({
                success: true,
                data: {
                    reviews,
                    stats: {
                        totalReviews: totalCount,
                        averageRating: avgRating[0]?.avgRating || 0,
                        breakdown: {
                            location: avgRating[0]?.avgLocation || 0,
                            value: avgRating[0]?.avgValue || 0,
                            condition: avgRating[0]?.avgCondition || 0,
                            landlord: avgRating[0]?.avgLandlord || 0
                        }
                    },
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalCount / parseInt(limit)),
                        totalCount
                    }
                }
            });

        } catch (error) {
            console.error('Get reviews error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch reviews',
                error: error.message
            });
        }
    }

    // PUT /api/reviews/:id - Update review ✏️
    static async updateReview(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const review = await Review.findById(id);
            if (!review) {
                return res.status(404).json({
                    success: false,
                    message: 'Review not found'
                });
            }

            // Check if user owns the review
            if (review.reviewerId.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only update your own reviews'
                });
            }

            // Ensure rating is within valid range
            if (updates.rating) {
                updates.rating = Math.max(1, Math.min(5, updates.rating));
            }

            updates.updatedAt = new Date();

            const updatedReview = await Review.findByIdAndUpdate(
                id,
                { $set: updates },
                { new: true, runValidators: true }
            ).populate('reviewerId', 'fullName avatar isVerified');

            res.json({
                success: true,
                message: 'Review updated successfully',
                data: updatedReview
            });

        } catch (error) {
            console.error('Update review error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update review',
                error: error.message
            });
        }
    }

    // DELETE /api/reviews/:id - Delete review 🗑️
    static async deleteReview(req, res) {
        try {
            const { id } = req.params;

            const review = await Review.findById(id);
            if (!review) {
                return res.status(404).json({
                    success: false,
                    message: 'Review not found'
                });
            }

            // Check if user owns the review or is admin
            if (review.reviewerId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'You can only delete your own reviews'
                });
            }

            await Review.findByIdAndDelete(id);

            res.json({
                success: true,
                message: 'Review deleted successfully'
            });

        } catch (error) {
            console.error('Delete review error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete review',
                error: error.message
            });
        }
    }
}


module.exports = {
    ReviewController, 
};