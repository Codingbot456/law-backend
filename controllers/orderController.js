const db = require('../config/db');

// Create a new order
const createOrder = async (req, res) => {
  const { 
    user_id, // Added this line
    user_name, 
    email, 
    phone_number, 
    address, 
    city, 
    state, 
    zip_code, 
    county_id,
    items, 
    total_price, 
    order_date 
  } = req.body;

  console.log('Received request to create an order with the following details:');
  console.log(`User ID: ${user_id}`); // Added this line
  console.log(`User Name: ${user_name}`);
  console.log(`Email: ${email}`);
  console.log(`Phone Number: ${phone_number}`);
  console.log(`Address: ${address}`);
  console.log(`City: ${city}`);
  console.log(`State: ${state}`);
  console.log(`Zip Code: ${zip_code}`);
  console.log(`County ID: ${county_id}`);
  console.log(`Total Price (before shipping): ${total_price}`);
  console.log(`Order Date: ${order_date}`);
  console.log('Order Items:', items);

  const getShippingFeeQuery = 'SELECT shipping_fee FROM counties WHERE id = ?';
  
  try {
    const [shippingFeeResult] = await db.execute(getShippingFeeQuery, [county_id]);
    if (shippingFeeResult.length === 0) {
      console.error('Invalid county_id provided.');
      return res.status(400).json({ error: 'Invalid county_id' });
    }

    const shippingFee = shippingFeeResult[0].shipping_fee;
    const finalTotalPrice = parseFloat(total_price) + parseFloat(shippingFee);

    console.log(`Shipping Fee for county ID ${county_id}: ${shippingFee}`);
    console.log(`Final Total Price (after adding shipping): ${finalTotalPrice.toFixed(2)}`);

    const orderQuery = `
      INSERT INTO orders (
        user_id, user_name, email, phone_number, address, city, state, zip_code, county_id, total_price, order_date, current_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(orderQuery, [
      user_id, user_name, email, phone_number, address, city, state, zip_code, county_id, finalTotalPrice.toFixed(2), order_date, 'pending'
    ]);

    const orderId = result.insertId;
    console.log('Order created with ID:', orderId);

    const orderItems = items.map(item => [
      orderId,
      item.product_id,
      item.name,
      item.price,
      item.quantity,
      item.totalPrice,
      item.selectedColor || null,
      JSON.stringify(item.selectedSizes) || null,
      item.image_url,
      item.subtotal_price
    ]);

    console.log('Order items to be inserted:', orderItems);

    const orderItemsQuery = `
      INSERT INTO order_items (
        order_id, product_id, name, price, quantity, total_price_item, selected_color, selected_sizes, image_url, subtotal_price
      ) VALUES ?
    `;
    await db.query(orderItemsQuery, [orderItems]);

    console.log('Order items inserted successfully');

    res.status(201).json({ message: 'Order created successfully', orderId });
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Error creating order' });
  }
};


// Get all orders
const getOrders = async (req, res) => {
  const query = `
    SELECT 
      o.id, o.user_name, o.email, o.phone_number, o.address, o.city, o.state, o.zip_code,
      c.name AS county_name, c.shipping_fee AS county_shipping_fee,
      o.total_price, o.order_date, o.current_status,
      oi.product_id, oi.name AS product_name, oi.price AS product_price,
      oi.quantity, oi.total_price_item, oi.selected_color, oi.selected_sizes,
      oi.image_url, oi.subtotal_price
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN counties c ON o.county_id = c.id
  `;

  try {
    const [results] = await db.query(query);
    
    const orders = results.reduce((acc, order) => {
      const { id, user_name, email, phone_number, address, city, state, zip_code, county_name, county_shipping_fee, total_price, order_date, current_status } = order;

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
          county: county_name,
          shipping_fee: county_shipping_fee,
          total_price,
          order_date,
          current_status,
          items: []
        };
        acc.push(existingOrder);
      }

      if (order.product_id) {
        existingOrder.items.push({
          product_id: order.product_id,
          name: order.product_name,
          price: order.product_price,
          quantity: order.quantity,
          total_price_item: order.total_price_item,
          selected_color: order.selected_color,
          selected_sizes: order.selected_sizes,
          image_url: order.image_url,
          subtotal_price: order.subtotal_price
        });
      }

      return acc;
    }, []);

    console.log('Fetched orders:', orders);
    res.json(orders);
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Error fetching orders' });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  const { order_id, new_status } = req.body;

  console.log('Received request to update order status with:', { order_id, new_status });

  // Validate new_status
  const validStatuses = ['pending', 'in_transit', 'shipped', 'delivered'];
  if (!validStatuses.includes(new_status)) {
    console.error('Invalid status provided:', new_status);
    return res.status(400).json({ error: 'Invalid status provided' });
  }

  // Fetch the current status of the order
  const currentStatusQuery = 'SELECT current_status FROM orders WHERE id = ?';
  try {
    console.log('Executing query to fetch current status for order ID:', order_id);
    const [currentStatusResult] = await db.execute(currentStatusQuery, [order_id]);
    
    console.log('Current status query result:', currentStatusResult);

    if (currentStatusResult.length === 0) {
      console.error('Order not found for ID:', order_id);
      return res.status(404).json({ error: 'Order not found' });
    }

    const currentStatus = currentStatusResult[0].current_status;
    console.log('Current status of order ID', order_id, ':', currentStatus);

    // Only allow status transitions to the next status
    const statusTransitionMap = {
      'pending': ['in_transit'],
      'in_transit': ['shipped'],
      'shipped': ['delivered'],
      'delivered': [] // No further status
    };

    if (!statusTransitionMap[currentStatus].includes(new_status)) {
      console.error('Invalid status transition from', currentStatus, 'to', new_status);
      return res.status(400).json({ error: 'Invalid status transition' });
    }

    const updateStatusQuery = 'UPDATE orders SET current_status = ? WHERE id = ?';
    console.log('Executing query to update status for order ID:', order_id);
    const [result] = await db.execute(updateStatusQuery, [new_status, order_id]);

    console.log('Update status query result:', result);

    if (result.affectedRows === 0) {
      console.error('Order not found or no status updated for ID:', order_id);
      return res.status(404).json({ error: 'Order not found or no status updated' });
    }

    console.log('Order status updated successfully for order ID:', order_id);
    res.status(200).json({ message: 'Order status updated successfully' });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ error: 'Error updating order status' });
  }
};

// Endpoint to get all counties
const getCounties = async (req, res) => {
  try {
    const [results] = await db.query('SELECT id, name, shipping_fee FROM counties');
    res.json(results);
  } catch (err) {
    console.error('Error fetching counties:', err);
    res.status(500).json({ error: 'Error fetching counties' });
  }
};

// Get orders for a specific user
const getUserOrders = async (req, res) => {
  const userId = req.params.userId; // Extract user ID from URL parameters

  console.log(`Fetching orders for user ID: ${userId}`);

  const query = `
    SELECT 
      o.id, o.user_name, o.email, o.phone_number, o.address, o.city, o.state, o.zip_code,
      c.name AS county_name, c.shipping_fee AS county_shipping_fee,
      o.total_price, o.order_date, o.current_status,
      oi.product_id, oi.name AS product_name, oi.price AS product_price,
      oi.quantity, oi.total_price_item, oi.selected_color, oi.selected_sizes,
      oi.image_url, oi.subtotal_price
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN counties c ON o.county_id = c.id
    WHERE o.user_id = ?
  `;

  try {
    const [results] = await db.query(query, [userId]);
    const orders = results.reduce((acc, order) => {
      const { id, user_name, email, phone_number, address, city, state, zip_code, county_name, county_shipping_fee, total_price, order_date, current_status } = order;

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
          county: county_name,
          shipping_fee: county_shipping_fee,
          total_price,
          order_date,
          current_status,
          items: []
        };
        acc.push(existingOrder);
      }

      if (order.product_id) {
        existingOrder.items.push({
          product_id: order.product_id,
          name: order.product_name,
          price: order.product_price,
          quantity: order.quantity,
          total_price_item: order.total_price_item,
          selected_color: order.selected_color,
          selected_sizes: order.selected_sizes,
          image_url: order.image_url,
          subtotal_price: order.subtotal_price
        });
      }

      return acc;
    }, []);

    console.log(`Orders fetched for user ID ${userId}:`, orders);
    res.json(orders);
  } catch (err) {
    console.error('Error fetching user orders:', err);
    res.status(500).json({ error: 'Error fetching user orders' });
  }
};

module.exports = {
  createOrder,
  getOrders,
  updateOrderStatus,
  getCounties,
  getUserOrders
};
