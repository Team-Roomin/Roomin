const express = require('express');
const { PropertyController, SearchController } = require('../controllers');
const { auth, isOwner } = require('../middleware/authentication.middleware.js');
const { validateProperty } = require('../middleware/validate.middleware.js');

const router = express.Router();

// Public routes
router.get('/', PropertyController.getAllProperties);
router.get('/search', SearchController.advancedSearch);
router.get('/nearby', SearchController.nearbyProperties);
router.get('/featured', SearchController.getFeaturedProperties);
router.get('/trending', SearchController.getTrendingProperties);
router.get('/:id', PropertyController.getPropertyById);
router.post('/:id/view', PropertyController.incrementView);

// Protected routes (require authentication)
router.use(auth); // Apply auth middleware to all routes below

router.post('/', isOwner, validateProperty, PropertyController.createProperty);
router.put('/:id', PropertyController.updateProperty);
router.delete('/:id', PropertyController.deleteProperty);
router.post('/:id/bookmark', PropertyController.bookmarkProperty);
router.delete('/:id/bookmark', PropertyController.removeBookmark);

module.exports = router;