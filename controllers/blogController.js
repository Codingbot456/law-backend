const pool = require('../config/db');
const multer = require('multer');
const path = require('path');
const cloudinary = require('../config/cloudinaryConfig'); // Import Cloudinary configuration

// Configure multer for file uploads (In-memory storage for Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const baseUrl = 'http://localhost:4000'; // Your base URL

// Get all posts with optional category filtering and detailed information
exports.getPosts = async (req, res) => {
  const { category_id } = req.query; // Extract category_id from query parameters

  try {
    let query = `
      SELECT p.*, u.name AS author_name, u.email AS author_email, u.profileImage AS author_profile_image, i.image_path, p.created_at
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN images i ON p.id = i.post_id
    `;
    
    if (category_id) {
      query += ' WHERE p.category_id = ?';
    }

    const [posts] = await pool.query(query, [category_id].filter(Boolean)); // Pass category_id if it exists

    const postsWithDetails = posts.reduce((acc, row) => {
      const postId = row.id;
      if (!acc[postId]) {
        acc[postId] = {
          ...row,
          images: [],
          author_name: row.author_name,
          author_email: row.author_email,
          author_profile_image: row.author_profile_image,
        };
      }
      if (row.image_path) {
        acc[postId].images.push(row.image_path);
      }
      return acc;
    }, {});

    res.json(Object.values(postsWithDetails));
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get a single post by ID with detailed information
exports.getPostById = async (req, res) => {
  const { id } = req.params;
  try {
    const [postRows] = await pool.query(`
      SELECT p.*, a.name AS author_name, a.email AS author_email, i.image_path
      FROM posts p
      LEFT JOIN authors a ON p.author_id = a.id
      LEFT JOIN images i ON p.id = i.post_id
      WHERE p.id = ?
    `, [id]);

    if (postRows.length === 0) return res.status(404).json({ msg: 'Post not found' });

    const post = postRows[0];
    const images = postRows.map(row => row.image_path).filter(path => path);

    res.json({
      ...post,
      images,
    });
  } catch (error) {
    console.error('Error fetching post by ID:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create a new post with image handling
exports.createPost = async (req, res) => {
  const { title, content, category_id, author_id } = req.body;
  const images = req.files; // Array of uploaded files

  try {
    const [result] = await pool.query('INSERT INTO posts (title, content, category_id, author_id) VALUES (?, ?, ?, ?)', [title, content, category_id, author_id]);
    const postId = result.insertId;

    const imageUrls = [];
    if (images && images.length > 0) {
      for (const file of images) {
        // Upload image to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream({ resource_type: 'auto' }, (error, result) => {
            if (error) {
              reject(new Error('Image upload failed'));
            } else {
              resolve(result);
            }
          }).end(file.buffer);
        });

        const imageUrl = uploadResult.secure_url; // Cloudinary URL
        await pool.query('INSERT INTO images (post_id, image_path) VALUES (?, ?)', [postId, imageUrl]); // Store Cloudinary URL
        imageUrls.push(imageUrl);
      }
    }

    res.status(201).json({ id: postId, title, content, category_id, author_id, images: imageUrls });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update a post
exports.updatePost = async (req, res) => {
  const { title, content, category_id, author_id } = req.body;
  const images = req.files; // Array of uploaded files
  const postId = req.params.id;

  try {
    const [result] = await pool.query('UPDATE posts SET title = ?, content = ?, category_id = ?, author_id = ? WHERE id = ?', [title, content, category_id, author_id, postId]);
    if (result.affectedRows === 0) return res.status(404).json({ msg: 'Post not found' });

    const imageUrls = [];
    if (images && images.length > 0) {
      for (const file of images) {
        // Upload image to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream({ resource_type: 'auto' }, (error, result) => {
            if (error) {
              reject(new Error('Image upload failed'));
            } else {
              resolve(result);
            }
          }).end(file.buffer);
        });

        const imageUrl = uploadResult.secure_url; // Cloudinary URL
        await pool.query('INSERT INTO images (post_id, image_path) VALUES (?, ?)', [postId, imageUrl]); // Store Cloudinary URL
        imageUrls.push(imageUrl);
      }
    }

    res.json({ id: postId, title, content, category_id, author_id, images: imageUrls });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete a post
exports.deletePost = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM images WHERE post_id = ?', [id]);
    
    const [result] = await pool.query('DELETE FROM posts WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ msg: 'Post not found' });

    res.json({ msg: 'Post deleted' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get comments for a post
exports.getComments = async (req, res) => {
  try {
    const [comments] = await pool.query(`
      SELECT c.*, u.name AS author_name, u.profileImage AS author_profile_image
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
    `);
    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create a new comment
exports.createComment = async (req, res) => {
  const { post_id, user_id, content } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [post_id, user_id, content]);
    res.status(201).json({ id: result.insertId, post_id, user_id, content });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get categories
exports.getCategories = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM blog_categories');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get subscribers
exports.getSubscribers = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM subscribers');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create a new subscriber
exports.createSubscriber = async (req, res) => {
  const { email } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO subscribers (email) VALUES (?)', [email]);
    res.status(201).json({ id: result.insertId, email });
  } catch (error) {
    console.error('Error creating subscriber:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get tags
exports.getTags = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tags');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create a new post-tag association
exports.createPostTag = async (req, res) => {
  const { post_id, tag_id } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)', [post_id, tag_id]);
    res.status(201).json({ post_id, tag_id });
  } catch (error) {
    console.error('Error creating post-tag association:', error);
    res.status(500).json({ error: error.message });
  }
};

// Like a post
exports.likePost = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query('UPDATE posts SET likes = likes + 1 WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ msg: 'Post not found' });
    }

    const [updatedPost] = await pool.query('SELECT * FROM posts WHERE id = ?', [id]);
    
    res.json(updatedPost[0]);
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get popular posts (e.g., posts with most likes)
exports.getPopularPosts = async (req, res) => {
  try {
    const [posts] = await pool.query(`
      SELECT p.*, a.name AS author_name, a.email AS author_email, i.image_path, p.created_at
      FROM posts p
      LEFT JOIN authors a ON p.author_id = a.id
      LEFT JOIN images i ON p.id = i.post_id
      ORDER BY p.likes DESC
      LIMIT 10
    `);

    const postsWithDetails = posts.reduce((acc, row) => {
      const postId = row.id;
      if (!acc[postId]) {
        acc[postId] = {
          ...row,
          images: [],
          author_name: row.author_name,
          author_email: row.author_email,
        };
      }
      if (row.image_path) {
        acc[postId].images.push(row.image_path);
      }
      return acc;
    }, {});

    res.json(Object.values(postsWithDetails));
  } catch (error) {
    console.error('Error fetching popular posts:', error);
    res.status(500).json({ error: error.message });
  }
};




// Middleware for uploading images
exports.uploadImages = upload.array('images'); // 'images' is the name of the file input field in your form
