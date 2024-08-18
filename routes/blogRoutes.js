const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const blogMiddleware = require('../middleware/blogMiddleware');

// Posts
router.get('/posts', (req, res) => {
  console.log('GET /api/blog/posts route hit');
  blogController.getPosts(req, res);
});

router.get('/posts/:id', (req, res) => {
  console.log(`GET /api/blog/posts/${req.params.id} route hit`);
  blogController.getPostById(req, res);
});

// Use the middleware for handling file uploads
router.post('/posts', blogController.uploadImages, (req, res) => {
  console.log('POST /api/blog/posts route hit');
  blogController.createPost(req, res);
});

router.put('/posts/:id', blogMiddleware.validatePost, (req, res) => {
  console.log(`PUT /api/blog/posts/${req.params.id} route hit`);
  blogController.updatePost(req, res);
});

router.delete('/posts/:id', (req, res) => {
  console.log(`DELETE /api/blog/posts/${req.params.id} route hit`);
  blogController.deletePost(req, res);
});

// Comments
router.get('/comments', (req, res) => {
  console.log('GET /api/blog/comments route hit');
  blogController.getComments(req, res);
});

router.post('/comments', (req, res) => {
  console.log('POST /api/blog/comments route hit');
  blogController.createComment(req, res);
});

// Categories
router.get('/categories', (req, res) => {
  console.log('GET /api/blog/categories route hit');
  blogController.getCategories(req, res);
});

// Subscribers
router.get('/subscribers', (req, res) => {
  console.log('GET /api/blog/subscribers route hit');
  blogController.getSubscribers(req, res);
});

router.post('/subscribers', (req, res) => {
  console.log('POST /api/blog/subscribers route hit');
  blogController.createSubscriber(req, res);
});

// Tags
router.get('/tags', (req, res) => {
  console.log('GET /api/blog/tags route hit');
  blogController.getTags(req, res);
});

// Post Tags
router.post('/post-tags', (req, res) => {
  console.log('POST /api/blog/post-tags route hit');
  blogController.createPostTag(req, res);
});

// Like a post
router.post('/posts/:id/like', (req, res) => {
  console.log(`POST /api/blog/posts/${req.params.id}/like route hit`);
  blogController.likePost(req, res);
});

// Get popular posts
router.get('/popular-posts', (req, res) => {
  console.log('GET /api/blog/popular-posts route hit');
  blogController.getPopularPosts(req, res);
});

module.exports = router;
