const { validationResult, check } = require('express-validator');

/**
 * Middleware to validate blog post data.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 */
exports.validatePost = [
  check('title').notEmpty().withMessage('Title is required'),
  check('content').notEmpty().withMessage('Content is required'),
  check('category_id').isInt().withMessage('Valid category ID is required'),
  check('author_id').isInt().withMessage('Valid author ID is required'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
