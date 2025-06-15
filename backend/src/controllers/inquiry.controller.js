const Property = require('../models/Property');
const User = require('../models/User');
const Bookmark = require('../models/Bookmark');
const Inquiry = require('../models/Inquiry');
const Review = require('../models/Review');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');


class InquiryController {
    
    // POST /api/properties/:id/inquire - Contact owner 📞
    static async createInquiry(req, res) {
        try {
            const { id } = req.params;
            const { message, contactInfo } = req.body;

            const property = await Property.findById(id).populate('ownerId');
            if (!property) {
                return res.status(404).json({
                    success: false,
                    message: 'Property not found'
                });
            }

            // Check if user already inquired recently
            const recentInquiry = await Inquiry.findOne({
                propertyId: id,
                inquirerUserId: req.user._id,
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 24 hours
            });

            if (recentInquiry) {
                return res.status(429).json({
                    success: false,
                    message: 'You can only inquire once per day for the same property'
                });
            }

            const inquiry = new Inquiry({
                propertyId: id,
                inquirerUserId: req.user._id,
                ownerUserId: property.ownerId._id,
                message,
                contactInfo: {
                    phone: contactInfo.phone || req.user.phoneNumber,
                    email: contactInfo.email || req.user.email,
                    preferredTime: contactInfo.preferredTime
                },
                status: 'new',
                createdAt: new Date()
            });

            await inquiry.save();

            // Add to property's interested users
            await Property.findByIdAndUpdate(id, {
                $push: {
                    interestedUsers: {
                        userId: req.user._id,
                        contactedAt: new Date(),
                        status: 'interested'
                    }
                }
            });

            // TODO: Send notification to owner (email/SMS/push)
            
            res.status(201).json({
                success: true,
                message: 'Inquiry sent successfully! Owner will contact you soon.',
                data: inquiry
            });

        } catch (error) {
            console.error('Create inquiry error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send inquiry',
                error: error.message
            });
        }
    }

    // GET /api/inquiries/received - For owners 📥
    static async getReceivedInquiries(req, res) {
        try {
            const { page = 1, limit = 20, status } = req.query;
            
            const filters = { ownerUserId: req.user._id };
            if (status) filters.status = status;

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [inquiries, totalCount] = await Promise.all([
                Inquiry.find(filters)
                    .populate('inquirerUserId', 'fullName avatar phoneNumber email isVerified')
                    .populate('propertyId', 'title adId media.photos location.address')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                Inquiry.countDocuments(filters)
            ]);

            res.json({
                success: true,
                data: {
                    inquiries,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalCount / parseInt(limit)),
                        totalCount
                    }
                }
            });

        } catch (error) {
            console.error('Get received inquiries error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch inquiries',
                error: error.message
            });
        }
    }

    // GET /api/inquiries/sent - For users 📤
    static async getSentInquiries(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [inquiries, totalCount] = await Promise.all([
                Inquiry.find({ inquirerUserId: req.user._id })
                    .populate('ownerUserId', 'fullName avatar phoneNumber isVerified')
                    .populate('propertyId', 'title adId media.photos location.address price.amount')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                Inquiry.countDocuments({ inquirerUserId: req.user._id })
            ]);

            res.json({
                success: true,
                data: {
                    inquiries,
                    pagination: {
                        currentPage: parseInt(page),
                        totalPages: Math.ceil(totalCount / parseInt(limit)),
                        totalCount
                    }
                }
            });

        } catch (error) {
            console.error('Get sent inquiries error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch sent inquiries',
                error: error.message
            });
        }
    }

    // PUT /api/inquiries/:id/respond - Owner responds 💬
    static async respondToInquiry(req, res) {
        try {
            const { id } = req.params;
            const { response } = req.body;

            const inquiry = await Inquiry.findById(id);
            if (!inquiry) {
                return res.status(404).json({
                    success: false,
                    message: 'Inquiry not found'
                });
            }

            // Check if user owns the property
            if (inquiry.ownerUserId.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only respond to inquiries for your properties'
                });
            }

            const updatedInquiry = await Inquiry.findByIdAndUpdate(
                id,
                {
                    response,
                    status: 'replied',
                    respondedAt: new Date()
                },
                { new: true }
            ).populate('inquirerUserId', 'fullName email phoneNumber');

            // TODO: Send notification to inquirer

            res.json({
                success: true,
                message: 'Response sent successfully',
                data: updatedInquiry
            });

        } catch (error) {
            console.error('Respond to inquiry error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send response',
                error: error.message
            });
        }
    }
}


module.exports = {
    InquiryController,
};