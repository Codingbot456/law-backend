const db = require('../config/db'); // Import the MySQL connection pool

// Create a product with optional images
// controllers/productController.js
const cloudinary = require('../config/cloudinaryConfig');

exports.createProduct = async (req, res) => {
  const { name, price, description, category_id, subcategory_id, status_id, size_ids, color_ids } = req.body;
  const files = req.files; // Extract files from multer

  // Log the received data
  console.log('Received data:', {
    name,
    price,
    description,
    category_id,
    subcategory_id,
    status_id,
    size_ids,
    color_ids,
    files
  });

  if (!name || !price || !category_id || !subcategory_id || !status_id) {
    console.error('Validation error: Missing required fields');
    return res.status(400).send('Name, price, category_id, subcategory_id, and status_id are required.');
  }

  try {
    // Start a transaction
    console.log('Starting transaction');
    await db.query('START TRANSACTION');

    // Insert product
    console.log('Inserting product into database');
    const [result] = await db.query(
      'INSERT INTO products (name, price, description, category_id, subcategory_id, status_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, price, description, category_id, subcategory_id, status_id]
    );
    const productId = result.insertId;
    console.log('Product inserted with ID:', productId);

    // Add sizes to product if provided
    if (Array.isArray(size_ids) && size_ids.length > 0) {
      const sizeValues = size_ids.map(size_id => [productId, size_id]);
      console.log('Inserting sizes for product:', sizeValues);
      await db.query(
        'INSERT INTO product_sizes (product_id, size_id) VALUES ?',
        [sizeValues]
      );
    }

    // Add colors to product if provided
    if (Array.isArray(color_ids) && color_ids.length > 0) {
      const colorValues = color_ids.map(color_id => [productId, color_id]);
      console.log('Inserting colors for product:', colorValues);
      await db.query(
        'INSERT INTO product_colors (product_id, color_id) VALUES ?',
        [colorValues]
      );
    }

    // Upload images to Cloudinary and get URLs
    const uploadPromises = files.map(file => {
      return new Promise((resolve, reject) => {
        cloudinary.uploader.upload(file.path, { folder: 'products' }, (error, result) => {
          if (error) return reject(error);
          resolve(result.secure_url);
        });
      });
    });

    const imageUrls = await Promise.all(uploadPromises);

    // Insert images into the database
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      const imageInsertValues = imageUrls.map(image_url => [image_url]);
      console.log('Inserting images:', imageInsertValues);
      const [imageInsertResults] = await db.query(
        'INSERT INTO product_images (image_url) VALUES ?',
        [imageInsertValues]
      );

      const imageIds = Array.from({ length: imageInsertResults.affectedRows }, (_, i) => imageInsertResults.insertId + i);
      if (imageIds.length > 0) {
        const productImageValues = imageIds.map(image_id => [productId, image_id]);
        console.log('Associating images with product:', productImageValues);
        await db.query(
          'INSERT INTO product_image (product_id, image_id) VALUES ?',
          [productImageValues]
        );
      }
    }

    // Commit the transaction
    console.log('Committing transaction');
    await db.query('COMMIT');

    res.status(201).send({ product_id: productId });
  } catch (err) {
    // Rollback the transaction in case of an error
    console.error('Error during transaction, rolling back:', err);
    await db.query('ROLLBACK');
    res.status(500).send('Error inserting product');
  }
};



// Fetch a single product by ID, including status, category, subcategory, sizes, colors, and images
// Fetch a single product by ID, including status, category, subcategory, sizes, colors, and images
// Fetch a single product by ID, including status, category, subcategory, sizes, colors, and images
exports.getProductById = async (req, res) => {
    const { id } = req.params;

    try {
        // Fetch product details with status, category, and subcategory, excluding IDs
        const [productRows] = await db.query(`
            SELECT p.product_id, 
                   p.name, 
                   p.price, 
                   p.description,
                   s.status_name AS status, 
                   c.category_name AS category, 
                   sc.subcategory_name AS subcategory
            FROM products p
            LEFT JOIN product_statuses s ON p.status_id = s.status_id
            LEFT JOIN product_categories c ON p.category_id = c.category_id
            LEFT JOIN subcategories sc ON p.subcategory_id = sc.subcategory_id
            WHERE p.product_id = ?
        `, [id]);

        if (productRows.length === 0) {
            return res.status(404).send('Product not found');
        }

        const product = productRows[0];

        // Fetch sizes associated with the product
        const [sizeRows] = await db.query(`
            SELECT s.size_name, s.category
            FROM product_sizes ps
            JOIN sizes s ON ps.size_id = s.size_id
            WHERE ps.product_id = ?
        `, [id]);

        // Map the size names instead of IDs
        product.sizes = sizeRows;

        // Fetch colors associated with the product
        const [colorRows] = await db.query(`
            SELECT c.color_name
            FROM product_colors pc
            JOIN colors c ON pc.color_id = c.color_id
            WHERE pc.product_id = ?
        `, [id]);

        // Map the color names instead of IDs
        product.colors = colorRows.map(color => ({ color_name: color.color_name }));

        // Fetch images associated with the product
        const [imageRows] = await db.query(`
            SELECT img.image_url
            FROM product_image pi
            JOIN product_images img ON pi.image_id = img.image_id
            WHERE pi.product_id = ?
        `, [id]);

        // Map the image URLs
        product.images = imageRows.map(row => row.image_url);

        // Send the combined result
        res.json(product);
    } catch (err) {
        console.error('Error fetching product:', err);
        res.status(500).send('Error fetching product');
    }
};



// Fetch all products
// Fetch all products with related sizes, colors, and images
exports.getAllProducts = async (req, res) => {
    try {
        // Fetch all product details including IDs for status, category, subcategory, sizes, and colors
        const [products] = await db.query(`
            SELECT p.product_id, 
                   p.name, 
                   p.price, 
                   p.description,
                   p.category_id, 
                   p.subcategory_id, 
                   p.status_id
            FROM products p
        `);

        // Fetch categories by ID
        const categoryIds = [...new Set(products.map(product => product.category_id))];
        const [categories] = await db.query(`
            SELECT category_id, category_name
            FROM product_categories
            WHERE category_id IN (?)
        `, [categoryIds]);

        // Fetch subcategories by ID
        const subcategoryIds = [...new Set(products.map(product => product.subcategory_id))];
        const [subcategories] = await db.query(`
            SELECT subcategory_id, subcategory_name
            FROM subcategories
            WHERE subcategory_id IN (?)
        `, [subcategoryIds]);

        // Fetch statuses by ID
        const statusIds = [...new Set(products.map(product => product.status_id))];
        const [statuses] = await db.query(`
            SELECT status_id, status_name
            FROM product_statuses
            WHERE status_id IN (?)
        `, [statusIds]);

        // Map IDs to names for categories, subcategories, and statuses
        const categoryMap = Object.fromEntries(categories.map(cat => [cat.category_id, cat.category_name]));
        const subcategoryMap = Object.fromEntries(subcategories.map(subcat => [subcat.subcategory_id, subcat.subcategory_name]));
        const statusMap = Object.fromEntries(statuses.map(st => [st.status_id, st.status_name]));

        // Assign names to products
        products.forEach(product => {
            product.category_name = categoryMap[product.category_id] || null;
            product.subcategory_name = subcategoryMap[product.subcategory_id] || null;
            product.status_name = statusMap[product.status_id] || null;
        });

        // Fetch sizes for each product
        const sizeQueries = products.map(product => 
            db.query(`
                SELECT s.size_id, s.size_name
                FROM product_sizes ps
                JOIN sizes s ON ps.size_id = s.size_id
                WHERE ps.product_id = ?
            `, [product.product_id])
        );
        const sizeResults = await Promise.all(sizeQueries);

        // Fetch colors for each product
        const colorQueries = products.map(product => 
            db.query(`
                SELECT c.color_id, c.color_name
                FROM product_colors pc
                JOIN colors c ON pc.color_id = c.color_id
                WHERE pc.product_id = ?
            `, [product.product_id])
        );
        const colorResults = await Promise.all(colorQueries);

        // Add sizes to products
        products.forEach((product, index) => {
            product.sizes = sizeResults[index][0] || [];
        });

        // Add colors to products
        products.forEach((product, index) => {
            product.colors = colorResults[index][0].map(color => ({ color_id: color.color_id, color_name: color.color_name }));
        });

        // Fetch images for each product
        const imageQueries = products.map(product => 
            db.query(`
                SELECT img.image_url
                FROM product_image pi
                JOIN product_images img ON pi.image_id = img.image_id
                WHERE pi.product_id = ?
            `, [product.product_id])
        );
        const imageResults = await Promise.all(imageQueries);

        // Add images to products
        products.forEach((product, index) => {
            product.images = imageResults[index][0].map(row => row.image_url);
        });

        // Send the combined result
        res.json(products);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).send('Error fetching products');
    }
};



// Fetch products by category
exports.getProductsByCategory = async (req, res) => {
    const { category_id } = req.params;

    try {
        const [rows] = await db.query(`
            SELECT p.*, 
                   s.status_name AS status, 
                   c.category_name AS category, 
                   sc.subcategory_name AS subcategory
            FROM products p
            LEFT JOIN product_statuses s ON p.status_id = s.status_id
            LEFT JOIN product_categories c ON p.category_id = c.category_id
            LEFT JOIN subcategories sc ON p.subcategory_id = sc.subcategory_id
            WHERE p.category_id = ?
        `, [category_id]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching products by category:', err);
        res.status(500).send('Error fetching products by category');
    }
};

// Fetch products by subcategory
exports.getProductsBySubcategory = async (req, res) => {
    const { subcategory_id } = req.params;

    try {
        const [rows] = await db.query(`
            SELECT p.*, 
                   s.status_name AS status, 
                   c.category_name AS category, 
                   sc.subcategory_name AS subcategory
            FROM products p
            LEFT JOIN product_statuses s ON p.status_id = s.status_id
            LEFT JOIN product_categories c ON p.category_id = c.category_id
            LEFT JOIN subcategories sc ON p.subcategory_id = sc.subcategory_id
            WHERE p.subcategory_id = ?
        `, [subcategory_id]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching products by subcategory:', err);
        res.status(500).send('Error fetching products by subcategory');
    }
};


// Update an existing product with optional updates for sizes, colors, and images
exports.updateProduct = async (req, res) => {
    const { id } = req.params; // Product ID from URL parameters
    const { name, price, description, category_id, subcategory_id, status_id, size_ids, color_ids, existing_images } = req.body;
    const files = req.files; // Extract files from multer

    // Extract new image paths if files are provided
    const newImageUrls = files ? files.map(file => file.path) : [];
    // Ensure that existing images are included if no new images are uploaded
    const finalImageUrls = newImageUrls.length > 0 ? newImageUrls : existing_images || [];

    // Log the received data
    console.log('Received update data:', {
        id,
        name,
        price,
        description,
        category_id,
        subcategory_id,
        status_id,
        size_ids,
        color_ids,
        finalImageUrls
    });

    // Validate input
    if (!name || !price || !category_id || !subcategory_id || !status_id) {
        return res.status(400).send('Name, price, category_id, subcategory_id, and status_id are required.');
    }

    try {
        // Start a transaction
        console.log('Starting transaction');
        await db.query('START TRANSACTION');

        // Update product details
        console.log('Updating product details');
        await db.query(
            'UPDATE products SET name = ?, price = ?, description = ?, category_id = ?, subcategory_id = ?, status_id = ? WHERE product_id = ?',
            [name, price, description, category_id, subcategory_id, status_id, id]
        );

        // Update sizes if provided
        if (Array.isArray(size_ids) && size_ids.length > 0) {
            console.log('Updating sizes');
            await db.query('DELETE FROM product_sizes WHERE product_id = ?', [id]);
            const sizeValues = size_ids.map(size_id => [id, size_id]);
            await db.query('INSERT INTO product_sizes (product_id, size_id) VALUES ?', [sizeValues]);
        } else {
            // If no sizes provided, clear existing sizes
            await db.query('DELETE FROM product_sizes WHERE product_id = ?', [id]);
        }

        // Update colors if provided
        if (Array.isArray(color_ids) && color_ids.length > 0) {
            console.log('Updating colors');
            await db.query('DELETE FROM product_colors WHERE product_id = ?', [id]);
            const colorValues = color_ids.map(color_id => [id, color_id]);
            await db.query('INSERT INTO product_colors (product_id, color_id) VALUES ?', [colorValues]);
        } else {
            // If no colors provided, clear existing colors
            await db.query('DELETE FROM product_colors WHERE product_id = ?', [id]);
        }

        // Handle images
        console.log('Updating images');
        if (finalImageUrls.length > 0) {
            // Clear existing images
            await db.query('DELETE FROM product_image WHERE product_id = ?', [id]);

            // Upload new images to Cloudinary and get URLs
            const uploadPromises = finalImageUrls.map(url => {
                return new Promise((resolve, reject) => {
                    cloudinary.uploader.upload(url, { folder: 'products' }, (error, result) => {
                        if (error) return reject(error);
                        resolve(result.secure_url);
                    });
                });
            });

            const imageUrls = await Promise.all(uploadPromises);

            // Insert new image records and associate them with the product
            const [imageInsertResults] = await db.query(
                'INSERT INTO product_images (image_url) VALUES ?',
                [imageUrls.map(url => [url])]
            );
            const imageIds = Array.from({ length: imageInsertResults.affectedRows }, (_, i) => imageInsertResults.insertId + i);

            // Associate new images with the product
            const productImageValues = imageIds.map(image_id => [id, image_id]);
            await db.query('INSERT INTO product_image (product_id, image_id) VALUES ?', [productImageValues]);
        } else {
            // If no images are provided, retain existing images
            // This branch is effectively redundant since `finalImageUrls` will be used, 
            // but it's kept for clarity.
            await db.query('DELETE FROM product_image WHERE product_id = ?', [id]);
        }

        // Commit the transaction
        console.log('Committing transaction');
        await db.query('COMMIT');

        res.status(200).send('Product updated successfully.');
    } catch (err) {
        // Rollback the transaction in case of an error
        console.error('Error during transaction, rolling back:', err);
        await db.query('ROLLBACK');
        res.status(500).send('Error updating product');
    }
};





// Fetch products by status
exports.getProductsByStatus = async (req, res) => {
    const { status_id } = req.params;
    try {
        const [rows] = await db.query(`
            SELECT p.*, 
                   s.status_name AS status, 
                   c.category_name AS category, 
                   sc.subcategory_name AS subcategory
            FROM products p
            LEFT JOIN product_statuses s ON p.status_id = s.status_id
            LEFT JOIN product_categories c ON p.category_id = c.category_id
            LEFT JOIN subcategories sc ON p.subcategory_id = sc.subcategory_id
            WHERE p.status_id = ?
        `, [status_id]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching products by status:', err);
        res.status(500).send('Error fetching products by status');
    }
};

// Create a size
exports.createSize = async (req, res) => {
    const { size_name, category } = req.body;

    if (!size_name || !category) {
        return res.status(400).send('Size name and category are required.');
    }

    try {
        const [result] = await db.query(
            'INSERT INTO sizes (size_name, category) VALUES (?, ?)',
            [size_name, category]
        );
        res.status(201).send({ size_id: result.insertId });
    } catch (err) {
        console.error('Error creating size:', err);
        res.status(500).send('Error creating size');
    }
};

// Fetch all sizes
exports.getAllSizes = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM sizes');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching sizes:', err);
        res.status(500).send('Error fetching sizes');
    }
};

// Associate sizes with a product
exports.addSizesToProduct = async (req, res) => {
    const { product_id } = req.params;
    const { size_ids } = req.body; // Array of size_ids

    if (!Array.isArray(size_ids) || size_ids.length === 0) {
        return res.status(400).send('At least one size_id is required.');
    }

    try {
        const values = size_ids.map(size_id => [product_id, size_id]);
        await db.query(
            'INSERT INTO product_sizes (product_id, size_id) VALUES ?',
            [values]
        );
        res.send('Sizes added to product successfully.');
    } catch (err) {
        console.error('Error adding sizes to product:', err);
        res.status(500).send('Error adding sizes to product');
    }
};

// Fetch sizes for a product
exports.getProductSizes = async (req, res) => {
    const { product_id } = req.params;

    try {
        const [rows] = await db.query(`
            SELECT s.size_id, s.size_name, s.category
            FROM product_sizes ps
            JOIN sizes s ON ps.size_id = s.size_id
            WHERE ps.product_id = ?
        `, [product_id]);

        if (rows.length === 0) {
            return res.status(404).send('No sizes found for this product');
        }

        res.json(rows);
    } catch (err) {
        console.error('Error fetching product sizes:', err);
        res.status(500).send('Error fetching product sizes');
    }
};

exports.getAllStatuses = async (req, res) => {
    try {
      const [statuses] = await db.query('SELECT * FROM product_statuses');
      res.json(statuses);
    } catch (err) {
      console.error('Error fetching statuses:', err);
      res.status(500).send('Error fetching statuses');
    }
  };
  
  // Handler to get subcategories by category
  exports.getSubcategoriesByCategory = async (req, res) => {
    const { category_id } = req.query; // Expecting 'category_id' as a query parameter
  
    if (!category_id) {
      return res.status(400).send('Category ID is required');
    }
  
    try {
      const [subcategories] = await db.query(
        'SELECT * FROM subcategories WHERE category_id = ?',
        [category_id]
      );
      res.json(subcategories);
    } catch (err) {
      console.error('Error fetching subcategories:', err);
      res.status(500).send('Error fetching subcategories');
    }
  };
  
  
  
  // Handler to get all categories
  exports.getAllCategories = async (req, res) => {
    try {
      const [categories] = await db.query('SELECT * FROM product_categories');
      res.json(categories);
    } catch (err) {
      console.error('Error fetching categories:', err);
      res.status(500).send('Error fetching categories');
    }
  };

// Create a color
exports.createColor = async (req, res) => {
    const { color_name } = req.body;

    if (!color_name) {
        return res.status(400).send('Color name is required.');
    }

    try {
        const [result] = await db.query(
            'INSERT INTO colors (color_name) VALUES (?)',
            [color_name]
        );
        res.status(201).send({ color_id: result.insertId });
    } catch (err) {
        console.error('Error creating color:', err);
        res.status(500).send('Error creating color');
    }
};

// Fetch all colors
exports.getAllColors = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM colors');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching colors:', err);
        res.status(500).send('Error fetching colors');
    }
};

// Associate colors with a product
exports.addColorsToProduct = async (req, res) => {
    const { product_id } = req.params;
    const { color_ids } = req.body; // Array of color_ids

    if (!Array.isArray(color_ids) || color_ids.length === 0) {
        return res.status(400).send('At least one color_id is required.');
    }

    try {
        const values = color_ids.map(color_id => [product_id, color_id]);
        await db.query(
            'INSERT INTO product_colors (product_id, color_id) VALUES ?',
            [values]
        );
        res.send('Colors added to product successfully.');
    } catch (err) {
        console.error('Error adding colors to product:', err);
        res.status(500).send('Error adding colors to product');
    }
};

// Fetch colors for a product
exports.getProductColors = async (req, res) => {
    const { product_id } = req.params;

    try {
        const [rows] = await db.query(`
            SELECT c.color_id, c.color_name
            FROM product_colors pc
            JOIN colors c ON pc.color_id = c.color_id
            WHERE pc.product_id = ?
        `, [product_id]);

        if (rows.length === 0) {
            return res.status(404).send('No colors found for this product');
        }

        res.json(rows);
    } catch (err) {
        console.error('Error fetching product colors:', err);
        res.status(500).send('Error fetching product colors');
    }
};

// Create a product image
exports.createProductImage = async (req, res) => {
    const { image_url } = req.body;

    if (!image_url) {
        return res.status(400).send('Image URL is required.');
    }

    try {
        const [result] = await db.query(
            'INSERT INTO product_images (image_url) VALUES (?)',
            [image_url]
        );
        res.status(201).send({ image_id: result.insertId });
    } catch (err) {
        console.error('Error creating image:', err);
        res.status(500).send('Error creating image');
    }
};

// Fetch all images
exports.getAllProductImages = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM product_images');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching images:', err);
        res.status(500).send('Error fetching images');
    }
};

// Associate images with a product
exports.addProductImagesToProduct = async (req, res) => {
    const { product_id } = req.params;
    const { image_ids } = req.body; // Array of image_ids

    if (!Array.isArray(image_ids) || image_ids.length === 0) {
        return res.status(400).send('At least one image_id is required.');
    }

    try {
        const values = image_ids.map(image_id => [product_id, image_id]);
        await db.query(
            'INSERT INTO product_image (product_id, image_id) VALUES ?',
            [values]
        );
        res.send('Images added to product successfully.');
    } catch (err) {
        console.error('Error adding images to product:', err);
        res.status(500).send('Error adding images to product');
    }
};

// Fetch images for a product
exports.getProductImages = async (req, res) => {
    const { product_id } = req.params;

    try {
        const [rows] = await db.query(`
            SELECT img.image_url
            FROM product_image pi
            JOIN product_images img ON pi.image_id = img.image_id
            WHERE pi.product_id = ?
        `, [product_id]);

        if (rows.length === 0) {
            return res.status(404).send('No images found for this product');
        }

        res.json(rows);
    } catch (err) {
        console.error('Error fetching product images:', err);
        res.status(500).send('Error fetching product images');
    }
};
