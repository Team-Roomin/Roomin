import User from '../models/user.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { CustomError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'

const Property = require('../models/Property');
const User = require('../models/User');
const Bookmark = require('../models/Bookmark');
const Inquiry = require('../models/Inquiry');
const Review = require('../models/Review');
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

class AnalyticsController {
    
  // GET /api/analytics/properties/:id - Property performance 📈
  static async getPropertyAnalytics(req, res) {
      try {
          const { id } = req.params;
          const { period = '30' } = req.query; // days

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
                  message: 'Access denied'
              });
          }

          const daysAgo = new Date();
          daysAgo.setDate(daysAgo.getDate() - parseInt(period));

          // Aggregate analytics data
          const [
              viewsData,
              inquiriesCount,
              bookmarksCount,
              reviewsData,
              similarPropertiesAvg
          ] = await Promise.all([
              // Views over time
              Property.aggregate([
                  { $match: { _id: mongoose.Types.ObjectId(id) } },
                  { $unwind: '$views.daily' },
                  { $match: { 'views.daily.date': { $gte: daysAgo } } },
                  {
                      $group: {
                          _id: { $dateToString: { format: '%Y-%m-%d', date: '$views.daily.date' } },
                          views: { $sum: 1 }
                      }
                  },
                  { $sort: { _id: 1 } }
              ]),

              // Inquiries count
              Inquiry.countDocuments({
                  propertyId: id,
                  createdAt: { $gte: daysAgo }
              }),

              // Bookmarks count
              Bookmark.countDocuments({
                  propertyId: id,
                  createdAt: { $gte: daysAgo }
              }),

              // Reviews summary
              Review.aggregate([
                  { $match: { propertyId: mongoose.Types.ObjectId(id) } },
                  {
                      $group: {
                          _id: null,
                          totalReviews: { $sum: 1 },
                          avgRating: { $avg: '$rating' },
                          recentReviews: {
                              $sum: {
                                  $cond: [{ $gte: ['$createdAt', daysAgo] }, 1, 0]
                              }
                          }
                      }
                  }
              ]),

              // Similar properties average performance
              Property.aggregate([
                  {
                      $match: {
                          _id: { $ne: mongoose.Types.ObjectId(id) },
                          type: property.type,
                          'location.address.city': property.location.address.city,
                          isActive: true,
                          moderationStatus: 'approved'
                      }
                  },
                  {
                      $group: {
                          _id: null,
                          avgViews: { $avg: '$views.total' },
                          avgPrice: { $avg: '$price.amount' },
                          count: { $sum: 1 }
                      }
                  }
              ])
          ]);

          // Performance metrics
          const totalViews = property.views.total;
          const conversionRate = inquiriesCount > 0 ? ((inquiriesCount / totalViews) * 100).toFixed(2) : 0;
          const bookmarkRate = bookmarksCount > 0 ? ((bookmarksCount / totalViews) * 100).toFixed(2) : 0;

          res.json({
              success: true,
              data: {
                  property: {
                      id: property._id,
                      title: property.title,
                      adId: property.adId,
                      status: property.status,
                      postedDate: property.postedDate
                  },
                  metrics: {
                      totalViews,
                      periodViews: viewsData.reduce((sum, day) => sum + day.views, 0),
                      inquiries: inquiriesCount,
                      bookmarks: bookmarksCount,
                      conversionRate: parseFloat(conversionRate),
                      bookmarkRate: parseFloat(bookmarkRate)
                  },
                  reviews: {
                      total: reviewsData[0]?.totalReviews || 0,
                      averageRating: reviewsData[0]?.avgRating || 0,
                      recent: reviewsData[0]?.recentReviews || 0
                  },
                  trends: {
                      dailyViews: viewsData,
                      period: `${period} days`
                  },
                  comparison: {
                      avgViewsInCategory: similarPropertiesAvg[0]?.avgViews || 0,
                      avgPriceInCategory: similarPropertiesAvg[0]?.avgPrice || 0,
                      similarPropertiesCount: similarPropertiesAvg[0]?.count || 0
                  }
              }
          });

      } catch (error) {
          console.error('Property analytics error:', error);
          res.status(500).json({
              success: false,
              message: 'Failed to fetch property analytics',
              error: error.message
          });
      }
  }

  // GET /api/analytics/dashboard - Owner dashboard stats 📊
  static async getOwnerDashboard(req, res) {
      try {
          const ownerId = req.user._id;
          const { period = '30' } = req.query;

          const daysAgo = new Date();
          daysAgo.setDate(daysAgo.getDate() - parseInt(period));

          const [
              propertiesStats,
              inquiriesStats,
              viewsStats,
              revenueStats,
              topPerformingProperties,
              recentActivities
          ] = await Promise.all([
              // Properties overview
              Property.aggregate([
                  { $match: { ownerId: mongoose.Types.ObjectId(ownerId) } },
                  {
                      $group: {
                          _id: '$status',
                          count: { $sum: 1 },
                          totalViews: { $sum: '$views.total' }
                      }
                  }
              ]),

              // Inquiries stats
              Inquiry.aggregate([
                  { $match: { ownerUserId: mongoose.Types.ObjectId(ownerId) } },
                  {
                      $group: {
                          _id: '$status',
                          count: { $sum: 1 },
                          recent: {
                              $sum: {
                                  $cond: [{ $gte: ['$createdAt', daysAgo] }, 1, 0]
                              }
                          }
                      }
                  }
              ]),

              // Views over time
              Property.aggregate([
                  { $match: { ownerId: mongoose.Types.ObjectId(ownerId) } },
                  { $unwind: '$views.daily' },
                  { $match: { 'views.daily.date': { $gte: daysAgo } } },
                  {
                      $group: {
                          _id: { $dateToString: { format: '%Y-%m-%d', date: '$views.daily.date' } },
                          totalViews: { $sum: 1 }
                      }
                  },
                  { $sort: { _id: 1 } }
              ]),

              // Revenue potential (for rent properties)
              Property.aggregate([
                  {
                      $match: {
                          ownerId: mongoose.Types.ObjectId(ownerId),
                          status: 'rented'
                      }
                  },
                  {
                      $group: {
                          _id: null,
                          totalMonthlyRevenue: { $sum: '$price.amount' },
                          avgRent: { $avg: '$price.amount' },
                          rentedProperties: { $sum: 1 }
                      }
                  }
              ]),

              // Top performing properties
              Property.find({ ownerId })
                  .select('title adId views.total status price.amount location.address.area')
                  .sort({ 'views.total': -1 })
                  .limit(5)
                  .lean(),

              // Recent activities (inquiries, bookmarks, reviews)
              Promise.all([
                  Inquiry.find({ ownerUserId: ownerId })
                      .populate('propertyId', 'title adId')
                      .populate('inquirerUserId', 'fullName')
                      .sort({ createdAt: -1 })
                      .limit(5)
                      .lean(),
                  Bookmark.find({
                      propertyId: { $in: await Property.find({ ownerId }).distinct('_id') }
                  })
                      .populate('propertyId', 'title adId')
                      .populate('userId', 'fullName')
                      .sort({ createdAt: -1 })
                      .limit(5)
                      .lean()
              ])
          ]);

          // Process data for dashboard
          const propertiesOverview = {
              total: propertiesStats.reduce((sum, stat) => sum + stat.count, 0),
              available: propertiesStats.find(s => s._id === 'available')?.count || 0,
              rented: propertiesStats.find(s => s._id === 'rented')?.count || 0,
              sold: propertiesStats.find(s => s._id === 'sold')?.count || 0,
              totalViews: propertiesStats.reduce((sum, stat) => sum + stat.totalViews, 0)
          };

          const inquiriesOverview = {
              total: inquiriesStats.reduce((sum, stat) => sum + stat.count, 0),
              new: inquiriesStats.find(s => s._id === 'new')?.count || 0,
              replied: inquiriesStats.find(s => s._id === 'replied')?.count || 0,
              recent: inquiriesStats.reduce((sum, stat) => sum + stat.recent, 0)
          };

          res.json({
              success: true,
              data: {
                  overview: {
                      properties: propertiesOverview,
                      inquiries: inquiriesOverview,
                      revenue: revenueStats[0] || { totalMonthlyRevenue: 0, avgRent: 0, rentedProperties: 0 }
                  },
                  trends: {
                      views: viewsStats,
                      period: `${period} days`
                  },
                  topProperties: topPerformingProperties,
                  recentActivities: {
                      inquiries: recentActivities[0],
                      bookmarks: recentActivities[1]
                  }
              }
          });

      } catch (error) {
          console.error('Dashboard analytics error:', error);
          res.status(500).json({
              success: false,
              message: 'Failed to fetch dashboard data',
              error: error.message
          });
      }
  }
}



module.exports = {
  AnalyticsController
};