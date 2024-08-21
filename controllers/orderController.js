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
    county_id,
    items, 
    total_price, 
    order_date 
  } = req.body;

  console.log('Received request to create an order with the following details:');
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
        user_name, email, phone_number, address, city, state, zip_code, county_id, total_price, order_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(orderQuery, [
      user_name, email, phone_number, address, city, state, zip_code, county_id, finalTotalPrice.toFixed(2), order_date
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
      o.total_price, o.order_date,
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
      const { id, user_name, email, phone_number, address, city, state, zip_code, county_name, county_shipping_fee, total_price, order_date } = order;

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

module.exports = {
  createOrder,
  getOrders,
  getCounties
};
