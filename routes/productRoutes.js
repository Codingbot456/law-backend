const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const upload = require('../config/multerConfig');

// Route to fetch products by category
router.get('/products/category/:category_id', productController.getProductsByCategory);

// Route to fetch products by subcategory
router.get('/products/subcategory/:subcategory_id', productController.getProductsBySubcategory);

// Route to create a new product
router.post('/products', upload.array('images', 5), productController.createProduct);

// Route to fetch all products
router.get('/products', productController.getAllProducts);

// Route to fetch a single product by ID
router.get('/products/:id', productController.getProductById);

// Route to update a product
router.put('/products/:id', upload.array('images', 5), productController.updateProduct);

// Route to fetch products by status
router.get('/products/status/:status_id', productController.getProductsByStatus);

// Route to create a new size
router.post('/sizes', productController.createSize);

// Route to fetch all sizes
router.get('/sizes', productController.getAllSizes);

// Route to associate sizes with a product
router.post('/products/:product_id/sizes', productController.addSizesToProduct);

// Route to fetch sizes for a product
router.get('/products/:product_id/sizes', productController.getProductSizes);

// Route to create a new color
router.post('/colors', productController.createColor);

// Route to fetch all colors
router.get('/colors', productController.getAllColors);

// Route to associate colors with a product
router.post('/products/:product_id/colors', productController.addColorsToProduct);

// Route to fetch colors for a product
router.get('/products/:product_id/colors', productController.getProductColors);

// Route to create a new image
router.post('/product_images', productController.createProductImage);

// Route to fetch all images
router.get('/product_images', productController.getAllProductImages);

// Route to associate images with a product
router.post('/products/:product_id/images', productController.addProductImagesToProduct);

// Route to fetch images for a product
router.get('/products/:product_id/images', productController.getProductImages);

// Route to fetch all statuses
router.get('/statuses', productController.getAllStatuses);

router.get('/subcategories', productController.getSubcategoriesByCategory);

// Route to fetch all categories
router.get('/categories', productController.getAllCategories);

module.exports = router;
