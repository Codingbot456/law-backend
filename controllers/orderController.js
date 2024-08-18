const db = require('../config/db');

// Create a new order
const createOrder = async (req, res) => {
  const { 
    user_name, 
    email, 
    phone_number, 
    address, 
    city, 
    state, 
    zip_code, 
    items, 
    total_price, 
    order_date 
  } = req.body;

  const orderQuery = 'INSERT INTO orders (user_name, email, phone_number, address, city, state, zip_code, total_price, order_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
  
  try {
    // Insert order data
    const [result] = await db.execute(orderQuery, [user_name, email, phone_number, address, city, state, zip_code, total_price, order_date]);

    const orderId = result.insertId;
    console.log('Order created with ID:', orderId);

    // Prepare order items for insertion
    const orderItems = items.map(item => [
      orderId,
      item.product_id,
      item.quantity,
      item.totalPrice, // Use totalPrice for subtotal_price
      item.selectedColor || null, // Handle selectedColor
      JSON.stringify(item.selectedSizes) || null, // Handle selectedSizes as JSON string
      item.image_url, // Ensure image_url is included if needed
      item.totalPrice // Use totalPrice for the total price of the item
    ]);

    // Log the items to be inserted
    console.log('Order items to be inserted:', orderItems);

    // Insert order items data
    const orderItemsQuery = 'INSERT INTO order_items (order_id, product_id, quantity, subtotal_price, selected_color, selected_sizes, image_url, total_price_item) VALUES ?';
    await db.query(orderItemsQuery, [orderItems]);

    // Success response
    res.status(201).json({ message: 'Order created successfully', orderId });
  } catch (err) {
    // Log error details
    console.error('Error creating order:', err);

    // Determine if error is due to known issues (e.g., database constraints)
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      return res.status(400).json({ error: 'Invalid field in request' });
    }

    // General error response
    res.status(500).json({ error: 'Error creating order' });
  }
};

// Get all orders
// Get all orders along with their items
const getOrders = async (req, res) => {
    const query = `
      SELECT 
        o.id,
        o.user_name,
        o.email,
        o.phone_number,
        o.address,
        o.city,
        o.state,
        o.zip_code,
        o.total_price,
        o.order_date,
        oi.product_id,
        oi.quantity,
        oi.subtotal_price,
        oi.selected_color,
        oi.selected_sizes,
        oi.image_url,
        oi.total_price_item
      FROM 
        orders o
      LEFT JOIN 
        order_items oi ON o.id = oi.order_id
    `;
    
    try {
      const [results] = await db.query(query);
      
      // Group the results by order
      const orders = results.reduce((acc, order) => {
        const { id, user_name, email, phone_number, address, city, state, zip_code, total_price, order_date } = order;
  
        // Check if the order already exists in the accumulator
        let existingOrder = acc.find(o => o.id === id);
        if (!existingOrder) {
          existingOrder = {
            id,
            user_name,
            email,
            phone_number,
            address,
            city,
            state,
            zip_code,
            total_price,
            order_date,
            items: []
          };
          acc.push(existingOrder);
        }
  
        // Add item details if they exist
        if (order.product_id) {
          existingOrder.items.push({
            product_id: order.product_id,
            quantity: order.quantity,
            subtotal_price: order.subtotal_price,
            selected_color: order.selected_color,
            selected_sizes: order.selected_sizes,
            image_url: order.image_url,
            total_price_item: order.total_price_item
          });
        }
  
        return acc;
      }, []);
  
      console.log('Fetched orders with items:', orders);
      res.json(orders);
    } catch (err) {
      console.error('Error fetching orders:', err);
      res.status(500).json({ error: 'Error fetching orders' });
    }
  };
  

module.exports = {
  createOrder,
  getOrders,
};
